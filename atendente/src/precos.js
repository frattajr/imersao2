// Motor de preços genérico: cobre a maioria dos serviços com 4 tipos de preço.
// Toda conta é feita aqui, nunca pela IA.

export const reais = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const arred = (v) => Math.round(v * 100) / 100;
const num = (v, padrao = 0) => (Number.isFinite(Number(v)) ? Number(v) : padrao);

export function calcularOrcamento(servico, { quantidade = 1, urgente = false, fim_de_semana = false } = {}, regras = {}) {
  const p = servico.preco || {};
  const q = Math.max(0, Math.floor(num(quantidade, 1)));
  let fator = 1;
  const ajustes = [];
  if (urgente && num(regras.urgencia_percentual)) {
    fator *= 1 + num(regras.urgencia_percentual) / 100;
    ajustes.push(`urgência +${num(regras.urgencia_percentual)}%`);
  }
  if (fim_de_semana && num(regras.fim_de_semana_percentual)) {
    fator *= 1 + num(regras.fim_de_semana_percentual) / 100;
    ajustes.push(`fim de semana +${num(regras.fim_de_semana_percentual)}%`);
  }
  const sufixo = ajustes.length ? ` (inclui ${ajustes.join(", ")})` : "";
  const base = { servico_id: servico.id, servico: servico.nome, tipo: p.tipo, ajustes };

  switch (p.tipo) {
    case "fixo": {
      const extra = q > 1 ? (q - 1) * num(p.adicional_por_unidade) : 0;
      const valor = arred((num(p.valor) + extra) * fator);
      return { ...base, valor, resumo: `${servico.nome}${q > 1 ? ` (${q} ${p.unidade || "unidades"})` : ""}: ${reais(valor)}${sufixo}` };
    }
    case "por_unidade": {
      const valor = arred((num(p.valor) + q * num(p.valor_unidade)) * fator);
      return { ...base, valor, resumo: `${servico.nome} com ${q} ${p.unidade || "unidade(s)"}: ${reais(valor)}${sufixo}` };
    }
    case "faixa": {
      const min = arred(num(p.min) * fator);
      const max = arred(num(p.max) * fator);
      return { ...base, min, max, resumo: `${servico.nome}: entre ${reais(min)} e ${reais(max)}, valor final confirmado no local${sufixo}` };
    }
    case "visita_tecnica": {
      const visita = num(p.valor_visita);
      const texto = visita === 0 ? "visita técnica gratuita" : `visita técnica de ${reais(visita)}${p.abate_no_servico ? " (abatida do valor do serviço se fechar)" : ""}`;
      return { ...base, valor_visita: visita, precisa_visita: true, resumo: `${servico.nome}: o orçamento é feito após ${texto}` };
    }
    default:
      return { ...base, erro: "serviço sem preço configurado", resumo: `${servico.nome}: preço a confirmar com a equipe` };
  }
}

export function avaliarDesconto(valorOriginal, percentual, regras = {}) {
  const maximo = num(regras.desconto_max);
  const pedido = num(percentual);
  const valor = num(valorOriginal);
  if (pedido <= 0) return { aprovado: false, motivo: "percentual inválido", maximo };
  if (pedido > maximo) {
    return { aprovado: false, maximo, motivo: `acima do limite de ${maximo}% (ofereça no máximo ${maximo}% ou chame a equipe)` };
  }
  const valor_final = arred(valor * (1 - pedido / 100));
  return { aprovado: true, percentual: pedido, valor_original: valor, valor_final, resumo: `${reais(valor)} com ${pedido}% de desconto = ${reais(valor_final)}` };
}

export function valorSinal(valor, regras = {}) {
  return arred(num(valor) * num(regras.sinal_percentual) / 100);
}
