// Eventos do funil: ficam registrados para o painel e são enviados ao
// webhook de saída da empresa (n8n, Make, Zapier, CRM...), se houver.
import { alterarEventos } from "./armazem.js";

export async function publicar(empresa, tipo, dados) {
  const evento = { tipo, empresa_id: empresa.id, empresa: empresa.negocio.nome, em: new Date().toISOString(), dados };
  await alterarEventos(empresa.id, (lista) => {
    lista.unshift(evento);
    lista.length = Math.min(lista.length, 200);
  });
  const url = empresa.integracoes.webhook_saida?.url;
  if (url) {
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(evento), signal: AbortSignal.timeout(10000) })
      .catch((e) => console.warn(`[${empresa.id}] webhook de saída falhou: ${e.message}`));
  }
  return evento;
}
