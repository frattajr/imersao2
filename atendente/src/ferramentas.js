// Execução das ferramentas que a IA chama. Toda regra de negócio fica aqui.
import { alterarAgenda, alterarLeads, lerAgenda, novoId } from "./armazem.js";
import { conflita, dentroDoExpediente, formatar, horariosLivres } from "./agenda.js";
import { publicar } from "./eventos.js";
import { gerarCobranca } from "./pagamento.js";
import { avaliarDesconto, calcularOrcamento, valorSinal } from "./precos.js";
import * as whatsapp from "./whatsapp.js";

export function leadVazio(telefone) {
  return {
    telefone, nome: "", etapa: "novo", servico_id: "", valor: null, humano: false,
    criado_em: new Date().toISOString(), ultima_msg_cliente: null, ultima_msg_ia: null,
    followups_enviados: 0, observacoes: [],
  };
}

export function atualizarLead(empresaId, telefone, fn) {
  return alterarLeads(empresaId, (leads) => {
    leads[telefone] ||= leadVazio(telefone);
    fn(leads[telefone]);
    return leads[telefone];
  });
}

const acharServico = (empresa, id) => empresa.servicos.find((s) => s.id === id);

const executores = {
  async calcular_orcamento(e, ctx) {
    const s = acharServico(ctx.empresa, e.servico_id);
    if (!s) return { erro: "serviço não encontrado" };
    const r = calcularOrcamento(s, e, ctx.empresa.regras);
    await atualizarLead(ctx.empresa.id, ctx.telefone, (l) => {
      l.servico_id = s.id;
      if (r.valor != null) l.valor = r.valor;
    });
    await publicar(ctx.empresa, "orcamento.calculado", { telefone: ctx.telefone, ...r });
    return r;
  },

  async aplicar_desconto(e, ctx) {
    const r = avaliarDesconto(e.valor_original, e.percentual, ctx.empresa.regras);
    if (r.aprovado) await atualizarLead(ctx.empresa.id, ctx.telefone, (l) => { l.valor = r.valor_final; l.etapa = "negociando"; });
    await publicar(ctx.empresa, "desconto.solicitado", { telefone: ctx.telefone, motivo: e.motivo, ...r });
    return r;
  },

  async horarios_livres(e, ctx) {
    const s = acharServico(ctx.empresa, e.servico_id);
    const agenda = await lerAgenda(ctx.empresa.id);
    const livres = horariosLivres(ctx.empresa, agenda, { duracao_min: s?.duracao_min || 60, a_partir_de: e.a_partir_de });
    return livres.length ? { horarios: livres } : { horarios: [], aviso: "sem horários livres nas próximas 3 semanas; chame a equipe" };
  },

  async agendar(e, ctx) {
    const s = acharServico(ctx.empresa, e.servico_id);
    if (!s) return { erro: "serviço não encontrado" };
    const inicio = Date.parse(e.inicio);
    if (!Number.isFinite(inicio)) return { erro: "horário inválido; use um horário vindo de horarios_livres" };
    const dur = s.duracao_min || 60;
    if (inicio < Date.now() || !dentroDoExpediente(inicio, dur, ctx.empresa)) return { erro: "horário fora do expediente ou no passado" };
    const fim = inicio + dur * 60e3;
    const ag = await alterarAgenda(ctx.empresa.id, (agenda) => {
      if (conflita(inicio, fim, agenda)) return null;
      const novo = {
        id: novoId(), telefone: ctx.telefone, nome: e.nome_cliente, servico_id: s.id, servico: s.nome,
        inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(), endereco: e.endereco || "",
        valor: e.valor ?? null, status: "agendado", lembrete_enviado: false, criado_em: new Date().toISOString(),
      };
      agenda.push(novo);
      return novo;
    });
    if (!ag) return { erro: "esse horário acabou de ser ocupado; consulte horarios_livres de novo" };
    await atualizarLead(ctx.empresa.id, ctx.telefone, (l) => {
      l.etapa = "agendado"; l.nome ||= e.nome_cliente; l.servico_id = s.id;
      if (e.valor != null) l.valor = e.valor;
    });
    await publicar(ctx.empresa, "agendamento.criado", ag);
    return { ok: true, agendamento_id: ag.id, quando: formatar(inicio, ctx.empresa.negocio.fuso), servico: s.nome };
  },

  async registrar_lead(e, ctx) {
    const lead = await atualizarLead(ctx.empresa.id, ctx.telefone, (l) => {
      if (e.etapa) l.etapa = e.etapa;
      if (e.nome) l.nome = e.nome;
      if (e.servico_id) l.servico_id = e.servico_id;
      if (e.valor != null) l.valor = e.valor;
      if (e.observacao) l.observacoes.push(e.observacao);
    });
    await publicar(ctx.empresa, `lead.${lead.etapa}`, { telefone: ctx.telefone, nome: lead.nome, servico_id: lead.servico_id, valor: lead.valor });
    return { ok: true, etapa: lead.etapa };
  },

  async chamar_humano(e, ctx) {
    await atualizarLead(ctx.empresa.id, ctx.telefone, (l) => { l.humano = true; l.observacoes.push(`Transferido: ${e.motivo}`); });
    await publicar(ctx.empresa, "humano.solicitado", { telefone: ctx.telefone, ...e });
    const dono = ctx.empresa.negocio.whatsapp_dono?.replace(/\D/g, "");
    const cfg = ctx.empresa.integracoes.whatsapp;
    if (dono && ctx.canal === "whatsapp" && whatsapp.configurado(cfg)) {
      await whatsapp.enviarTexto(cfg, dono, `🔔 Cliente ${ctx.telefone} precisa de atendimento.\nMotivo: ${e.motivo}\nResumo: ${e.resumo}`)
        .catch((err) => console.warn(`[${ctx.empresa.id}] aviso ao dono falhou: ${err.message}`));
    }
    return { ok: true, aviso: "a equipe foi avisada; diga ao cliente que uma pessoa vai continuar o atendimento" };
  },

  async gerar_cobranca_sinal(e, ctx) {
    const valor = valorSinal(e.valor_total, ctx.empresa.regras);
    if (!(valor > 0)) return { erro: "valor do sinal zerado; confira o percentual de sinal nas regras" };
    const r = await gerarCobranca(ctx.empresa.integracoes.pagamento, valor, e.descricao, `${ctx.empresa.id}:${ctx.telefone}`);
    await publicar(ctx.empresa, "cobranca.gerada", { telefone: ctx.telefone, valor, ...r });
    return { ok: true, valor_sinal: valor, ...r };
  },
};

export async function executarFerramenta(nome, entrada, ctx) {
  const fn = executores[nome];
  if (!fn) return { conteudo: JSON.stringify({ erro: `ferramenta desconhecida: ${nome}` }), erro: true };
  try {
    const r = await fn(entrada || {}, ctx);
    return { conteudo: JSON.stringify(r), erro: false };
  } catch (err) {
    console.warn(`[${ctx.empresa.id}] ferramenta ${nome} falhou: ${err.message}`);
    return { conteudo: JSON.stringify({ erro: err.message }), erro: true };
  }
}
