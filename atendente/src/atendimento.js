// Orquestra o atendimento: junta mensagens picadas, respeita a transferência
// para humano, chama a IA e envia a resposta pelo canal certo.
import { alterarConversa, lerEmpresa } from "./armazem.js";
import { agoraTexto } from "./agenda.js";
import { publicar } from "./eventos.js";
import { atualizarLead } from "./ferramentas.js";
import { responder } from "./ia.js";
import * as whatsapp from "./whatsapp.js";

const ESPERA_MS = Number(process.env.ESPERA_MENSAGENS_MS ?? 6000); // junta mensagens enviadas em sequência
const vistos = new Set();
const pendentes = new Map(); // "empresa:telefone" -> { textos, nome, timer }

function jaVisto(id) {
  if (!id) return false;
  if (vistos.has(id)) return true;
  vistos.add(id);
  if (vistos.size > 5000) vistos.delete(vistos.values().next().value);
  return false;
}

export function receberDoWhatsApp(empresaId, msg) {
  if (jaVisto(msg.id)) return; // a Meta reenvia o webhook quando demora
  const chave = `${empresaId}:${msg.de}`;
  const p = pendentes.get(chave) || { textos: [], nome: msg.nome, ids: [] };
  p.textos.push(msg.texto);
  p.ids.push(msg.id);
  clearTimeout(p.timer);
  p.timer = setTimeout(() => {
    pendentes.delete(chave);
    processar(empresaId, msg.de, p.textos.join("\n"), { nome: p.nome, canal: "whatsapp", ultimoId: p.ids.at(-1) })
      .catch((e) => console.error(`[${empresaId}] erro no atendimento de ${msg.de}:`, e.message));
  }, ESPERA_MS);
  pendentes.set(chave, p);
}

export async function processar(empresaId, telefone, texto, { nome = "", canal = "teste", ultimoId } = {}) {
  const empresa = await lerEmpresa(empresaId);
  if (!empresa) throw new Error("empresa não encontrada");
  const agora = new Date().toISOString();
  const cfgWa = empresa.integracoes.whatsapp;

  const lead = await atualizarLead(empresaId, telefone, (l) => {
    l.ultima_msg_cliente = agora;
    if (!l.nome && nome) l.nome = nome;
    if (l.etapa === "novo") l.etapa = "qualificando";
  });
  const notas = lead.notas_pendentes || [];
  if (notas.length) await atualizarLead(empresaId, telefone, (l) => { l.notas_pendentes = []; });

  if (canal === "whatsapp" && ultimoId && whatsapp.configurado(cfgWa)) whatsapp.marcarLida(cfgWa, ultimoId);

  if (lead.humano) {
    await alterarConversa(empresaId, telefone, (c) => { c.linha.push({ de: "cliente", texto, em: agora }); });
    await publicar(empresa, "mensagem.aguardando_equipe", { telefone, texto });
    return { texto: null, humano: true };
  }

  const contexto = [
    `[${agoraTexto(empresa.negocio.fuso)} · cliente: ${lead.nome || nome || "nome ainda não informado"} · telefone ${telefone} · etapa atual: ${lead.etapa}]`,
    ...notas.map((n) => `[nota do sistema: ${n}]`),
    texto,
  ].join("\n");

  const resultado = await alterarConversa(empresaId, telefone, async (c) => {
    c.linha.push({ de: "cliente", texto, em: agora });
    try {
      const r = await responder({ empresa, mensagens: c.mensagens, textoCliente: contexto, ctx: { empresa, telefone, canal } });
      if (r.texto) c.linha.push({ de: "ia", texto: r.texto, em: new Date().toISOString(), uso: r.uso });
      return r;
    } catch (e) {
      c.linha.push({ de: "sistema", texto: `Erro da IA: ${e.message}`, em: new Date().toISOString() });
      throw e;
    }
  });

  if (resultado.texto) {
    if (canal === "whatsapp") await whatsapp.enviarTexto(cfgWa, telefone, resultado.texto);
    await atualizarLead(empresaId, telefone, (l) => { l.ultima_msg_ia = new Date().toISOString(); });
  }
  return resultado;
}

// A equipe responde pelo painel (conversa transferida para humano).
export async function respostaDaEquipe(empresa, telefone, texto) {
  if (whatsapp.configurado(empresa.integracoes.whatsapp) && telefone !== "teste") {
    await whatsapp.enviarTexto(empresa.integracoes.whatsapp, telefone, texto);
  }
  await alterarConversa(empresa.id, telefone, (c) => { c.linha.push({ de: "equipe", texto, em: new Date().toISOString() }); });
  await atualizarLead(empresa.id, telefone, (l) => {
    (l.notas_pendentes ||= []).push(`a equipe respondeu ao cliente: "${texto}"`);
  });
}
