import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const pasta = mkdtempSync(path.join(os.tmpdir(), "atendente-"));
process.env.PASTA_DADOS = pasta;
process.env.SENHA_PAINEL = "segredo123";

const { default: app } = await import("../src/servidor.js");
const db = await import("../src/armazem.js");
const { executarFerramenta } = await import("../src/ferramentas.js");
const { rodarEmpresa } = await import("../src/followup.js");

let servidor, base;
const auth = { Authorization: "Basic " + Buffer.from("admin:segredo123").toString("base64") };
const json = { ...auth, "Content-Type": "application/json" };

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once("listening", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => { servidor.close(); rmSync(pasta, { recursive: true, force: true }); });

test("painel exige senha", async () => {
  assert.equal((await fetch(`${base}/api/empresas`)).status, 401);
  assert.equal((await fetch(`${base}/api/empresas`, { headers: { Authorization: "Basic " + Buffer.from("admin:errada").toString("base64") } })).status, 401);
  assert.equal((await fetch(`${base}/api/empresas`, { headers: auth })).status, 200);
});

test("cria empresa, esconde segredos e monta a estrutura", async () => {
  const criada = await (await fetch(`${base}/api/empresas`, { method: "POST", headers: json, body: JSON.stringify({ nome: "Brilho", ramo: "limpeza" }) })).json();
  assert.equal(criada.servicos[0].id, "padrao");

  criada.integracoes.ia.chave = "sk-ant-teste-1234";
  criada.integracoes.whatsapp.app_secret = "segredo-app";
  const salva = await (await fetch(`${base}/api/empresas/${criada.id}`, { method: "PUT", headers: json, body: JSON.stringify(criada) })).json();
  assert.equal(salva.integracoes.ia.chave, "••••1234");

  // salvar de novo com a máscara não apaga a chave real
  await fetch(`${base}/api/empresas/${criada.id}`, { method: "PUT", headers: json, body: JSON.stringify(salva) });
  assert.equal((await db.lerEmpresa(criada.id)).integracoes.ia.chave, "sk-ant-teste-1234");

  const est = await (await fetch(`${base}/api/empresas/${criada.id}/estrutura`, { headers: auth })).json();
  assert.match(est.webhook.url, new RegExp(`/webhook/${criada.id}$`));
  assert.match(est.prompt, /Brilho/);

  // verificação do webhook pela Meta
  const v = await fetch(`${base}/webhook/${criada.id}?hub.mode=subscribe&hub.verify_token=${est.webhook.verify_token}&hub.challenge=42`);
  assert.equal(await v.text(), "42");
  assert.equal((await fetch(`${base}/webhook/${criada.id}?hub.mode=subscribe&hub.verify_token=x&hub.challenge=42`)).status, 403);
  // mensagem sem assinatura válida é recusada
  const p = await fetch(`${base}/webhook/${criada.id}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=00" }, body: "{}" });
  assert.equal(p.status, 401);

  // código de serviço inválido é rejeitado
  salva.servicos[0].id = "com espaço";
  assert.equal((await fetch(`${base}/api/empresas/${criada.id}`, { method: "PUT", headers: json, body: JSON.stringify(salva) })).status, 400);
});

test("ferramentas: agenda sem conflito, desconto com limite e follow-up sem duplicar", async () => {
  const [empresa] = await db.listarEmpresas();
  const ctx = { empresa, telefone: "5511988887777", canal: "teste" };

  const { horarios } = JSON.parse((await executarFerramenta("horarios_livres", { servico_id: "padrao" }, ctx)).conteudo);
  assert.ok(horarios.length > 0);
  const ag = JSON.parse((await executarFerramenta("agendar", { servico_id: "padrao", inicio: horarios[0].inicio, nome_cliente: "Ana" }, ctx)).conteudo);
  assert.equal(ag.ok, true);
  const repetido = JSON.parse((await executarFerramenta("agendar", { servico_id: "padrao", inicio: horarios[0].inicio, nome_cliente: "Bia" }, { ...ctx, telefone: "5511900000000" })).conteudo);
  assert.match(repetido.erro, /ocupado/);

  const desc = JSON.parse((await executarFerramenta("aplicar_desconto", { valor_original: 200, percentual: 50, motivo: "pediu" }, ctx)).conteudo);
  assert.equal(desc.aprovado, false);

  const pix = await executarFerramenta("gerar_cobranca_sinal", { valor_total: 200, descricao: "Limpeza" }, ctx);
  assert.equal(pix.erro, true); // chave Pix ainda não configurada: erro claro para a IA

  await executarFerramenta("registrar_lead", { etapa: "orcamento_enviado", nome: "Ana Souza" }, ctx);
  await db.alterarLeads(empresa.id, (l) => { l[ctx.telefone].ultima_msg_cliente = new Date(Date.now() - 2 * 86400e3).toISOString(); l[ctx.telefone].ultima_msg_ia = l[ctx.telefone].ultima_msg_cliente; });
  await rodarEmpresa(empresa);
  await rodarEmpresa(empresa);
  const lead = (await db.lerLeads(empresa.id))[ctx.telefone];
  assert.equal(lead.followups_enviados, 1); // dias = [1, 3]: só o primeiro venceu
  const conversa = await db.lerConversa(empresa.id, ctx.telefone);
  assert.equal(conversa.linha.filter((m) => /Mensagem automática/.test(m.texto)).length, 0); // sem modelo e fora das 24h: não envia
  const eventos = await db.lerEventos(empresa.id);
  assert.ok(eventos.some((e) => e.tipo === "followup.sem_modelo"));
});
