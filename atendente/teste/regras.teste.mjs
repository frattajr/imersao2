import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarDesconto, calcularOrcamento, valorSinal } from "../src/precos.js";
import { horariosLivres, instanteLocal } from "../src/agenda.js";
import { checklist, montarFerramentas, montarPrompt } from "../src/estrutura.js";
import { novaEmpresa } from "../src/ramos.js";
import { assinaturaValida, extrairMensagens } from "../src/whatsapp.js";
import crypto from "node:crypto";

const regras = { urgencia_percentual: 30, fim_de_semana_percentual: 20, desconto_max: 10, sinal_percentual: 30 };

test("preço fixo com unidades extras e urgência", () => {
  const s = { id: "tomada", nome: "Tomada", preco: { tipo: "fixo", valor: 80, adicional_por_unidade: 40, unidade: "tomadas" } };
  assert.equal(calcularOrcamento(s, { quantidade: 3 }, regras).valor, 160);
  assert.equal(calcularOrcamento(s, { quantidade: 1, urgente: true }, regras).valor, 104);
});

test("preço por unidade, faixa e visita técnica", () => {
  assert.equal(calcularOrcamento({ id: "a", nome: "A", preco: { tipo: "por_unidade", valor: 150, valor_unidade: 35 } }, { quantidade: 2 }, regras).valor, 220);
  const faixa = calcularOrcamento({ id: "b", nome: "B", preco: { tipo: "faixa", min: 100, max: 200 } }, { fim_de_semana: true }, regras);
  assert.deepEqual([faixa.min, faixa.max], [120, 240]);
  const visita = calcularOrcamento({ id: "c", nome: "C", preco: { tipo: "visita_tecnica", valor_visita: 0 } }, {}, regras);
  assert.equal(visita.precisa_visita, true);
  assert.match(visita.resumo, /gratuita/);
});

test("desconto respeita o limite e sinal é calculado no código", () => {
  assert.equal(avaliarDesconto(200, 15, regras).aprovado, false);
  const ok = avaliarDesconto(200, 10, regras);
  assert.equal(ok.aprovado, true);
  assert.equal(ok.valor_final, 180);
  assert.equal(valorSinal(180, regras), 54);
});

test("horários livres respeitam fuso, expediente, antecedência e conflitos", () => {
  const e = novaEmpresa({ id: "x", nome: "X", ramo: "eletricista" });
  const agora = Date.parse("2026-10-19T12:00:00Z"); // segunda, 09:00 em São Paulo
  const ocupado = [{ inicio: "2026-10-19T14:00:00Z", fim: "2026-10-19T15:00:00Z", status: "agendado" }];
  const livres = horariosLivres(e, ocupado, { duracao_min: 60, agora });
  assert.equal(livres[0].inicio, "2026-10-19T15:00:00.000Z"); // 11h ocupado, 12h livre
  assert.match(livres[0].texto, /^seg 19\/10 às 12:00$/);
  assert.equal(livres[2].inicio, "2026-10-20T11:00:00.000Z"); // terça 08:00
  assert.equal(instanteLocal(2026, 10, 24, 9, 0, "America/Sao_Paulo"), Date.parse("2026-10-24T12:00:00Z"));
  // sábado e domingo fora do expediente padrão
  assert.ok(livres.every((h) => !/^(sáb|dom)/.test(h.texto)));
});

test("estrutura gerada reflete os dados da empresa", () => {
  const e = novaEmpresa({ id: "x", nome: "João Elétrica", ramo: "eletricista" });
  const prompt = montarPrompt(e);
  assert.match(prompt, /João Elétrica/);
  assert.match(prompt, /Instalação de chuveiro/);
  const nomes = montarFerramentas(e).map((f) => f.name);
  assert.ok(nomes.includes("gerar_cobranca_sinal"));
  e.integracoes.pagamento.tipo = "nenhum";
  assert.ok(!montarFerramentas(e).some((f) => f.name === "gerar_cobranca_sinal"));
  const enumIds = montarFerramentas(e)[0].input_schema.properties.servico_id.enum;
  assert.deepEqual(enumIds, ["tomada", "chuveiro", "quadro"]);
  assert.equal(checklist(e).pronto, false);
  e.integracoes.ia.chave = "k"; e.integracoes.whatsapp.token = "t"; e.integracoes.whatsapp.numero_id = "1";
  assert.equal(checklist(e).pronto, true);
});

test("webhook do WhatsApp: extrai mensagens e valida assinatura", () => {
  const corpo = { entry: [{ changes: [{ value: {
    contacts: [{ wa_id: "5511999990000", profile: { name: "Maria" } }],
    messages: [
      { id: "m1", from: "5511999990000", type: "text", text: { body: "Oi" } },
      { id: "m2", from: "5511999990000", type: "image", image: { caption: "o vazamento" } },
    ] } }] }] };
  const msgs = extrairMensagens(corpo);
  assert.equal(msgs.length, 2);
  assert.deepEqual(msgs[0], { id: "m1", de: "5511999990000", nome: "Maria", texto: "Oi" });
  assert.match(msgs[1].texto, /foto.*o vazamento/);

  const bruto = Buffer.from(JSON.stringify(corpo));
  const assinatura = "sha256=" + crypto.createHmac("sha256", "segredo").update(bruto).digest("hex");
  assert.equal(assinaturaValida("segredo", bruto, assinatura), true);
  assert.equal(assinaturaValida("segredo", bruto, "sha256=errada"), false);
});
