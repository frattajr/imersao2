# Imersão — leitura com ambiente sonoro

App de leitura para iOS e Android: o texto aparece página por página, em letra de livro, e um ambiente sonoro suave acompanha a cena — chuva, café, floresta, lareira — com sons pontuais do que acontece na história (passos, porta, rugido distante). A IA lê o trecho e escolhe o som; sem internet, o app escolhe por palavras-chave.

## Como está montado

```
 Celular (React Native + Expo)                    Supabase (servidor)
┌──────────────────────────────────┐            ┌──────────────────────────────────┐
│ Telas: biblioteca, leitor,       │            │ Postgres                          │
│ glossário, colar texto           │  sincroniza│  library  (progresso, glossário)  │
│                                  │◄──────────►│  ai_cache (respostas reaproveitadas)
│ SQLite local (funciona offline)  │            │  ai_usage (limite diário)         │
│  livros, progresso, glossário,   │            │ Storage                           │
│  planos de som já recebidos      │            │  books/   textos dos livros       │
│                                  │            │  imports/ PDFs (apagados ao ler)  │
│ Motor de som                     │            │  sounds/  gravações reais (opcional)
│  loops + volumes + crossfades    │  pede plano│ Funções                           │
│  síntese em JS (reserva)         │───────────►│  sound-plan  → Claude (com cache) │
│  gravações reais (pacote)        │            │  glossary    → Claude (com cache) │
│                                  │            │  extract-pdf → texto do PDF       │
│ EPUB lido no aparelho            │            └──────────────────────────────────┘
└──────────────────────────────────┘
```

**O que faz o custo escalar bem:** o plano de som de cada trecho fica no `ai_cache`, indexado pelo hash do texto. Se mil pessoas leem o mesmo livro, a IA analisa cada trecho **uma vez**; as outras 999 recebem do cache. No aparelho, o plano também fica salvo — reler não gera chamada nenhuma.

**Por que o app funciona sem servidor:** biblioteca, leitura, progresso, EPUB e sons por palavras-chave rodam no aparelho. O servidor acrescenta IA, PDF e sincronização entre aparelhos.

## Colocar para rodar

Pré-requisitos: Node 20+, uma conta no [Supabase](https://supabase.com), uma chave da API da Anthropic, e Xcode (iPhone) ou Android Studio — ou o EAS da Expo para compilar na nuvem.

### 1. Instalar

```bash
npm install
npx expo install --fix   # alinha todas as versões ao SDK atual do Expo
cp .env.example .env     # preencha depois do passo 2
```

O projeto foi escrito para o Expo SDK 54. O `expo install --fix` ajusta as versões se houver um SDK mais novo.

### 2. Servidor (Supabase)

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJETO
npx supabase db push                          # cria tabelas, regras de acesso e buckets
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... AI_DAILY_LIMIT=300
npx supabase functions deploy sound-plan glossary extract-pdf sound-resolve
```

No painel do Supabase: **Authentication → Sign In / Providers → Allow anonymous sign-ins** (ligado). O leitor começa sem cadastro.

Copie a URL e a chave `anon` (Project Settings → API) para o `.env`.

Modelos (opcional, como secrets): `SOUND_MODEL` (padrão `claude-haiku-5-5`, rápido e barato para os planos de som) e `GLOSSARY_MODEL` (padrão `claude-sonnet-5-5`).

### 3. Rodar no celular

O som usa um módulo nativo (`react-native-audio-api`), então **o Expo Go não serve** — é preciso um *development build*:

```bash
npx expo run:ios        # ou: npx expo run:android
# ou na nuvem, sem Xcode/Android Studio:
npx eas build --profile development --platform ios
```

## Sons gravados (recomendado para a loja)

A síntese em JavaScript é a reserva: funciona em qualquer lugar e já soa razoável. Para soar **real**, suba gravações ao bucket público `sounds` com um `manifest.json`:

```json
{
  "layers": {
    "rain": ["rain-roof-1.m4a", "rain-window-2.m4a"],
    "cafe": ["cafe-1.m4a"],
    "fire": ["fireplace-1.m4a"]
  },
  "spots": {
    "roar": ["roar-distant-1.m4a"],
    "steps": { "wood": ["steps-wood-1.m4a"], "gravel": ["steps-gravel-1.m4a"], "*": ["steps-1.m4a"] },
    "doorbell": ["shop-bell-1.m4a"]
  }
}
```

E no `.env`: `EXPO_PUBLIC_SOUND_PACK_URL=https://SEU-PROJETO.supabase.co/storage/v1/object/public/sounds`.

O app usa a gravação quando ela existe e a síntese para o resto, camada por camada. Dicas para os arquivos:

- **Camadas:** 30–90 s, loop sem emenda (corte em cruzamento por zero, crossfade nas pontas), AAC `.m4a` 128 kbps, nível em torno de −23 LUFS, sem eventos marcantes (o ouvido percebe a repetição).
- **Sons pontuais:** curtos, com a cauda natural, um pouco distantes (reverberação do ambiente).
- **Licença:** use bibliotecas com licença comercial clara (por exemplo, coleções CC0 ou pacotes de efeitos com licença para apps). Guarde os comprovantes — a loja pode pedir.

Camadas: `wind leaves birds rain thunder sea water fire cafe crowd city train night cricket clock`.
Sons pontuais: `steps door knock doorbell keys roar howl bark owl bell horn hooves creak drip gust rustle purr musicbox`.

## Repositório de sons (reaproveitar ou gerar)

Cada som que toca é descrito com campos fixos — nome (`rain`, `steps`...), `material`, `place`, `distance`, `intensity` e um `detail` curto em inglês. A IA preenche esses campos no plano de cada página (`looks` nas camadas, `v` nos sons pontuais), e a função `sound-resolve` procura no repositório (`sound_library`) o som mais parecido:

```
descrição da cena ──► sound-resolve ──► achou parecido (≥ 0,7)? ──► reaproveita (custo zero)
                                         │ não
                                         ▼
                         geração ligada? ──► gera em segundo plano, salva em sounds/lib/…
                                         │ não                    (próximo pedido já reaproveita)
                                         ▼
                              app usa o pacote fixo ou a síntese
```

- **Nunca troca um som por outro de nome diferente** (chuva nunca vira mar). Pedido sem um campo aceita qualquer valor; por isso os planos por palavras-chave (sem IA) também reaproveitam as gravações.
- **Uma geração por som novo:** dois leitores pedindo o mesmo som ao mesmo tempo geram uma vez só. Se a geração falhar, a mesma descrição só é tentada de novo depois de 6 horas.
- **No app:** o volume dos arquivos é igualado automaticamente (arquivos mudos são descartados), e se o servidor demorar mais de 2,5 s toca a reserva.
- **"Som ruim":** no leitor, toque no rótulo do som (topo da tela) e confirme. Com votos de 3 leitores, o som sai do repositório.

Para registrar as gravações do pacote fixo no repositório:

```bash
bun scripts/import-sound-pack.ts https://SEU-PROJETO.supabase.co/storage/v1/object/public/sounds/manifest.json > pack.sql
# rode pack.sql no SQL Editor do Supabase
```

Para ligar a **geração** de sons novos (opcional; sem isso o repositório só reaproveita):

```bash
npx supabase secrets set ELEVENLABS_API_KEY=... SOUND_GEN_DAILY_LIMIT=50
```

`SOUND_GEN_DAILY_LIMIT` limita as gerações em 24 h para o app inteiro (padrão 50); `SOUND_GEN_MODEL` troca o modelo (padrão `eleven_text_to_sound_v2`). Antes de publicar na loja, confira se os termos do serviço permitem uso comercial dos sons gerados.

## Verificações

```bash
npm test                          # testes do núcleo (Jest)
bun scripts/verify-repo.ts        # SQL da biblioteca local (precisa do Bun)
bun scripts/verify-audio.ts out/  # síntese: níveis, loops, sem estouro; salva WAVs em out/
bun scripts/verify-functions.ts   # funções do servidor com Supabase/Claude simulados
```

O que já foi verificado fora do celular:

| Parte | Como |
|---|---|
| Texto, EPUB, glossário, plano de som | 15 testes automáticos (EPUB real gerado com JSZip) |
| Biblioteca local (SQLite) | 15 checagens com SQLite real |
| Síntese de áudio | todas as camadas e sons: sem NaN, sem estouro, emenda do loop, nível e caráter espectral |
| Motor de som | no Web Audio do Chromium, medindo a saída: entrada/saída suaves, sons pontuais, mudo, liberar camadas e suspender |
| Repositório de sons | 18 testes (semelhança, chave, geração única, limite, normalização de volume) + 14 checagens da função `sound-resolve` + funções SQL num PostgreSQL 16 |
| Funções do servidor | 21 checagens: login, cache compartilhado, limite diário, entradas inválidas, PDF de outro leitor, PDF apagado após leitura |
| Migração do banco | aplicada num PostgreSQL 16 com ambiente Supabase simulado; regras de acesso testadas (cada leitor só vê o que é seu) |
| Tipos | `tsc` estrito em todo o código do app |

**Ainda precisa ser testado num aparelho** (não havia como instalar as bibliotecas nativas no ambiente onde o projeto foi escrito):

- primeira compilação: possíveis ajustes de versão das bibliotecas (`npx expo-doctor` ajuda);
- `react-native-audio-api`: nomes das opções do plugin no `app.json` e de `AudioManager.setAudioSessionOptions` (em `src/audio/context.ts`) podem variar por versão — se o `prebuild` reclamar do plugin, remova a entrada dele; o modo de áudio em segundo plano do iOS já está no `infoPlist`;
- tempo para gerar os sons sintetizados no aparelho (no computador, todas as camadas levam ~1,7 s; o app gera só as que a cena usa, uma por vez);
- tocar com a tela bloqueada (iOS e Android);
- leitura de arquivos pelo `expo-file-system` (há um plano B com `fetch`);
- geração de sons pela API da ElevenLabs com uma chave real (o formato do pedido segue a documentação, mas só foi testado com a API simulada).

## Estrutura

```
app/                 telas (expo-router)
  index.tsx          biblioteca
  read/[id].tsx      leitor
  glossary/[id].tsx  glossário
  paste.tsx          colar texto
src/core/            lógica pura, testável: texto, EPUB, palavras-chave, planos, glossário
src/audio/           síntese (dsp, recipes) e motor (engine); context.ts = celular, context.web.ts = navegador
src/state/           SQLite local (repo) e diretor de cena (planos da IA em lotes)
src/services/        Supabase, IA, importação, sincronização
src/data/books.ts    histórias de exemplo
supabase/            migração SQL e funções (Deno)
scripts/             verificações (Bun)
__tests__/           testes (Jest)
```

## Próximos passos até a loja

1. **Testar num aparelho** e ajustar o que a lista acima apontar.
2. **Gravações reais** para as camadas mais usadas (chuva, café, lareira, floresta, mar, noite).
3. **Conta com e-mail**: vincular a conta anônima (`supabase.auth.updateUser({ email })`) para levar a biblioteca a outro aparelho sem perder nada.
4. **Assinatura** (compras dentro do app — obrigatório nas lojas para conteúdo digital), por exemplo com RevenueCat; o `AI_DAILY_LIMIT` pode variar por plano.
5. **Ícone, splash, política de privacidade** (explicar que PDFs são lidos no servidor e apagados, e que trechos vão para a IA) e notas para a revisão da Apple.
6. **Publicar** com `npx eas build --profile production` e `npx eas submit`.

## Preview web

Há uma versão para navegador, só para visualizar o app (biblioteca, leitor, glossário e sons sintetizados pelo Web Audio). No navegador o banco local usa `sql.js` (`src/state/db.web.ts`), salvo no `localStorage`.

- Rodar localmente: `npx expo start --web`
- Publicada automaticamente no GitHub Pages pelo workflow `.github/workflows/preview.yml` a cada push. Se o deploy falhar na primeira vez, ative em **Settings → Pages → Source: GitHub Actions** e rode o workflow de novo.
