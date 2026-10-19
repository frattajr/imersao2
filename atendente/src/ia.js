// Conversa com o Claude: monta a chamada a partir da estrutura gerada,
// executa as ferramentas e devolve o texto para enviar ao cliente.
import Anthropic from "@anthropic-ai/sdk";
import { montarFerramentas, montarPrompt } from "./estrutura.js";
import { executarFerramenta } from "./ferramentas.js";

export const MODELOS = {
  "claude-opus-5-5": "Claude Opus 5.5 (melhor qualidade)",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 (metade do custo do Opus)",
  "claude-haiku-5-5": "Claude Haiku 5.5 (mais barato, para atendimento simples)",
};
// Haiku não tem troca automática de modelo quando recusa um pedido.
const COM_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);
const MAX_VOLTAS = 8;
const RESPOSTA_RESERVA = "Vou pedir para alguém da equipe continuar seu atendimento, tudo bem? Já já te respondemos.";

const clientes = new Map();
function cliente(chave) {
  if (!clientes.has(chave)) clientes.set(chave, new Anthropic({ apiKey: chave }));
  return clientes.get(chave);
}

/**
 * mensagens: histórico completo da conversa (é alterado no lugar; salve depois).
 * Só acrescenta itens no fim, nunca edita os anteriores, como a API exige.
 */
export async function responder({ empresa, mensagens, textoCliente, ctx }) {
  const ia = empresa.integracoes.ia;
  if (!ia.chave) throw new Error("chave da API da Anthropic não configurada");
  const modelo = MODELOS[ia.modelo] ? ia.modelo : "claude-opus-5-5";
  const parametros = {
    model: modelo,
    max_tokens: 16000,
    system: montarPrompt(empresa),
    tools: montarFerramentas(empresa),
    cache_control: { type: "ephemeral" }, // o prompt fixo e o histórico ficam em cache (bem mais barato)
    thinking: { type: "adaptive" },
    output_config: { effort: ia.esforco || "low" },
  };
  if (COM_FALLBACK.has(modelo)) {
    parametros.betas = ["server-side-fallback-2026-07-01"];
    parametros.fallbacks = "default";
  }

  mensagens.push({ role: "user", content: textoCliente });
  const uso = { entrada: 0, saida: 0, cache_lido: 0, cache_gravado: 0, chamadas: 0 };

  for (let volta = 0; volta < MAX_VOLTAS; volta++) {
    const r = await cliente(ia.chave).beta.messages.create({ ...parametros, messages: mensagens });
    uso.chamadas++;
    uso.entrada += r.usage.input_tokens || 0;
    uso.saida += r.usage.output_tokens || 0;
    uso.cache_lido += r.usage.cache_read_input_tokens || 0;
    uso.cache_gravado += r.usage.cache_creation_input_tokens || 0;

    if (r.stop_reason === "refusal") {
      return { texto: RESPOSTA_RESERVA, uso, recusado: true };
    }
    mensagens.push({ role: "assistant", content: r.content });

    if (r.stop_reason === "pause_turn") continue;
    if (r.stop_reason !== "tool_use") {
      const texto = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      return { texto, uso };
    }

    const resultados = [];
    for (const bloco of r.content.filter((b) => b.type === "tool_use")) {
      const { conteudo, erro } = await executarFerramenta(bloco.name, bloco.input, ctx);
      resultados.push({ type: "tool_result", tool_use_id: bloco.id, content: conteudo, ...(erro ? { is_error: true } : {}) });
    }
    mensagens.push({ role: "user", content: resultados });
  }
  return { texto: RESPOSTA_RESERVA, uso, limite: true };
}

export async function testarChave(chave, modelo) {
  const m = await cliente(chave).models.retrieve(modelo || "claude-opus-5-5");
  return { ok: true, detalhe: m.display_name || m.id };
}
