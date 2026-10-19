// Follow-up automático de orçamentos parados e lembrete de agendamentos.
// Fora da janela de 24h do WhatsApp, só modelos aprovados pela Meta podem ser enviados.
import { alterarAgenda, alterarConversa, alterarLeads, listarEmpresas } from "./armazem.js";
import { formatar } from "./agenda.js";
import { publicar } from "./eventos.js";
import * as whatsapp from "./whatsapp.js";

const DIA = 86400e3;
const ETAPAS_FOLLOWUP = new Set(["orcamento_enviado", "negociando"]);
const ts = (iso) => (iso ? Date.parse(iso) : 0);

async function enviar(empresa, telefone, { modelo, variaveis, textoLivre, janelaAberta }) {
  const cfg = empresa.integracoes.whatsapp;
  const simulado = telefone === "teste" || !whatsapp.configurado(cfg);
  let texto;
  if (janelaAberta) {
    texto = textoLivre;
    if (!simulado) await whatsapp.enviarTexto(cfg, telefone, texto);
  } else if (modelo) {
    texto = `[modelo "${modelo}"] ${variaveis.join(" · ")}`;
    if (!simulado) await whatsapp.enviarModelo(cfg, telefone, modelo, empresa.followup.idioma, variaveis);
  } else {
    return null; // fora da janela e sem modelo aprovado: não dá para enviar
  }
  await alterarConversa(empresa.id, telefone, (c) => {
    c.linha.push({ de: "sistema", texto: `${simulado ? "(simulado) " : ""}Mensagem automática: ${texto}`, em: new Date().toISOString() });
  });
  return texto;
}

export async function rodarEmpresa(empresa, agora = Date.now()) {
  if (!empresa.followup?.ativo) return;
  const dias = (empresa.followup.dias || []).map(Number).filter((d) => d > 0);

  // 1) orçamentos sem resposta
  const aEnviar = [];
  await alterarLeads(empresa.id, (leads) => {
    for (const l of Object.values(leads)) {
      if (l.humano || !ETAPAS_FOLLOWUP.has(l.etapa)) continue;
      const n = l.followups_enviados || 0;
      if (n >= dias.length) continue;
      const ultimaInteracao = Math.max(ts(l.ultima_msg_cliente), ts(l.ultima_msg_ia), ts(l.ultimo_followup));
      if (agora - ultimaInteracao < dias[n] * DIA) continue;
      l.followups_enviados = n + 1; // marca antes de enviar para nunca duplicar
      l.ultimo_followup = new Date(agora).toISOString();
      aEnviar.push({ ...l, n: n + 1 });
    }
  });
  for (const l of aEnviar) {
    const primeiroNome = (l.nome || "").split(" ")[0] || "tudo bem";
    try {
      const enviado = await enviar(empresa, l.telefone, {
        modelo: empresa.followup.modelo,
        variaveis: [primeiroNome],
        textoLivre: `Oi, ${primeiroNome}! Conseguiu ver o orçamento? Posso ajudar com alguma dúvida?`,
        janelaAberta: agora - ts(l.ultima_msg_cliente) < DIA,
      });
      if (!enviado) {
        await publicar(empresa, "followup.sem_modelo", { telefone: l.telefone, aviso: "cadastre um modelo de follow-up aprovado pela Meta" });
        continue;
      }
      await alterarLeads(empresa.id, (leads) => {
        (leads[l.telefone].notas_pendentes ||= []).push(`enviamos o follow-up automático nº ${l.n} em ${formatar(agora, empresa.negocio.fuso)}`);
      });
      await publicar(empresa, "followup.enviado", { telefone: l.telefone, numero: l.n });
    } catch (e) {
      console.warn(`[${empresa.id}] follow-up para ${l.telefone} falhou: ${e.message}`);
    }
  }

  // 2) lembrete de agendamentos nas próximas 24h
  const lembrar = [];
  await alterarAgenda(empresa.id, (agenda) => {
    for (const a of agenda) {
      const ini = ts(a.inicio);
      if (a.status !== "agendado" || a.lembrete_enviado || ini <= agora || ini - agora > DIA) continue;
      a.lembrete_enviado = true;
      lembrar.push(a);
    }
  });
  for (const a of lembrar) {
    const quando = formatar(ts(a.inicio), empresa.negocio.fuso);
    const nome = (a.nome || "").split(" ")[0] || "tudo bem";
    try {
      const enviado = await enviar(empresa, a.telefone, {
        modelo: empresa.followup.modelo_lembrete,
        variaveis: [nome, quando],
        textoLivre: `Oi, ${nome}! Lembrando do seu horário: ${a.servico}, ${quando}. Está confirmado?`,
        janelaAberta: false,
      });
      if (enviado) await publicar(empresa, "lembrete.enviado", { telefone: a.telefone, agendamento_id: a.id });
    } catch (e) {
      console.warn(`[${empresa.id}] lembrete para ${a.telefone} falhou: ${e.message}`);
    }
  }
}

export function iniciarAgendador(intervaloMs = 15 * 60e3) {
  const rodar = async () => {
    for (const e of await listarEmpresas().catch(() => [])) {
      await rodarEmpresa(e).catch((err) => console.warn(`[${e.id}] follow-up: ${err.message}`));
    }
  };
  setTimeout(rodar, 10e3);
  return setInterval(rodar, intervaloMs);
}
