// Conectores de pagamento do sinal. Todos devolvem { texto, link?, id? }.
import { reais } from "./precos.js";

async function mercadoPago(cfg, valor, descricao, referencia) {
  const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.mp_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: descricao.slice(0, 250), quantity: 1, unit_price: valor, currency_id: "BRL" }],
      external_reference: referencia,
    }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${d.message || JSON.stringify(d)}`);
  return { id: d.id, link: d.init_point, texto: `Link de pagamento do sinal (${reais(valor)}): ${d.init_point}` };
}

export async function gerarCobranca(cfg, valor, descricao, referencia) {
  switch (cfg?.tipo) {
    case "mercadopago":
      if (!cfg.mp_token) throw new Error("token do Mercado Pago não configurado");
      return mercadoPago(cfg, valor, descricao, referencia);
    case "pix_manual":
      if (!cfg.chave_pix) throw new Error("chave Pix não configurada");
      return { texto: `Sinal de ${reais(valor)} via Pix para a chave: ${cfg.chave_pix}. Peça para o cliente enviar o comprovante aqui.` };
    default:
      throw new Error("pagamento desativado para esta empresa");
  }
}

export async function testar(cfg) {
  if (cfg?.tipo !== "mercadopago") return { ok: true, detalhe: cfg?.tipo === "pix_manual" ? "Pix manual (sem API)" : "desativado" };
  const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${cfg.mp_token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${d.message || "token inválido"}`);
  return { ok: true, detalhe: d.nickname || d.email || "conta conectada" };
}
