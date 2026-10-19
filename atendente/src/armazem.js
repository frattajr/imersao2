// Armazenamento simples em arquivos JSON (uma pasta por empresa).
// Suficiente para dezenas de empresas pequenas; troque por Postgres quando crescer.
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RAIZ = path.resolve(process.env.PASTA_DADOS || "./dados");
const filas = new Map(); // arquivo -> promessa da última escrita (evita escritas simultâneas)

function caminho(...partes) {
  for (const p of partes) {
    if (!/^[\w.+-]+$/.test(p)) throw new Error(`nome inválido: ${p}`);
  }
  return path.join(RAIZ, ...partes);
}

async function ler(arquivo, padrao) {
  try {
    return JSON.parse(await fs.readFile(arquivo, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return structuredClone(padrao);
    throw e;
  }
}

async function gravar(arquivo, dados) {
  await fs.mkdir(path.dirname(arquivo), { recursive: true });
  const tmp = `${arquivo}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(dados, null, 2));
  await fs.rename(tmp, arquivo);
}

// Lê, aplica a alteração e grava, uma de cada vez por arquivo.
function alterar(arquivo, padrao, fn) {
  const anterior = filas.get(arquivo) || Promise.resolve();
  const proxima = anterior.catch(() => {}).then(async () => {
    const dados = await ler(arquivo, padrao);
    const resultado = await fn(dados);
    await gravar(arquivo, dados);
    return resultado;
  });
  filas.set(arquivo, proxima);
  return proxima;
}

export const novoId = () => crypto.randomBytes(6).toString("hex");

// ---- empresas ----
export async function listarEmpresas() {
  try {
    const ids = await fs.readdir(RAIZ);
    const lista = [];
    for (const id of ids) {
      const e = await ler(caminho(id, "empresa.json"), null).catch(() => null);
      if (e) lista.push(e);
    }
    return lista.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}
export const lerEmpresa = (id) => ler(caminho(id, "empresa.json"), null);
export const salvarEmpresa = (empresa) => gravar(caminho(empresa.id, "empresa.json"), empresa);
export const apagarEmpresa = (id) => fs.rm(caminho(id), { recursive: true, force: true });

// ---- leads (um mapa telefone -> lead) ----
export const lerLeads = (id) => ler(caminho(id, "leads.json"), {});
export const alterarLeads = (id, fn) => alterar(caminho(id, "leads.json"), {}, fn);

// ---- agenda ----
export const lerAgenda = (id) => ler(caminho(id, "agenda.json"), []);
export const alterarAgenda = (id, fn) => alterar(caminho(id, "agenda.json"), [], fn);

// ---- conversas ----
const CONVERSA_VAZIA = { mensagens: [], linha: [] };
const arquivoConversa = (id, tel) => caminho(id, "conversas", `${tel.replace(/\D/g, "") || "teste"}.json`);
export const lerConversa = (id, tel) => ler(arquivoConversa(id, tel), CONVERSA_VAZIA);
export const alterarConversa = (id, tel, fn) => alterar(arquivoConversa(id, tel), CONVERSA_VAZIA, fn);
export const apagarConversa = (id, tel) => fs.rm(arquivoConversa(id, tel), { force: true });

// ---- eventos (últimos 200, para o painel) ----
export const alterarEventos = (id, fn) => alterar(caminho(id, "eventos.json"), [], fn);
export const lerEventos = (id) => ler(caminho(id, "eventos.json"), []);
