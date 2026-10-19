// "O back monta a estrutura sozinho": a partir dos dados da empresa, gera o
// prompt da IA, as ferramentas que ela pode usar e a lista do que falta configurar.
import { reais } from "./precos.js";

const ETAPAS = ["novo", "qualificando", "orcamento_enviado", "negociando", "agendado", "fechado", "perdido"];

function descreverPreco(p = {}) {
  switch (p.tipo) {
    case "fixo": return `preço fixo ${reais(p.valor || 0)}${p.adicional_por_unidade ? ` + ${reais(p.adicional_por_unidade)} por ${p.unidade || "unidade"} adicional` : ""}`;
    case "por_unidade": return `${reais(p.valor || 0)} + ${reais(p.valor_unidade || 0)} por ${p.unidade || "unidade"}`;
    case "faixa": return `entre ${reais(p.min || 0)} e ${reais(p.max || 0)}`;
    case "visita_tecnica": return `exige visita técnica (${p.valor_visita ? reais(p.valor_visita) : "gratuita"})`;
    default: return "preço a confirmar";
  }
}

export function montarPrompt(empresa) {
  const { negocio, servicos, faq, regras, horario } = empresa;
  const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const listaServicos = servicos.map((s) =>
    `- [${s.id}] ${s.nome}: ${s.descricao || ""} Preço: ${descreverPreco(s.preco)}. Duração: ~${s.duracao_min || 60} min.` +
    (s.perguntas?.length ? ` Perguntas para entender o pedido: ${s.perguntas.join(" | ")}` : "")
  ).join("\n");
  const listaFaq = faq.length ? faq.map((f) => `- ${f.pergunta} → ${f.resposta}`).join("\n") : "- (nenhuma cadastrada)";
  const pagamento = empresa.integracoes.pagamento?.tipo || "nenhum";

  return `Você é o atendente comercial da empresa "${negocio.nome}" no WhatsApp.${negocio.descricao ? ` Sobre a empresa: ${negocio.descricao}` : ""}
Tom de voz: ${negocio.tom}. Escreva como numa conversa de WhatsApp: mensagens curtas (até 3 frases), sem markdown, sem listas longas, no máximo um emoji quando fizer sentido.

# Seu objetivo
Entender o que o cliente precisa, tirar dúvidas, enviar o orçamento, negociar dentro das regras e agendar o serviço${pagamento !== "nenhum" ? " com o sinal pago" : ""}.

# Serviços oferecidos
${listaServicos}

# Perguntas frequentes
${listaFaq}

# Atendimento
- Área atendida: ${negocio.area_atendida?.length ? negocio.area_atendida.join(", ") : "não informada (não recuse por localização)"}.
- Expediente: ${horario.dias.map((d) => dias[d]).join(", ")}, das ${horario.inicio} às ${horario.fim}.
${regras.pacotes ? `- Pacotes e condições especiais: ${regras.pacotes}\n` : ""}${regras.observacoes ? `- Observações: ${regras.observacoes}\n` : ""}
# Regras obrigatórias
1. Nunca invente preço, prazo, horário ou condição. Valores vêm SEMPRE da ferramenta calcular_orcamento; horários vêm de horarios_livres.
2. Antes de orçar, faça as perguntas do serviço (uma ou duas por mensagem, não um questionário).
3. Para serviço com visita técnica, ofereça agendar a visita em vez de dar preço.
4. Negociação: antes de dar desconto, ofereça alternativas (horário de menor procura, pacote, reduzir o escopo). Desconto só pela ferramenta aplicar_desconto; se ela recusar, não insista nem prometa.
5. Ao sugerir horários, ofereça 2 ou 3 opções da ferramenta horarios_livres; só agende depois que o cliente escolher.
${pagamento !== "nenhum" ? `6. Depois de agendar, gere a cobrança do sinal de ${regras.sinal_percentual}% com gerar_cobranca_sinal.\n` : ""}7. Mantenha a etapa do cliente atualizada com registrar_lead (etapas: ${ETAPAS.join(", ")}), e salve o nome dele quando souber.
8. Chame a equipe com chamar_humano quando: ${regras.transferir_quando}. Também quando não souber responder. Depois disso, avise o cliente que uma pessoa vai responder.
9. Termine as mensagens com uma pergunta simples que ajude o cliente a avançar.
10. Se o cliente pedir para não receber mais mensagens, registre etapa "perdido" e encerre com educação.`;
}

export function montarFerramentas(empresa) {
  const ids = [...new Set(empresa.servicos.map((s) => s.id).filter(Boolean))];
  const servicoId = ids.length ? { type: "string", enum: ids } : { type: "string" };
  const pagamento = empresa.integracoes.pagamento?.tipo || "nenhum";
  const f = [
    {
      name: "calcular_orcamento",
      description: "Calcula o preço de um serviço pela tabela da empresa. Use sempre antes de informar qualquer valor.",
      input_schema: {
        type: "object",
        properties: {
          servico_id: servicoId,
          quantidade: { type: "integer", description: "Quantidade de unidades do serviço (veja a unidade na lista de serviços). Padrão 1." },
          urgente: { type: "boolean", description: "Cliente quer para hoje/urgente." },
          fim_de_semana: { type: "boolean", description: "Serviço no sábado ou domingo." },
        },
        required: ["servico_id"],
        additionalProperties: false,
      },
    },
    {
      name: "aplicar_desconto",
      description: "Pede aprovação de um desconto percentual sobre um valor já orçado. Retorna se foi aprovado e o valor final.",
      input_schema: {
        type: "object",
        properties: {
          valor_original: { type: "number" },
          percentual: { type: "number", description: "Desconto em %, ex.: 5" },
          motivo: { type: "string" },
        },
        required: ["valor_original", "percentual", "motivo"],
        additionalProperties: false,
      },
    },
    {
      name: "horarios_livres",
      description: "Lista horários disponíveis na agenda para um serviço.",
      input_schema: {
        type: "object",
        properties: {
          servico_id: servicoId,
          a_partir_de: { type: "string", description: "Data/hora ISO 8601 a partir da qual buscar (opcional)." },
        },
        required: ["servico_id"],
        additionalProperties: false,
      },
    },
    {
      name: "agendar",
      description: "Agenda o serviço (ou a visita técnica) num horário escolhido pelo cliente, vindo de horarios_livres.",
      input_schema: {
        type: "object",
        properties: {
          servico_id: servicoId,
          inicio: { type: "string", description: "Horário ISO 8601 exatamente como veio de horarios_livres." },
          nome_cliente: { type: "string" },
          endereco: { type: "string" },
          valor: { type: "number", description: "Valor combinado, se houver." },
        },
        required: ["servico_id", "inicio", "nome_cliente"],
        additionalProperties: false,
      },
    },
    {
      name: "registrar_lead",
      description: "Atualiza os dados e a etapa do cliente no funil.",
      input_schema: {
        type: "object",
        properties: {
          etapa: { type: "string", enum: ETAPAS },
          nome: { type: "string" },
          servico_id: servicoId,
          valor: { type: "number", description: "Valor orçado ou combinado." },
          observacao: { type: "string" },
        },
        required: ["etapa"],
        additionalProperties: false,
      },
    },
    {
      name: "chamar_humano",
      description: "Passa a conversa para a equipe. A IA para de responder este cliente até a equipe devolver.",
      input_schema: {
        type: "object",
        properties: {
          motivo: { type: "string" },
          resumo: { type: "string", description: "Resumo da conversa para quem vai assumir." },
        },
        required: ["motivo", "resumo"],
        additionalProperties: false,
      },
    },
  ];
  if (pagamento !== "nenhum") {
    f.push({
      name: "gerar_cobranca_sinal",
      description: "Gera a cobrança do sinal (link de pagamento ou chave Pix) depois de agendar.",
      input_schema: {
        type: "object",
        properties: {
          valor_total: { type: "number", description: "Valor total combinado do serviço; o sinal é calculado pela regra da empresa." },
          descricao: { type: "string" },
        },
        required: ["valor_total", "descricao"],
        additionalProperties: false,
      },
    });
  }
  return f;
}

// O que já está pronto e o que falta, para o painel mostrar.
export function checklist(empresa) {
  const { integracoes: i, negocio, servicos, followup } = empresa;
  const itens = [
    { item: "Nome da empresa", ok: !!negocio.nome },
    { item: "Pelo menos um serviço com preço", ok: servicos.some((s) => s.preco?.tipo) },
    { item: "Chave da API da Anthropic (IA)", ok: !!i.ia.chave, dica: "console.anthropic.com → API Keys" },
    { item: "WhatsApp: token de acesso", ok: !!i.whatsapp.token, dica: "Meta for Developers → seu app → WhatsApp → Configuração da API" },
    { item: "WhatsApp: ID do número de telefone", ok: !!i.whatsapp.numero_id },
    { item: "WhatsApp: segredo do app (valida o webhook)", ok: !!i.whatsapp.app_secret, opcional: true, dica: "Configurações do app → Básico → Chave secreta do app" },
    { item: "Pagamento do sinal", ok: i.pagamento.tipo === "nenhum" || (i.pagamento.tipo === "pix_manual" ? !!i.pagamento.chave_pix : !!i.pagamento.mp_token), opcional: true },
    { item: "WhatsApp do dono (recebe os avisos de transferência)", ok: !!negocio.whatsapp_dono, opcional: true },
    { item: "Modelo aprovado de follow-up (mensagem fora das 24h)", ok: !followup.ativo || !!followup.modelo, opcional: true, dica: "Gerenciador do WhatsApp → Modelos de mensagem; variável {{1}} = nome do cliente" },
    { item: "Modelo aprovado de lembrete de agendamento", ok: !followup.ativo || !!followup.modelo_lembrete, opcional: true, dica: "Categoria Utilidade; {{1}} = nome, {{2}} = data e hora" },
    { item: "Webhook de saída (n8n, Zapier, Make)", ok: !!i.webhook_saida.url, opcional: true },
  ];
  const pronto = itens.filter((x) => !x.opcional).every((x) => x.ok);
  return { pronto, itens };
}
