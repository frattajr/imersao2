// Painel: edita os dados da empresa e mostra a estrutura que o servidor montou.
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const reais = (v) => (v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

let opcoes = { ramos: {}, modelos: {} };
let empresa = null;
let aba = "negocio";
let alterado = false;

async function api(caminho, { metodo = "GET", corpo } = {}) {
  const r = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 204) return null;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || `erro ${r.status}`);
  return d;
}

function aviso(texto) {
  const el = $("#aviso");
  el.textContent = texto;
  el.classList.add("mostrar");
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => el.classList.remove("mostrar"), 3000);
}

// ---------- caminho "a.b.c" dentro do objeto ----------
const ler = (obj, caminho) => caminho.split(".").reduce((o, k) => o?.[k], obj);
function gravar(obj, caminho, valor) {
  const ks = caminho.split(".");
  const ult = ks.pop();
  ks.reduce((o, k) => (o[k] ??= {}), obj)[ult] = valor;
}
function converter(el) {
  const t = el.dataset.tipo;
  if (el.type === "checkbox") return el.checked;
  if (t === "bool") return el.value === "true";
  if (t === "num") return el.value === "" ? null : Number(el.value);
  if (t === "lista") return el.value.split(",").map((x) => x.trim()).filter(Boolean);
  if (t === "linhas") return el.value.split("\n").map((x) => x.trim()).filter(Boolean);
  if (t === "nums") return el.value.split(",").map((x) => Number(x.trim())).filter((n) => n > 0);
  return el.value;
}
function mostrarValor(v, t) {
  if (Array.isArray(v)) return t === "linhas" ? v.join("\n") : v.join(", ");
  return v ?? "";
}
function campo(rotulo, caminho, { tipo = "texto", dica = "", attrs = "", lista } = {}) {
  const v = ler(empresa, caminho);
  let input;
  if (lista) {
    input = `<select data-campo="${caminho}">${Object.entries(lista).map(([k, n]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
  } else if (tipo === "area" || tipo === "linhas") {
    input = `<textarea data-campo="${caminho}" data-tipo="${tipo}" ${attrs}>${esc(mostrarValor(v, tipo))}</textarea>`;
  } else {
    const tp = tipo === "num" ? "number" : tipo === "senha" ? "password" : tipo === "hora" ? "time" : "text";
    input = `<input type="${tp}" data-campo="${caminho}" data-tipo="${tipo}" value="${esc(mostrarValor(v, tipo))}" ${attrs} ${tipo === "senha" ? 'autocomplete="off"' : ""}>`;
  }
  return `<label>${esc(rotulo)}${input}</label>${dica ? `<p class="dica">${dica}</p>` : ""}`;
}

// ---------- lista de empresas ----------
async function carregarLista() {
  const lista = await api("/empresas");
  $("#lista-empresas").innerHTML = lista.map((e) =>
    `<li><button data-id="${e.id}" class="${empresa?.id === e.id ? "ativa" : ""}"><span>${esc(e.nome)}</span><span class="${e.pronto ? "ok" : "opc"}" title="${e.pronto ? "pronta" : "falta configurar"}">${e.pronto ? "●" : "○"}</span></button></li>`
  ).join("") || '<li class="dica">Nenhuma ainda.</li>';
}

$("#lista-empresas").addEventListener("click", (ev) => {
  const b = ev.target.closest("button[data-id]");
  if (b) abrir(b.dataset.id);
});

$("#form-nova").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = new FormData(ev.target);
  try {
    const e = await api("/empresas", { metodo: "POST", corpo: { nome: f.get("nome"), ramo: f.get("ramo") } });
    ev.target.reset();
    await abrir(e.id, "estrutura");
    aviso("Empresa criada e estrutura montada. Agora preencha as integrações.");
  } catch (err) { aviso(err.message); }
});

async function abrir(id, abaInicial) {
  if (alterado && !confirm("Há alterações não salvas. Descartar?")) return;
  empresa = await api(`/empresas/${id}`);
  alterado = false;
  aba = abaInicial || aba;
  await carregarLista();
  render();
}

// ---------- abas ----------
const ABAS = {
  negocio: "1. Negócio", servicos: "2. Serviços", regras: "3. Regras e follow-up", integracoes: "4. APIs e integrações",
  estrutura: "Estrutura gerada", teste: "Testar conversa", clientes: "Clientes e agenda", eventos: "Eventos",
};
const EDITAVEIS = new Set(["negocio", "servicos", "regras", "integracoes"]);

function render() {
  const p = $("#principal");
  p.innerHTML = `
    <div class="cabecalho">
      <h1>${esc(empresa.negocio.nome)}</h1>
      <button class="perigo pequeno" id="apagar">Apagar empresa</button>
    </div>
    <nav class="abas">${Object.entries(ABAS).map(([k, n]) => `<button data-aba="${k}" class="${k === aba ? "ativa" : ""}">${n}</button>`).join("")}</nav>
    <section id="conteudo"></section>
    ${EDITAVEIS.has(aba) ? '<div class="rodape-salvar"><button class="primario" id="salvar">Salvar e remontar estrutura</button></div>' : ""}`;
  ({ negocio: abaNegocio, servicos: abaServicos, regras: abaRegras, integracoes: abaIntegracoes,
    estrutura: abaEstrutura, teste: abaTeste, clientes: abaClientes, eventos: abaEventos })[aba]($("#conteudo"));
}

$("#principal").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.aba) {
    if (alterado && !EDITAVEIS.has(b.dataset.aba) && !confirm("Há alterações não salvas. Sair da aba mesmo assim?")) return;
    aba = b.dataset.aba;
    render();
  } else if (b.id === "salvar") {
    await salvar();
  } else if (b.id === "apagar") {
    if (!confirm(`Apagar "${empresa.negocio.nome}" com todas as conversas e clientes?`)) return;
    await api(`/empresas/${empresa.id}`, { metodo: "DELETE" });
    empresa = null; alterado = false;
    await carregarLista();
    $("#principal").innerHTML = '<div class="vazio"><h1>Empresa apagada</h1></div>';
  }
});

$("#principal").addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.campo) { gravar(empresa, el.dataset.campo, converter(el)); alterado = true; }
});
$("#principal").addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.campo) { gravar(empresa, el.dataset.campo, converter(el)); alterado = true; }
  if (el.dataset.rerender) render();
});

async function salvar() {
  try {
    empresa = await api(`/empresas/${empresa.id}`, { metodo: "PUT", corpo: empresa });
    alterado = false;
    await carregarLista();
    render();
    aviso("Salvo. Prompt, ferramentas e webhook foram remontados.");
  } catch (err) { aviso(err.message); }
}

// ---------- 1. negócio ----------
function abaNegocio(el) {
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  el.innerHTML = `
    <div class="cartao"><h3>Sobre a empresa</h3><div class="grade">
      ${campo("Nome", "negocio.nome")}
      ${campo("Ramo", "negocio.ramo", { lista: opcoes.ramos })}
      ${campo("WhatsApp do dono (recebe avisos)", "negocio.whatsapp_dono", { attrs: 'placeholder="5511999999999"' })}
      ${campo("Fuso horário", "negocio.fuso")}
    </div>
    ${campo("Descrição curta", "negocio.descricao", { tipo: "area", attrs: 'placeholder="Ex.: Eletricista com 15 anos de experiência, atende residências e comércios."' })}
    ${campo("Tom de voz da IA", "negocio.tom")}
    ${campo("Bairros/cidades atendidos (separe por vírgula)", "negocio.area_atendida", { tipo: "lista" })}
    </div>
    <div class="cartao"><h3>Expediente (a IA só oferece horários dentro dele)</h3>
      <div class="dias">${dias.map((d, i) => `<label><input type="checkbox" data-dia="${i}" ${empresa.horario.dias.includes(i) ? "checked" : ""}> ${d}</label>`).join("")}</div>
      <div class="grade">
        ${campo("Início", "horario.inicio", { tipo: "hora" })}
        ${campo("Fim", "horario.fim", { tipo: "hora" })}
        ${campo("Intervalo entre horários (min)", "horario.passo_min", { tipo: "num" })}
        ${campo("Antecedência mínima (horas)", "horario.antecedencia_horas", { tipo: "num" })}
      </div>
    </div>`;
  el.querySelectorAll("[data-dia]").forEach((c) => c.addEventListener("change", () => {
    empresa.horario.dias = [...el.querySelectorAll("[data-dia]:checked")].map((x) => Number(x.dataset.dia));
    alterado = true;
  }));
}

// ---------- 2. serviços ----------
const TIPOS_PRECO = { fixo: "Preço fixo", por_unidade: "Base + valor por unidade", faixa: "Faixa (mín–máx)", visita_tecnica: "Só com visita técnica" };
function camposPreco(i) {
  const p = `servicos.${i}.preco`;
  switch (empresa.servicos[i].preco?.tipo) {
    case "fixo": return campo("Valor (R$)", `${p}.valor`, { tipo: "num" }) + campo("Adicional por unidade extra (R$)", `${p}.adicional_por_unidade`, { tipo: "num" }) + campo("Nome da unidade", `${p}.unidade`, { attrs: 'placeholder="tomada"' });
    case "por_unidade": return campo("Valor base (R$)", `${p}.valor`, { tipo: "num" }) + campo("Valor por unidade (R$)", `${p}.valor_unidade`, { tipo: "num" }) + campo("Nome da unidade", `${p}.unidade`, { attrs: 'placeholder="m², cômodo, hora"' });
    case "faixa": return campo("Mínimo (R$)", `${p}.min`, { tipo: "num" }) + campo("Máximo (R$)", `${p}.max`, { tipo: "num" });
    case "visita_tecnica": return campo("Valor da visita (R$, 0 = grátis)", `${p}.valor_visita`, { tipo: "num" }) +
      `<label>Abater a visita do serviço<select data-campo="${p}.abate_no_servico" data-tipo="bool"><option value="true" ${empresa.servicos[i].preco.abate_no_servico ? "selected" : ""}>Sim</option><option value="" ${!empresa.servicos[i].preco.abate_no_servico ? "selected" : ""}>Não</option></select></label>`;
    default: return "";
  }
}
function abaServicos(el) {
  el.innerHTML = `
    <div class="cartao"><h3>Serviços e preços</h3>
      <p class="dica">A IA nunca inventa preço: ela consulta esta tabela por uma ferramenta que faz a conta.</p>
      ${empresa.servicos.map((s, i) => `
        <div class="servico">
          <div class="cabecalho"><strong>${esc(s.nome || "Novo serviço")}</strong><button class="perigo pequeno" data-remover-servico="${i}">Remover</button></div>
          <div class="grade">
            ${campo("Nome", `servicos.${i}.nome`)}
            ${campo("Código (sem espaço)", `servicos.${i}.id`)}
            ${campo("Duração (min)", `servicos.${i}.duracao_min`, { tipo: "num" })}
            <label>Tipo de preço<select data-campo="servicos.${i}.preco.tipo" data-rerender="1">${Object.entries(TIPOS_PRECO).map(([k, n]) => `<option value="${k}" ${s.preco?.tipo === k ? "selected" : ""}>${n}</option>`).join("")}</select></label>
            ${camposPreco(i)}
          </div>
          ${campo("Descrição", `servicos.${i}.descricao`)}
          ${campo("Perguntas que a IA faz antes de orçar (uma por linha)", `servicos.${i}.perguntas`, { tipo: "linhas" })}
        </div>`).join("")}
      <button id="add-servico">+ Adicionar serviço</button>
    </div>
    <div class="cartao"><h3>Perguntas frequentes</h3>
      ${empresa.faq.map((f, i) => `<div class="linha-faq">
        <label>Pergunta<input data-campo="faq.${i}.pergunta" value="${esc(f.pergunta)}"></label>
        <label>Resposta<input data-campo="faq.${i}.resposta" value="${esc(f.resposta)}"></label>
        <button class="perigo pequeno" data-remover-faq="${i}">×</button></div>`).join("")}
      <button id="add-faq">+ Adicionar pergunta</button>
    </div>`;
  el.addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.id === "add-servico") empresa.servicos.push({ id: `servico_${empresa.servicos.length + 1}`, nome: "", descricao: "", preco: { tipo: "fixo", valor: 0 }, duracao_min: 60, perguntas: [] });
    else if (b.id === "add-faq") empresa.faq.push({ pergunta: "", resposta: "" });
    else if (b.dataset.removerServico) empresa.servicos.splice(Number(b.dataset.removerServico), 1);
    else if (b.dataset.removerFaq) empresa.faq.splice(Number(b.dataset.removerFaq), 1);
    else return;
    alterado = true;
    render();
  });
}

// ---------- 3. regras ----------
function abaRegras(el) {
  el.innerHTML = `
    <div class="cartao"><h3>Negociação</h3><div class="grade">
      ${campo("Desconto máximo que a IA pode dar (%)", "regras.desconto_max", { tipo: "num" })}
      ${campo("Acréscimo por urgência (%)", "regras.urgencia_percentual", { tipo: "num" })}
      ${campo("Acréscimo fim de semana (%)", "regras.fim_de_semana_percentual", { tipo: "num" })}
      ${campo("Sinal para confirmar (%)", "regras.sinal_percentual", { tipo: "num" })}
    </div>
    ${campo("Pacotes e condições especiais", "regras.pacotes", { tipo: "area", attrs: 'placeholder="Ex.: 4 limpezas por mês com 15% off; terça de manhã 10% mais barato"' })}
    ${campo("Quando passar para uma pessoa", "regras.transferir_quando", { tipo: "area" })}
    ${campo("Outras instruções para a IA", "regras.observacoes", { tipo: "area" })}
    </div>
    <div class="cartao"><h3>Follow-up e lembretes</h3>
      <label><input type="checkbox" data-campo="followup.ativo" ${empresa.followup.ativo ? "checked" : ""} style="display:inline;width:auto"> Enviar follow-up automático de orçamentos sem resposta</label>
      <div class="grade">
        ${campo("Dias após o orçamento (ex.: 1, 3)", "followup.dias", { tipo: "nums" })}
        ${campo("Nome do modelo de follow-up", "followup.modelo", { attrs: 'placeholder="retomar_orcamento"' })}
        ${campo("Nome do modelo de lembrete", "followup.modelo_lembrete", { attrs: 'placeholder="lembrete_agendamento"' })}
        ${campo("Idioma dos modelos", "followup.idioma")}
      </div>
      <p class="dica">Fora da janela de 24h o WhatsApp só aceita modelos aprovados pela Meta. Follow-up: {{1}} = nome. Lembrete (categoria Utilidade, mais barato): {{1}} = nome, {{2}} = data e hora.</p>
    </div>`;
}

// ---------- 4. integrações ----------
function abaIntegracoes(el) {
  const pg = empresa.integracoes.pagamento.tipo;
  el.innerHTML = `
    <div class="cartao"><h3>IA (Anthropic / Claude)</h3><div class="grade">
      ${campo("Chave da API", "integracoes.ia.chave", { tipo: "senha", attrs: 'placeholder="sk-ant-..."' })}
      ${campo("Modelo", "integracoes.ia.modelo", { lista: opcoes.modelos })}
      ${campo("Esforço de raciocínio", "integracoes.ia.esforco", { lista: { low: "Baixo (rápido e barato)", medium: "Médio", high: "Alto" } })}
    </div><p class="dica">Crie a chave em console.anthropic.com → API Keys.</p></div>
    <div class="cartao"><h3>WhatsApp Cloud API (oficial)</h3><div class="grade">
      ${campo("Token de acesso", "integracoes.whatsapp.token", { tipo: "senha" })}
      ${campo("ID do número de telefone", "integracoes.whatsapp.numero_id")}
      ${campo("Segredo do app (recomendado)", "integracoes.whatsapp.app_secret", { tipo: "senha" })}
      ${campo("Versão da API", "integracoes.whatsapp.versao")}
    </div><p class="dica">Meta for Developers → seu app → WhatsApp → Configuração da API. Use um token de usuário do sistema (não expira). A URL do webhook está na aba "Estrutura gerada".</p></div>
    <div class="cartao"><h3>Pagamento do sinal</h3>
      <label>Forma<select data-campo="integracoes.pagamento.tipo" data-rerender="1">
        ${Object.entries({ pix_manual: "Chave Pix (manual)", mercadopago: "Mercado Pago (link de pagamento)", nenhum: "Não cobrar sinal" }).map(([k, n]) => `<option value="${k}" ${pg === k ? "selected" : ""}>${n}</option>`).join("")}
      </select></label>
      ${pg === "pix_manual" ? campo("Chave Pix", "integracoes.pagamento.chave_pix") : ""}
      ${pg === "mercadopago" ? campo("Access token do Mercado Pago", "integracoes.pagamento.mp_token", { tipo: "senha", dica: "Mercado Pago Developers → Suas integrações → Credenciais de produção." }) : ""}
    </div>
    <div class="cartao"><h3>Webhook de saída (opcional)</h3>
      ${campo("URL que recebe os eventos (n8n, Make, Zapier, CRM)", "integracoes.webhook_saida.url", { attrs: 'placeholder="https://..."' })}
      <p class="dica">Cada orçamento, agendamento, cobrança e mudança de etapa é enviado em JSON para esta URL.</p>
    </div>
    <div class="cartao"><h3>Conferir conexões</h3>
      <p class="dica">Salve antes de testar.</p>
      <button id="testar-conexoes">Testar conexões</button>
      <ul class="check" id="resultado-conexoes"></ul>
    </div>`;
  $("#testar-conexoes").addEventListener("click", async () => {
    if (alterado) return aviso("Salve as alterações antes de testar.");
    const ul = $("#resultado-conexoes");
    ul.innerHTML = "<li>Testando…</li>";
    try {
      const r = await api(`/empresas/${empresa.id}/testar-conexoes`, { metodo: "POST" });
      ul.innerHTML = Object.entries({ ia: "IA", whatsapp: "WhatsApp", pagamento: "Pagamento" }).map(([k, n]) =>
        `<li><span class="s ${r[k].ok ? "ok" : "falta"}">${r[k].ok ? "✓" : "✗"}</span><span><strong>${n}:</strong> ${esc(r[k].detalhe)}</span></li>`).join("");
    } catch (err) { ul.innerHTML = `<li class="falta">${esc(err.message)}</li>`; }
  });
}

// ---------- estrutura gerada ----------
async function abaEstrutura(el) {
  el.innerHTML = "<p>Montando…</p>";
  const e = await api(`/empresas/${empresa.id}/estrutura`);
  const copiar = (rotulo, v) => `<label>${rotulo}</label><div class="copiar"><code>${esc(v)}</code><button class="pequeno" data-copiar="${esc(v)}">Copiar</button></div>`;
  el.innerHTML = `
    <div class="cartao"><h3>${e.checklist.pronto ? '<span class="ok">✓ Pronto para atender</span>' : '<span class="opc">Falta configurar</span>'}</h3>
      <ul class="check">${e.checklist.itens.map((x) => `<li><span class="s ${x.ok ? "ok" : x.opcional ? "opc" : "falta"}">${x.ok ? "✓" : x.opcional ? "○" : "✗"}</span><span>${esc(x.item)}${x.opcional ? " <small>(opcional)</small>" : ""}${!x.ok && x.dica ? `<br><small class="dica">${esc(x.dica)}</small>` : ""}</span></li>`).join("")}</ul>
    </div>
    <div class="cartao"><h3>Conectar o WhatsApp</h3>
      <p class="dica">No app da Meta → WhatsApp → Configuração → Webhook: cole os dois valores e assine o campo <strong>messages</strong>.</p>
      ${copiar("URL de retorno (callback)", e.webhook.url)}
      ${copiar("Token de verificação", e.webhook.verify_token)}
    </div>
    <div class="cartao"><h3>Prompt da IA (gerado dos seus dados)</h3><pre>${esc(e.prompt)}</pre></div>
    <div class="cartao"><h3>Ferramentas que a IA pode usar (${e.ferramentas.length})</h3>
      <ul class="check">${e.ferramentas.map((f) => `<li><span class="s ok">⚙</span><span><strong>${esc(f.name)}</strong> — ${esc(f.description)}</span></li>`).join("")}</ul>
    </div>
    <div class="cartao"><h3>Eventos enviados ao webhook de saída</h3><p>${e.eventos_webhook_saida.map((x) => `<span class="selo">${esc(x)}</span>`).join(" ")}</p></div>`;
  el.querySelectorAll("[data-copiar]").forEach((b) => b.addEventListener("click", () => {
    navigator.clipboard?.writeText(b.dataset.copiar).then(() => aviso("Copiado"), () => aviso("Não foi possível copiar"));
  }));
}

// ---------- testar ----------
function bolhas(linha) {
  return linha.map((m) => `<div class="bolha ${m.de}">${esc(m.texto)}<small>${m.de === "ia" ? "IA" : m.de === "equipe" ? "Equipe" : ""} ${dataHora(m.em)}${m.uso ? ` · ${m.uso.chamadas} chamada(s), ${m.uso.entrada + m.uso.cache_lido + m.uso.cache_gravado} tokens de entrada, ${m.uso.saida} de saída` : ""}</small></div>`).join("");
}
async function abaTeste(el) {
  el.innerHTML = `
    <div class="cartao"><h3>Converse como se fosse um cliente</h3>
      <p class="dica">Usa a IA, as ferramentas e a agenda de verdade, mas não envia nada pelo WhatsApp. Salve as alterações antes de testar.</p>
      <div class="chat" id="chat"></div>
      <form class="enviar" id="form-teste"><input id="msg-teste" placeholder="Ex.: Oi, quanto custa instalar 3 tomadas?" autocomplete="off"><button class="primario">Enviar</button></form>
      <p><button class="pequeno" id="reiniciar">Recomeçar conversa</button></p>
    </div>`;
  const chat = $("#chat");
  const atualizar = async () => {
    const c = await api(`/empresas/${empresa.id}/conversas/teste`);
    chat.innerHTML = bolhas(c.linha) || '<p class="dica">Nenhuma mensagem ainda.</p>';
    chat.scrollTop = chat.scrollHeight;
  };
  await atualizar();
  $("#form-teste").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const input = $("#msg-teste");
    const texto = input.value.trim();
    if (!texto) return;
    input.value = "";
    chat.insertAdjacentHTML("beforeend", `<div class="bolha cliente">${esc(texto)}</div><div class="bolha sistema" id="digitando">digitando…</div>`);
    chat.scrollTop = chat.scrollHeight;
    try { await api(`/empresas/${empresa.id}/teste`, { metodo: "POST", corpo: { texto } }); }
    catch (err) { aviso(err.message); }
    await atualizar();
  });
  $("#reiniciar").addEventListener("click", async () => {
    await api(`/empresas/${empresa.id}/teste`, { metodo: "POST", corpo: { reiniciar: true } });
    await atualizar();
  });
}

// ---------- clientes ----------
const ETAPA = { novo: "Novo", qualificando: "Entendendo o pedido", orcamento_enviado: "Orçamento enviado", negociando: "Negociando", agendado: "Agendado", fechado: "Fechado", perdido: "Perdido" };
async function abaClientes(el) {
  const [leads, agenda] = await Promise.all([api(`/empresas/${empresa.id}/leads`), api(`/empresas/${empresa.id}/agenda`)]);
  el.innerHTML = `
    <div class="cartao"><h3>Clientes (${leads.length})</h3><div class="tabela"><table>
      <thead><tr><th>Cliente</th><th>Etapa</th><th>Valor</th><th>Última mensagem</th><th>Atendimento</th><th></th></tr></thead>
      <tbody>${leads.map((l) => `<tr>
        <td>${esc(l.nome || "—")}<br><small class="dica">${esc(l.telefone)}</small></td>
        <td><span class="selo">${esc(ETAPA[l.etapa] || l.etapa)}</span></td>
        <td>${reais(l.valor)}</td>
        <td>${dataHora(l.ultima_msg_cliente)}</td>
        <td>${l.humano ? '<span class="opc">Equipe</span>' : '<span class="ok">IA</span>'}</td>
        <td><button class="pequeno" data-ver="${esc(l.telefone)}">Ver conversa</button>
            <button class="pequeno" data-humano="${esc(l.telefone)}" data-ativo="${l.humano ? "" : "1"}">${l.humano ? "Devolver à IA" : "Assumir"}</button></td>
      </tr>`).join("") || '<tr><td colspan="6" class="dica">Nenhum cliente ainda.</td></tr>'}</tbody>
    </table></div></div>
    <div id="conversa"></div>
    <div class="cartao"><h3>Agenda</h3><div class="tabela"><table>
      <thead><tr><th>Quando</th><th>Serviço</th><th>Cliente</th><th>Endereço</th><th>Valor</th></tr></thead>
      <tbody>${agenda.map((a) => `<tr><td>${dataHora(a.inicio)}</td><td>${esc(a.servico)}</td><td>${esc(a.nome)}<br><small class="dica">${esc(a.telefone)}</small></td><td>${esc(a.endereco || "—")}</td><td>${reais(a.valor)}</td></tr>`).join("") || '<tr><td colspan="5" class="dica">Nenhum agendamento.</td></tr>'}</tbody>
    </table></div></div>`;
  el.addEventListener("click", async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.humano) {
      await api(`/empresas/${empresa.id}/leads/${encodeURIComponent(b.dataset.humano)}/humano`, { metodo: "POST", corpo: { ativo: !!b.dataset.ativo } });
      render();
    } else if (b.dataset.ver) {
      const tel = b.dataset.ver;
      const c = await api(`/empresas/${empresa.id}/conversas/${encodeURIComponent(tel)}`);
      $("#conversa").innerHTML = `<div class="cartao"><h3>Conversa com ${esc(tel)}</h3><div class="chat">${bolhas(c.linha)}</div>
        <form class="enviar" id="form-equipe"><input id="msg-equipe" placeholder="Responder como equipe…"><button class="primario">Enviar</button></form></div>`;
      $("#conversa .chat").scrollTop = 1e9;
      $("#form-equipe").addEventListener("submit", async (e2) => {
        e2.preventDefault();
        const texto = $("#msg-equipe").value.trim();
        if (!texto) return;
        try { await api(`/empresas/${empresa.id}/leads/${encodeURIComponent(tel)}/mensagem`, { metodo: "POST", corpo: { texto } }); b.click(); }
        catch (err) { aviso(err.message); }
      });
    }
  });
}

// ---------- eventos ----------
async function abaEventos(el) {
  const ev = await api(`/empresas/${empresa.id}/eventos`);
  el.innerHTML = `<div class="cartao"><h3>Últimos eventos</h3><div class="tabela"><table>
    <thead><tr><th>Quando</th><th>Evento</th><th>Dados</th></tr></thead>
    <tbody>${ev.map((x) => `<tr><td>${dataHora(x.em)}</td><td><span class="selo">${esc(x.tipo)}</span></td><td><small>${esc(JSON.stringify(x.dados))}</small></td></tr>`).join("") || '<tr><td colspan="3" class="dica">Nada ainda.</td></tr>'}</tbody>
  </table></div></div>`;
}

// ---------- início ----------
window.addEventListener("beforeunload", (e) => { if (alterado) e.preventDefault(); });
(async () => {
  opcoes = await api("/opcoes");
  $("#sel-ramo").innerHTML = Object.entries(opcoes.ramos).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
  await carregarLista();
})().catch((err) => aviso(err.message));
