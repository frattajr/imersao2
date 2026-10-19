// Conector do WhatsApp Cloud API (oficial, da Meta).
import crypto from "node:crypto";

const url = (cfg, caminho) => `https://graph.facebook.com/${cfg.versao || "v23.0"}/${caminho}`;

async function chamar(cfg, caminho, corpo, metodo = "POST") {
  const r = await fetch(url(cfg, caminho), {
    method: metodo,
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${dados.error?.message || JSON.stringify(dados)}`);
  return dados;
}

export const configurado = (cfg) => !!(cfg?.token && cfg?.numero_id);

export function enviarTexto(cfg, para, texto) {
  return chamar(cfg, `${cfg.numero_id}/messages`, {
    messaging_product: "whatsapp", to: para, type: "text", text: { body: texto, preview_url: true },
  });
}

export function enviarModelo(cfg, para, nome, idioma, variaveis = []) {
  return chamar(cfg, `${cfg.numero_id}/messages`, {
    messaging_product: "whatsapp", to: para, type: "template",
    template: {
      name: nome, language: { code: idioma || "pt_BR" },
      components: variaveis.length
        ? [{ type: "body", parameters: variaveis.map((v) => ({ type: "text", text: String(v) })) }]
        : [],
    },
  });
}

export function marcarLida(cfg, idMensagem) {
  return chamar(cfg, `${cfg.numero_id}/messages`, {
    messaging_product: "whatsapp", status: "read", message_id: idMensagem,
  }).catch(() => {});
}

export const testar = (cfg) => chamar(cfg, `${cfg.numero_id}?fields=display_phone_number,verified_name`, null, "GET");

// Confere a assinatura X-Hub-Signature-256 enviada pela Meta.
export function assinaturaValida(appSecret, corpoBruto, cabecalho) {
  if (!appSecret) return true; // sem segredo configurado, não dá para validar
  if (!cabecalho || !corpoBruto) return false;
  const esperado = "sha256=" + crypto.createHmac("sha256", appSecret).update(corpoBruto).digest("hex");
  const a = Buffer.from(esperado), b = Buffer.from(String(cabecalho));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const DESCRICAO_MIDIA = {
  image: "[o cliente enviou uma foto]", audio: "[o cliente enviou um áudio]", video: "[o cliente enviou um vídeo]",
  document: "[o cliente enviou um documento]", sticker: "[o cliente enviou uma figurinha]", location: "[o cliente enviou uma localização]",
};

// Extrai as mensagens recebidas do corpo do webhook.
export function extrairMensagens(corpo) {
  const saida = [];
  for (const entrada of corpo?.entry || []) {
    for (const mudanca of entrada.changes || []) {
      const v = mudanca.value || {};
      const nomes = Object.fromEntries((v.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages || []) {
        let texto = m.text?.body
          ?? m.button?.text
          ?? m.interactive?.button_reply?.title
          ?? m.interactive?.list_reply?.title;
        if (texto == null) {
          texto = DESCRICAO_MIDIA[m.type] || `[mensagem do tipo ${m.type}]`;
          if (m.image?.caption) texto += ` com a legenda: "${m.image.caption}"`;
          if (m.location) texto += ` (${m.location.latitude}, ${m.location.longitude}${m.location.address ? ", " + m.location.address : ""})`;
        }
        saida.push({ id: m.id, de: m.from, nome: nomes[m.from] || "", texto });
      }
    }
  }
  return saida;
}
