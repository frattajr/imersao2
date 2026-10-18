# CopilotAuto — MVP

Assistente de vistoria pré-compra de carros usados. A câmera guia um comprador leigo por 20 fotos padronizadas, cada foto passa por uma triagem visual multimodal e, no fim, o app monta um relatório com argumentos e uma oferta para negociar. Tudo isso com travas jurídicas para que o app nunca afirme mais do que uma foto sustenta.

> Este projeto é independente do app de leitura na raiz do repositório. Tem dependências, testes e CI próprios (`.github/workflows/copilotauto.yml`).

## Arquitetura

```
 Celular (Expo SDK 54 / React Native)            Backend (FastAPI + Pydantic v2)
┌──────────────────────────────────────┐        ┌───────────────────────────────────────────┐
│ 1. Termos + dados do carro           │        │ POST /v1/inspections  (exige termos atuais)│
│ 2. Câmera com overlay SVG por item   │        │ POST /v1/inspections/{id}/analyses         │
│    ├ ML Kit (OCR): DOT, hodômetro    │ base64 │   ├ OCR-only (DOT) → regra de idade, sem IA│
│    ├ checagem local: foco + luz      │───────►│   ├ portão de qualidade (Pillow) → sem IA  │
│    │  (foto ruim não sai do aparelho)│        │   ├ visão: Gemini Flash | GPT-4o-mini      │
│    └ resize 1280px JPEG 80%          │        │   │   (JSON por schema, 1 nova tentativa)  │
│ 3. Resultado por item + refazer      │◄───────│   └ guardrails → AnalysisResult            │
│ 4. Relatório + roteiro de negociação │        │ GET  /v1/inspections/{id}/report           │
└──────────────────────────────────────┘        │ POST /internal/purge-photos (pg_cron)      │
            │ sessão anônima                    └──────────────┬────────────────────────────┘
            ▼                                                  │ service role
   Supabase Auth ◄─────────── valida token ────────────────────┤
   Postgres: inspections · findings · photos (RLS: só o dono lê)│
   Storage: inspection-photos (privado, TTL 60 dias) ◄─────────┘
```

### Onde está cada módulo

| Módulo | Arquivos |
|---|---|
| 1. Captura guiada com overlay | `mobile/src/steps.ts` (roteiro), `mobile/src/overlays.tsx` (silhuetas SVG com máscara), `mobile/app/inspect/[id].tsx` |
| Checagem local de blur/luz | `mobile/src/quality.ts` + `mobile/src/capture.ts` (variância do Laplaciano numa miniatura de 128 px) |
| OCR local (ML Kit) | `mobile/src/ocr.ts`: DOT, placa antiga/Mercosul, chassi (VIN), hodômetro |
| 2. Engine de visão | `backend/app/vision.py` (provedores), `backend/app/prompts.py` (prompt do sistema), `backend/app/schemas.py` (`AnalysisResult`) |
| Catálogo + faixas de custo | `backend/app/catalog.py` |
| Blindagem jurídica | `backend/app/guardrails.py`, avisos em `backend/app/prompts.py`, termos em `mobile/src/terms.ts` |
| Negociação | `backend/app/negotiation.py`, `mobile/app/report/[id].tsx` |
| Banco/Storage/TTL | `supabase/migrations/20261017000000_copilotauto_init.sql` |

## Roteiro de fotos (20)

1. **Motor a frio:** parte interna da tampa de óleo e reservatório de arrefecimento.
2. **Estrutura frontal:** parafusos dos para-lamas (esquerdo e direito), torres dos amortecedores e longarinas.
3. **Pneus (×4):** DOT (lido por OCR, com digitação manual se a leitura falhar) e banda de rodagem com o TWI.
4. **Vãos e lataria:** fresta entre capô e para-lama (dos dois lados) e pintura sob luz refletida.
5. **Cabine:** pedaleiras, aro do volante e hodômetro (o valor lido é comparado com o km anunciado).

## Contrato de resposta

Toda análise devolve exatamente o `AnalysisResult` do enunciado (`component_id`, `status` ∈ GREEN/YELLOW/RED/INCONCLUSIVE, `confidence_score`, `visual_findings`, `risk_assessment`, `is_negotiation_lever`, `estimated_cost_min/max`, `legal_disclaimer`, `user_guidance_next_step`). Ao modelo, o schema vai como `responseSchema` (Gemini) ou como `json_schema` com `strict: true` (OpenAI). Em seguida a resposta é validada pelo Pydantic com `extra="forbid"`.

## Blindagem jurídica (CDC)

O maior risco é a **falsa tranquilidade**: o app diz "tudo certo" e o comprador leva um defeito oculto. O segundo é a **acusação categórica** contra o vendedor. Por isso, no servidor:

- **Confiança mínima:** abaixo de 0,50, nenhum status além de INCONCLUSIVE. GREEN exige 0,70.
- **Falha nunca vira GREEN:** JSON inválido, timeout ou foto ruim resultam em INCONCLUSIVE e orientação para refazer a foto.
- **Linguagem:** afirmações categóricas ("foi batido", "sem nenhum problema", "garantido", "com certeza", "motor queimado", "km adulterado") são reescritas em linguagem de indício.
- **Custos:** sempre limitados à faixa do catálogo para o status. GREEN e INCONCLUSIVE custam R$ 0.
- **Aviso:** o `legal_disclaimer` é sempre o texto canônico do servidor (fluido, estrutural, OCR ou genérico), nunca o do modelo.
- **Laudo cautelar:** achado RED estrutural (torres, longarinas) ou mais de 3 REDs fazem o relatório recomendar laudo cautelar antes de negociar.
- **Prova de ciência:** a vistoria só é criada com a versão atual dos termos. `terms_version` e `terms_accepted_at` ficam gravados.
- **Auditoria:** cada achado registra a origem (`vision`, `ocr_rule`, `quality_gate` ou `fallback`) e o provedor:modelo usado.
- **Itens sem resultado:** o relatório lista o que foi pulado ou ficou inconclusivo, para não sugerir que o carro foi avaliado por inteiro.

> Os textos de termos e avisos são um ponto de partida técnico. Revise-os com um advogado antes de lançar.

## Controle de custo

- A foto tremida, escura ou estourada é barrada **no aparelho** e não gera requisição.
- O backend repete a mesma checagem com Pillow antes de chamar a IA.
- DOT do pneu: regra determinística a partir do OCR. São 4 das 20 etapas sem chamada de visão.
- Imagem enviada com no máximo 1280 px, `temperature` 0,2 e `max_tokens` 800.
- `MAX_ANALYSES_PER_INSPECTION` (padrão 60) limita as novas tentativas por vistoria.

## Negociação

- Para cada foto, vale o resultado mais recente. Cada pneu conta uma vez só, pelo pior resultado entre DOT e banda.
- **Oferta sugerida** = preço pedido − média das faixas, arredondada para baixo de R$ 500 em R$ 500, com desconto de no máximo 25% do pedido.
- **Preço de desistência** (o máximo a pagar) = preço pedido − custo mínimo, com o mesmo teto. Fica sempre igual ou acima da oferta sugerida.
- O app copia os argumentos, do mais forte ao mais fraco, num texto pronto para mandar ao vendedor.

## Rodando

### Backend

```bash
cd copilotauto/backend
pip install -r requirements-dev.txt
cp .env.example .env            # VISION_PROVIDER=mock dispensa chave de IA
AUTH_DISABLED=true uvicorn app.main:app --reload
python -m pytest -q             # 15 testes
```

Para produção, defina `VISION_PROVIDER=gemini` (ou `openai`) com a chave, além de `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`. O `Dockerfile` está pronto para Cloud Run, Fly.io ou Render. O modelo padrão é `gemini-2.5-flash`; troque por `GEMINI_MODEL` se a versão 1.5 indicada no escopo ainda estiver disponível na sua conta.

### Supabase

1. Aplique `supabase/migrations/20261017000000_copilotauto_init.sql`, que cria as tabelas, a RLS, o bucket privado e o agendamento do pg_cron.
2. Ative **Anonymous sign-ins** em Auth (o MVP não pede cadastro).
3. Guarde no Vault a URL da API e o `CRON_SECRET`; os comandos estão no fim da migration. A limpeza diária apaga as fotos vencidas pela Storage API.

### Mobile

```bash
cd copilotauto/mobile
npm install
cp .env.example .env            # URL da API e chaves públicas do Supabase
npx expo run:android            # build nativo (o ML Kit não roda no Expo Go)
npm run typecheck && npm test   # 12 testes
```

No Expo Go, o app funciona sem OCR: o DOT cai na digitação manual e o hodômetro não é comparado.

## Próximos passos sugeridos

- Calibrar `MIN_SHARPNESS` e as faixas de custo com fotos reais, por região.
- Cache por hash da imagem para não pagar duas vezes a mesma foto.
- Exportar o relatório em PDF com as fotos (URLs assinadas do Storage).
- Leitura do chassi gravado (ML Kit) e comparação com o informado no documento.
