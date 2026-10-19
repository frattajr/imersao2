// Servidor: painel web + API do painel + webhook do WhatsApp.
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as db from "./armazem.js";
import { processar, receberDoWhatsApp, respostaDaEquipe } from "./atendimento.js";
import { checklist, montarFerramentas, montarPrompt } from "./estrutura.js";
import { atualizarLead } from "./ferramentas.js";
import { iniciarAgendador } from "./followup.js";
import { MODELOS, testarChave } from "./ia.js";
import * as pagamento from "./pagamento.js";
import { RAMOS, novaEmpresa } from "./ramos.js";
import * as whatsapp from "./whatsapp.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const SENHA = process.env.SENHA_PAINEL;
const PORTA = Number(process.env.PORTA || 3000);

// ---- segredos: nunca voltam inteiros para o navegador ----
const SEGREDOS = [["ia", "chave"], ["whatsapp", "token"], ["whatsapp", "app_secret"], ["pagamento", "mp_token"]];
const MASCARA = "••••";

function mascarar(empresa) {
  const e = structuredClone(empresa);
  for (const [g, k] of SEGREDOS) {
    const v = e.integracoes[g][k];
    e.integracoes[g][k] = v ? `${MASCARA}${v.slice(-4)}` : "";
  }
  return e;
}

function mesclar(atual, nova) {
  const e = structuredClone(nova);
  e.id = atual.id;
  e.criado_em = atual.criado_em;
  for (const [g, k] of SEGREDOS) {
    const v = e.integracoes?.[g]?.[k];
    if (typeof v === "string" && v.startsWith(MASCARA)) e.integracoes[g][k] = atual.integracoes[g][k];
  }
  e.integracoes.whatsapp.verify_token ||= atual.integracoes.whatsapp.verify_token;
  return e;
}

function validar(e) {
  const erros = [];
  if (!e?.negocio?.nome?.trim()) erros.push("informe o nome da empresa");
  if (!Array.isArray(e?.servicos)) erros.push("serviços inválidos");
  const ids = new Set();
  for (const s of e?.servicos || []) {
    if (!/^[a-z0-9_]+$/.test(s.id || "")) erros.push(`código do serviço "${s.nome}" deve ter só letras minúsculas, números e _`);
    if (ids.has(s.id)) erros.push(`código de serviço repetido: ${s.id}`);
    ids.add(s.id);
  }
  if (!Array.isArray(e?.horario?.dias)) erros.push("dias de atendimento inválidos");
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: e?.negocio?.fuso }); } catch { erros.push("fuso horário inválido"); }
  return erros;
}

const urlBase = (req) => process.env.URL_PUBLICA?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;

// ---- app ----
const app = express();
app.set("trust proxy", true);
app.use(express.json({ limit: "2mb", verify: (req, _res, buf) => { req.corpoBruto = buf; } }));

// Webhook do WhatsApp (público, protegido pelo verify token e pela assinatura da Meta)
app.get("/webhook/:empresa", async (req, res) => {
  const e = await db.lerEmpresa(req.params.empresa).catch(() => null);
  if (e && req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === e.integracoes.whatsapp.verify_token) {
    return res.send(String(req.query["hub.challenge"]));
  }
  res.sendStatus(403);
});

app.post("/webhook/:empresa", async (req, res) => {
  const e = await db.lerEmpresa(req.params.empresa).catch(() => null);
  if (!e) return res.sendStatus(404);
  if (!whatsapp.assinaturaValida(e.integracoes.whatsapp.app_secret, req.corpoBruto, req.get("x-hub-signature-256"))) {
    return res.sendStatus(401);
  }
  res.sendStatus(200); // responde já; a Meta reenvia se demorar
  for (const m of whatsapp.extrairMensagens(req.body)) receberDoWhatsApp(e.id, m);
});

// Daqui para baixo: só com senha
app.use((req, res, next) => {
  if (!SENHA) return res.status(500).send("Defina a variável SENHA_PAINEL antes de usar o painel.");
  const [tipo, cred] = (req.get("authorization") || "").split(" ");
  const [, senha] = tipo === "Basic" && cred ? Buffer.from(cred, "base64").toString().split(/:(.*)/s) : [];
  const ok = senha && senha.length === SENHA.length && crypto.timingSafeEqual(Buffer.from(senha), Buffer.from(SENHA));
  if (ok) return next();
  res.set("WWW-Authenticate", 'Basic realm="Painel do atendente"').sendStatus(401);
});

app.use(express.static(path.join(aqui, "..", "public")));

const rota = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((err) => {
  console.error(err);
  res.status(err.status || 500).json({ erro: err.message });
});
async function empresaOu404(id) {
  const e = await db.lerEmpresa(id).catch(() => null);
  if (!e) throw Object.assign(new Error("empresa não encontrada"), { status: 404 });
  return e;
}

app.get("/api/opcoes", (_req, res) => {
  res.json({ ramos: Object.fromEntries(Object.entries(RAMOS).map(([k, v]) => [k, v.nome])), modelos: MODELOS });
});

app.get("/api/empresas", rota(async (_req, res) => {
  const lista = await db.listarEmpresas();
  res.json(lista.map((e) => ({ id: e.id, nome: e.negocio.nome, ramo: e.negocio.ramo, pronto: checklist(e).pronto })));
}));

app.post("/api/empresas", rota(async (req, res) => {
  const nome = String(req.body?.nome || "").trim();
  if (!nome) return res.status(400).json({ erro: "informe o nome" });
  const e = novaEmpresa({ id: db.novoId(), nome, ramo: req.body?.ramo });
  await db.salvarEmpresa(e);
  res.status(201).json(mascarar(e));
}));

app.get("/api/empresas/:id", rota(async (req, res) => res.json(mascarar(await empresaOu404(req.params.id)))));

app.put("/api/empresas/:id", rota(async (req, res) => {
  const atual = await empresaOu404(req.params.id);
  const nova = mesclar(atual, req.body);
  const erros = validar(nova);
  if (erros.length) return res.status(400).json({ erro: erros.join("; ") });
  await db.salvarEmpresa(nova);
  res.json(mascarar(nova));
}));

app.delete("/api/empresas/:id", rota(async (req, res) => {
  await empresaOu404(req.params.id);
  await db.apagarEmpresa(req.params.id);
  res.sendStatus(204);
}));

// A estrutura que o servidor montou sozinho a partir dos dados
app.get("/api/empresas/:id/estrutura", rota(async (req, res) => {
  const e = await empresaOu404(req.params.id);
  res.json({
    webhook: { url: `${urlBase(req)}/webhook/${e.id}`, verify_token: e.integracoes.whatsapp.verify_token },
    checklist: checklist(e),
    prompt: montarPrompt(e),
    ferramentas: montarFerramentas(e),
    eventos_webhook_saida: ["orcamento.calculado", "desconto.solicitado", "agendamento.criado", "cobranca.gerada", "lead.<etapa>", "humano.solicitado", "followup.enviado", "lembrete.enviado"],
  });
}));

app.post("/api/empresas/:id/testar-conexoes", rota(async (req, res) => {
  const e = await empresaOu404(req.params.id);
  const i = e.integracoes;
  const tentar = async (fn) => { try { return await fn(); } catch (err) { return { ok: false, detalhe: err.message }; } };
  res.json({
    ia: i.ia.chave ? await tentar(() => testarChave(i.ia.chave, i.ia.modelo)) : { ok: false, detalhe: "sem chave" },
    whatsapp: whatsapp.configurado(i.whatsapp)
      ? await tentar(async () => { const d = await whatsapp.testar(i.whatsapp); return { ok: true, detalhe: `${d.display_phone_number} · ${d.verified_name}` }; })
      : { ok: false, detalhe: "sem token ou ID do número" },
    pagamento: await tentar(() => pagamento.testar(i.pagamento)),
  });
}));

// Simulador: conversar com a IA pelo painel, sem WhatsApp
app.post("/api/empresas/:id/teste", rota(async (req, res) => {
  const e = await empresaOu404(req.params.id);
  if (req.body?.reiniciar) {
    await db.apagarConversa(e.id, "teste");
    await db.alterarLeads(e.id, (l) => { delete l.teste; });
    await db.alterarAgenda(e.id, (a) => { a.splice(0, a.length, ...a.filter((x) => x.telefone !== "teste")); });
    return res.json({ ok: true });
  }
  const texto = String(req.body?.texto || "").trim();
  if (!texto) return res.status(400).json({ erro: "mensagem vazia" });
  const r = await processar(e.id, "teste", texto, { nome: "Cliente de teste", canal: "teste" });
  res.json(r);
}));

app.get("/api/empresas/:id/leads", rota(async (req, res) => {
  await empresaOu404(req.params.id);
  const leads = Object.values(await db.lerLeads(req.params.id));
  res.json(leads.sort((a, b) => (b.ultima_msg_cliente || "").localeCompare(a.ultima_msg_cliente || "")));
}));

app.get("/api/empresas/:id/conversas/:tel", rota(async (req, res) => {
  await empresaOu404(req.params.id);
  const c = await db.lerConversa(req.params.id, req.params.tel);
  res.json({ linha: c.linha });
}));

app.post("/api/empresas/:id/leads/:tel/humano", rota(async (req, res) => {
  await empresaOu404(req.params.id);
  const lead = await atualizarLead(req.params.id, req.params.tel, (l) => { l.humano = !!req.body?.ativo; });
  res.json(lead);
}));

app.post("/api/empresas/:id/leads/:tel/mensagem", rota(async (req, res) => {
  const e = await empresaOu404(req.params.id);
  const texto = String(req.body?.texto || "").trim();
  if (!texto) return res.status(400).json({ erro: "mensagem vazia" });
  await respostaDaEquipe(e, req.params.tel, texto);
  res.json({ ok: true });
}));

app.get("/api/empresas/:id/agenda", rota(async (req, res) => {
  await empresaOu404(req.params.id);
  res.json((await db.lerAgenda(req.params.id)).sort((a, b) => a.inicio.localeCompare(b.inicio)));
}));

app.get("/api/empresas/:id/eventos", rota(async (req, res) => {
  await empresaOu404(req.params.id);
  res.json(await db.lerEventos(req.params.id));
}));

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (!SENHA) console.warn("⚠️  Defina SENHA_PAINEL para liberar o painel.");
  app.listen(PORTA, () => console.log(`Painel em http://localhost:${PORTA} (usuário: admin)`));
  iniciarAgendador();
}

export default app;
