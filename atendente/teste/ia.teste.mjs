// Testa o ciclo IA → ferramenta → IA com um servidor falso no lugar da API da Anthropic.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const pasta = mkdtempSync(path.join(os.tmpdir(), "atendente-ia-"));
process.env.PASTA_DADOS = pasta;

const pedidos = [];
const falso = http.createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const b = JSON.parse(corpo);
    pedidos.push({ corpo: b, beta: req.headers["anthropic-beta"] });
    const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    const ultima = b.messages.at(-1);
    const resposta = Array.isArray(ultima.content) && ultima.content[0]?.type === "tool_result"
      ? { stop_reason: "end_turn", content: [{ type: "text", text: "Fica R$ 160,00 para 3 tomadas. Quer agendar?" }] }
      : { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "calcular_orcamento", input: { servico_id: "tomada", quantidade: 3 } }] };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "msg", type: "message", role: "assistant", model: b.model, usage, ...resposta }));
  });
});
await new Promise((r) => falso.listen(0, r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${falso.address().port}`;

const db = await import("../src/armazem.js");
const { novaEmpresa } = await import("../src/ramos.js");
const { processar } = await import("../src/atendimento.js");

after(() => { falso.close(); rmSync(pasta, { recursive: true, force: true }); });

test("conversa de teste: chama a ferramenta, responde e guarda histórico", async () => {
  const e = novaEmpresa({ id: "abc123", nome: "João Elétrica", ramo: "eletricista" });
  e.integracoes.ia.chave = "sk-ant-falsa";
  await db.salvarEmpresa(e);

  const r = await processar(e.id, "teste", "Quanto fica 3 tomadas?", { canal: "teste" });
  assert.equal(r.texto, "Fica R$ 160,00 para 3 tomadas. Quer agendar?");
  assert.equal(r.uso.chamadas, 2);

  const [p1, p2] = pedidos;
  assert.equal(p1.corpo.model, "claude-opus-5-5");
  assert.equal(p1.corpo.fallbacks, "default");
  assert.match(p1.beta, /server-side-fallback-2026-07-01/);
  assert.deepEqual(p1.corpo.output_config, { effort: "low" });
  assert.match(p1.corpo.system, /João Elétrica/);
  const resultado = JSON.parse(p2.corpo.messages.at(-1).content[0].content);
  assert.equal(resultado.valor, 160); // a conta foi feita pelo código, não pela IA

  const lead = (await db.lerLeads(e.id)).teste;
  assert.equal(lead.valor, 160);
  assert.equal(lead.etapa, "qualificando");
  const conversa = await db.lerConversa(e.id, "teste");
  assert.equal(conversa.mensagens.length, 4); // cliente, ferramenta, resultado, resposta (só acrescenta)
  assert.deepEqual(conversa.linha.map((m) => m.de), ["cliente", "ia"]);
});

test("cliente transferido para a equipe não recebe resposta da IA", async () => {
  await db.alterarLeads("abc123", (l) => { l.teste.humano = true; });
  const antes = pedidos.length;
  const r = await processar("abc123", "teste", "Oi?", { canal: "teste" });
  assert.equal(r.humano, true);
  assert.equal(pedidos.length, antes);
});
