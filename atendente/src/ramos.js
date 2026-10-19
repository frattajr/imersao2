// Modelos prontos por ramo. Ao criar uma empresa, o painel copia o modelo
// escolhido e a pessoa só ajusta preços e detalhes.
import crypto from "node:crypto";

export const RAMOS = {
  limpeza: {
    nome: "Limpeza / diarista",
    tom: "cordial, acolhedor e direto; trata o cliente por você",
    servicos: [
      { id: "padrao", nome: "Limpeza padrão", descricao: "Limpeza completa de casa ou apartamento.",
        preco: { tipo: "por_unidade", valor: 150, unidade: "cômodo extra", valor_unidade: 35 },
        duracao_min: 300, perguntas: ["Quantos quartos e banheiros?", "Tem pets?", "Qual data prefere?"] },
      { id: "pos_obra", nome: "Limpeza pós-obra", descricao: "Remoção de pó de obra, respingos e resíduos.",
        preco: { tipo: "visita_tecnica", valor_visita: 0, abate_no_servico: true },
        duracao_min: 480, perguntas: ["Metragem aproximada?", "Pode mandar fotos do local?"] },
    ],
    faq: [
      { pergunta: "Levam os produtos?", resposta: "Sim, levamos todos os produtos e equipamentos." },
      { pergunta: "Precisa estar em casa?", resposta: "Não é obrigatório; combinamos a entrega da chave." },
    ],
  },
  eletricista: {
    nome: "Eletricista",
    tom: "objetivo, técnico mas simples, passa segurança",
    servicos: [
      { id: "tomada", nome: "Instalação de tomada", descricao: "Instalação ou troca de tomada/interruptor.",
        preco: { tipo: "fixo", valor: 80, adicional_por_unidade: 40, unidade: "tomada" },
        duracao_min: 60, perguntas: ["Quantas tomadas?", "Já existe fiação no local?"] },
      { id: "chuveiro", nome: "Instalação de chuveiro", descricao: "Instalação de chuveiro elétrico.",
        preco: { tipo: "fixo", valor: 120 }, duracao_min: 60, perguntas: ["O chuveiro já foi comprado?"] },
      { id: "quadro", nome: "Troca de quadro de disjuntores", descricao: "Avaliação e troca do quadro.",
        preco: { tipo: "visita_tecnica", valor_visita: 60, abate_no_servico: true },
        duracao_min: 240, perguntas: ["O imóvel é casa ou apartamento?", "Quantos disjuntores tem hoje?"] },
    ],
    faq: [
      { pergunta: "Tem garantia?", resposta: "Sim, 90 dias de garantia no serviço." },
      { pergunta: "Aceita cartão?", resposta: "Sim, em até 6x no cartão, ou Pix." },
    ],
  },
  estetica: {
    nome: "Clínica de estética / beleza",
    tom: "simpático, caloroso e profissional",
    servicos: [
      { id: "limpeza_pele", nome: "Limpeza de pele", descricao: "Limpeza profunda com extração e máscara.",
        preco: { tipo: "fixo", valor: 180 }, duracao_min: 90, perguntas: ["Já fez limpeza de pele antes?"] },
      { id: "massagem", nome: "Massagem relaxante", descricao: "Sessão de 60 minutos.",
        preco: { tipo: "faixa", min: 120, max: 160 }, duracao_min: 60, perguntas: ["Prefere manhã ou tarde?"] },
    ],
    faq: [{ pergunta: "Tem estacionamento?", resposta: "Sim, gratuito para clientes." }],
  },
  generico: {
    nome: "Outro tipo de serviço",
    tom: "cordial e direto",
    servicos: [
      { id: "servico", nome: "Meu serviço", descricao: "Descreva o serviço.",
        preco: { tipo: "faixa", min: 100, max: 300 }, duracao_min: 60, perguntas: ["O que você precisa?"] },
    ],
    faq: [],
  },
};

export function novaEmpresa({ id, nome, ramo }) {
  const modelo = RAMOS[ramo] || RAMOS.generico;
  return {
    id,
    criado_em: new Date().toISOString(),
    negocio: {
      nome, ramo: RAMOS[ramo] ? ramo : "generico", descricao: "", tom: modelo.tom,
      area_atendida: [], whatsapp_dono: "", fuso: "America/Sao_Paulo",
    },
    horario: { dias: [1, 2, 3, 4, 5], inicio: "08:00", fim: "18:00", passo_min: 60, antecedencia_horas: 2 },
    servicos: structuredClone(modelo.servicos),
    faq: structuredClone(modelo.faq),
    regras: {
      desconto_max: 10, urgencia_percentual: 30, fim_de_semana_percentual: 20, sinal_percentual: 30,
      pacotes: "", observacoes: "",
      transferir_quando: "reclamação, pedido fora da área atendida, cliente pede para falar com uma pessoa",
    },
    followup: { ativo: true, dias: [1, 3], modelo: "", modelo_lembrete: "", idioma: "pt_BR" },
    integracoes: {
      ia: { chave: "", modelo: "claude-opus-5-5", esforco: "low" },
      whatsapp: { token: "", numero_id: "", app_secret: "", versao: "v23.0",
        verify_token: crypto.randomBytes(12).toString("hex") },
      pagamento: { tipo: "pix_manual", chave_pix: "", mp_token: "" },
      webhook_saida: { url: "" },
    },
  };
}
