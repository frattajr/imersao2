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
│  arquivos da ElevenLabs          │───────────►│  sound-plan  → Claude (com cache) │
│  sons reaproveitados (cache)     │            │  glossary    → Claude (com cache) │
│                                  │            │  extract-pdf → texto do PDF       │
│ EPUB lido no aparelho            │            └──────────────────────────────────┘
└──────────────────────────────────┘
```

**O que faz o custo escalar bem:** o plano de som de cada trecho fica no `ai_cache`, indexado pelo hash do texto. Se mil pessoas leem o mesmo livro, a IA analisa cada trecho **uma vez**; as outras 999 recebem do cache. No aparelho, o plano também fica salvo — reler não gera chamada nenhuma.

**Por que o app funciona sem servidor:** biblioteca, leitura, progresso, EPUB e sons por palavras-chave rodam no aparelho. O servidor acrescenta IA, PDF e sincronização entre aparelhos.

## Experiência de leitura (produto)

**Motor de áudio adaptativo** (`src/audio/engine.ts`)
- A cena é uma **matriz de mixagem declarativa**: cada stem (loop contínuo: chuva, vento, lareira, taberna, drone de tensão…) com ganho, **low-pass** (abafa o que está "do outro lado da parede" ou longe) e **prioridade**. A IA (`sound-plan`, prompt v5) atua como mixadora: devolve a matriz, nunca áudio.
- No máximo 4 stems ao mesmo tempo (os de maior prioridade); transições com curva de **potência constante de 2,5 s (entrada) a 4 s (saída)**; **ducking** de ~4 dB no ambiente enquanto um efeito toca.
- **Conforto acústico**: volume de ambiente e de efeitos separados, loops liga/desliga e **modo foco** (só stems essenciais, agudos cortados, sem efeitos) — no painel 🎧 do leitor e nas Configurações.
- **Bateria e latência**: stems silenciosos são parados (o buffer fica em cache), o contexto de áudio é suspenso quando nada toca, relógio interno de 0,5 s, consulta ao repositório com limite de 2,5 s e arquivos normalizados uma única vez.

**Leitura** (`app/read/[id].tsx`, `src/reader/`)
- **Três modos de leitura**: 📖 **página cheia** (vários parágrafos por tela, como um livro; `src/core/paginate.ts` estima o que cabe e nunca corta parágrafo), 🎬 **um parágrafo por tela** e 📜 **rolagem contínua**. Na página cheia, o som de cada parágrafo da tela entra no tempo em que a pessoa deve chegar nele, pelo ritmo dela. Na rolagem, o som acompanha o parágrafo visível (`onViewableItemsChanged`, 0,7 s de permanência).
- **Virar a página**: toque nas laterais, deslize para o lado (ou para cima), ou use setas / PageUp / PageDown / espaço no teclado (web). *Botões de volume* não foram incluídos: precisam de um módulo nativo (ex.: `react-native-volume-manager`) e de um build EAS próprio.
- **Grifos e notas**: toque longo num parágrafo abre a seleção (escolha as frases); grife em 4 cores, anote, copie, compartilhe, abra uma palavra no dicionário (Dicio) ou traduza o trecho. Toque num grifo para editar. Ficam ancorados no parágrafo + posição do caractere, então sobrevivem a mudanças de fonte e de modo. Tabela `annotations` no SQLite.
- **Marcadores**: 🏷/🔖 na barra de cima; no Modo Zen aparece uma fita no canto.
- **☰ Navegar**: barra de progresso arrastável (mostra capítulo e % enquanto arrasta), sumário, lista de marcadores e de grifos/notas com **exportação em Markdown** (compartilhar no celular; copiar na web), e o download do capítulo para ler offline.
- **🔍 Busca no livro** (sem acento e sem diferenciar maiúsculas): toque num resultado para ir até ele; o trecho pisca em destaque.
- **"🔇 Toque para ativar o som"**: se o navegador bloquear o áudio (autoplay), aparece um aviso; um toque libera.
- **Modo Zen**: barras, botões e barra de status somem após 3 s sem toque; um toque no centro traz de volta. Fica um indicador mínimo do capítulo com o tempo restante calculado no **ritmo de leitura da pessoa** (palavras por minuto aprendidas página a página, `src/core/pace.ts`).
- **Tipografia**: Literata, Merriweather e Atkinson Hyperlegible (Bookerly é exclusiva da Amazon e não pode ser distribuída), tamanho, entrelinha, espaço entre parágrafos, margens e alinhamento; temas Claro, Sépia, Cinza foco, Escuro e Preto OLED (contraste do texto acima de 7:1).
- **X-Ray** (`src/core/xray.ts`): nomes e termos do texto são tocáveis e abrem uma ficha — primeira e última menção, número de menções e explicação da IA sob demanda — **só com o que já foi lido** (sem spoiler).
- **"O que aconteceu até aqui?"** (`src/core/recap.ts` + função `recap`): ao voltar depois de 48 h, um resumo de 2 frases das páginas logo antes do ponto de parada (IA; sem internet, as 2 frases mais relevantes do trecho).
- **Offline** (`src/services/offline.ts`): ⬇ no leitor baixa o capítulo — texto (já fica no SQLite), planos de som e arquivos de áudio — para ler sem conexão.

**Importação** (`src/core/reflow.ts`): PDFs sem cabeçalhos/rodapés repetidos nem paginação impressa, com hifenização e quebras de linha desfeitas; EPUBs sem marcadores de página, chamadas e blocos de notas; textos do Gutenberg sem `[Pg 12]` e ilustrações.

**Custos de IA**: as respostas ficam no **cache global** (`ai_cache`, por hash do trecho — o mesmo trecho dá a mesma resposta para todos). **Livros públicos** (obras de exemplo e Gutenberg) **nunca disparam a IA** no app: pedem só o que já está no cache (`cacheOnly`). O cache deles é preenchido uma vez por quem mantém o app (`npm run precompute`). A IA roda sob demanda apenas para textos colados ou importados pela pessoa.

**Primeira experiência**: três obras de domínio público já sonorizadas à mão, em tradução e adaptação próprias — *O Coração Delator* e *O Barril de Amontillado* (Edgar Allan Poe) e *O Sinaleiro* (Charles Dickens) — com planos calibrados por página (`src/data/classics.ts`) e um **pacote inicial de stems** gerado uma vez pela ElevenLabs e publicado junto com o app (`scripts/build-stems.ts`). Funciona sem chave de API, servidor ou upload.

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
npx supabase functions deploy sound-plan glossary extract-pdf sound-resolve gutenberg recap
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

### 4. Compilar com EAS (lojas)

Compatibilidade: **Expo SDK 54**, React Native 0.81, **nova arquitetura ligada** (`newArchEnabled`), `react-native-audio-api` (Web Audio nativo, toca com a tela bloqueada — modo de áudio em segundo plano no `app.json`) e `expo-sqlite` 16 (SQLite nativo). O Expo Go **não** serve por causa do módulo de áudio nativo.

```bash
npm i -g eas-cli && eas login
eas init                          # liga o projeto à sua conta Expo
npm run build:dev:ios             # development build (ou build:dev:android)
npm run build:preview             # APK/IPA para testes internos
npm run build:prod                # versão das lojas (autoIncrement da versão)
npm run submit                    # envia para App Store Connect e Google Play
```

Antes da loja: ícone e splash definitivos em `assets/`, política de privacidade (trechos vão para a IA; PDFs são lidos no servidor e apagados), e as variáveis `EXPO_PUBLIC_*` do `.env` configuradas no EAS (`eas env:create`).

### 5. Obras iniciais com som (pacote de stems)

No GitHub do projeto: **Settings → Secrets and variables → Actions → New repository secret** `ELEVENLABS_API_KEY`. O próximo deploy gera os ~80 sons do pacote inicial (uma única vez; ficam em cache e não são pagos de novo) e publica em `/stems/`. Localmente: `ELEVENLABS_API_KEY=... npm run stems`.

### 6. Pré-calcular livros públicos (opcional)

```bash
npx supabase secrets set PRECOMPUTE_SECRET=um-segredo-longo-de-16+-caracteres
SUPABASE_URL=... SUPABASE_ANON_KEY=... PRECOMPUTE_SECRET=... npm run precompute -- dist/gutenberg --limit 20
```

### Scripts

| Script | O que faz |
|---|---|
| `npm start` / `npm run web` | servidor de desenvolvimento (celular / navegador) |
| `npm run verify` | tipos, testes (Jest) e verificações das funções, do banco e do Gutenberg |
| `npm run build:web` | exporta a versão web (a preview do GitHub Pages) |
| `npm run build:dev:ios` · `build:dev:android` · `build:preview` · `build:prod` · `submit` | EAS |
| `npm run stems` | gera o pacote inicial de stems (precisa de `ELEVENLABS_API_KEY`) |
| `npm run precompute` | preenche o cache global de IA dos livros públicos |

## Repositório de sons (reaproveitar ou gerar)

Cada som que toca é descrito com campos fixos — nome (`rain`, `steps`...), `material`, `place`, `distance`, `intensity` e um `detail` curto em inglês. A IA preenche esses campos no plano de cada página (`looks` nas camadas, `v` nos sons pontuais), e a função `sound-resolve` procura no repositório (`sound_library`) o som mais parecido:

```
descrição da cena ──► sound-resolve ──► achou parecido (≥ 0,7)? ──► reaproveita (custo zero)
                                         │ não
                                         ▼
                         geração ligada? ──► gera em segundo plano, salva em sounds/lib/…
                                         │ não                    (próximo pedido já reaproveita)
                                         ▼
                              som fica em silêncio até existir
```

- **Só sons da ElevenLabs:** o app não tem mais síntese nem pacote fixo de gravações. Um som que ainda não existe fica em silêncio enquanto é gerado e entra suavemente quando fica pronto.
- **Nunca troca um som por outro de nome diferente** (chuva nunca vira mar). Pedido sem um campo aceita qualquer valor; por isso os planos por palavras-chave (sem IA) também reaproveitam as gravações.
- **Uma geração por som novo:** dois leitores pedindo o mesmo som ao mesmo tempo geram uma vez só. Se a geração falhar, a mesma descrição só é tentada de novo depois de 6 horas.
- **No app:** o volume dos arquivos é igualado automaticamente (arquivos mudos são descartados), e se o servidor demorar mais de 2,5 s toca a reserva.
- **"Som ruim":** no leitor, toque no rótulo do som (topo da tela) e confirme. Com votos de 3 leitores, o som sai do repositório.

Para ligar a **geração** de sons novos (opcional; sem isso o repositório só reaproveita):

```bash
npx supabase secrets set ELEVENLABS_API_KEY=... SOUND_GEN_DAILY_LIMIT=50
```

`SOUND_GEN_DAILY_LIMIT` limita as gerações em 24 h para o app inteiro (padrão 50); `SOUND_GEN_MODEL` troca o modelo (padrão `eleven_text_to_sound_v2`). Antes de publicar na loja, confira se os termos do serviço permitem uso comercial dos sons gerados.

## Sons de acordo com o enredo

Ao abrir um livro, o app lê o texto inteiro e monta o **perfil sonoro** dele (`src/core/scenery.ts`): o cenário que se repete (farol, navio, dragão…) e uma descrição fixa para cada camada — a chuva do farol é sempre a mesma chuva. Em cada página, a descrição é ajustada pelo trecho (dentro/fora, perto/longe, forte/suave) e os sons pontuais ganham contexto ("rugido de dragão, longe").

- **Detalhes de ambiente:** sons pequenos que combinam com o lugar — rangido de madeira, gotas na caverna, rajadas, folhas, coruja — tocam baixinho, um de cada vez, com intervalos longos e irregulares (20–55 s), e continuam de uma página para outra.
- **Muitas trocas, som mais leve** (`src/core/smooth.ts`): se a cena muda muito em pouco tempo, as transições ficam até 2,5× mais longas, o volume baixa até 30%, camadas recém-chegadas não somem de repente e camadas fracas novas são ignoradas. Quando a leitura acalma, volta ao normal.
- **Reaproveitamento:** como a descrição de cada som é estável no livro, a segunda vez que ele aparece (nesta ou em outra leitura, neste ou em outro livro) vem do repositório, sem chamar a ElevenLabs. Os sons da próxima página são buscados (ou gerados) com antecedência.

## Biblioteca, capítulos e configurações

- **Biblioteca** (`app/index.tsx`): destaque no topo (continuar lendo), filtro por tema (Mistério, Fantasia, Aconchego, Suspense, Aventura, Meus livros), fileiras por tema e por ambiente sonoro e uma ficha de cada livro. As capas são desenhadas em código (`src/ui/Cover.tsx`) a partir do clima da história.
- **Capítulos** (`src/core/chapters.ts`): o glossário identifica "Capítulo 1", "CAPÍTULO III", "Parte 2", "Chapter 4"… ou, sem títulos, divide o livro em partes. Escolha um capítulo para ver os termos dele, sugestões de personagens e lugares (só do que já foi lido) e ir direto para ele.
- **Configurações** (`app/settings.tsx`, botão ⚙ na biblioteca e no leitor): volume do ambiente, suavidade das transições, volume dos sons da história, frequência dos detalhes de ambiente, suavização automática, tema, letra, chave da ElevenLabs e o repositório de sons.

## Clássicos do Project Gutenberg

A biblioteca mostra os livros em português do [Project Gutenberg](https://www.gutenberg.org), em domínio público, pelo catálogo [Gutendex](https://gutendex.com/books/?languages=pt) (`src/services/gutenberg.ts`):

- **Na tela inicial:** fileira "Clássicos em português" (os mais baixados) e fileiras por categoria (Romances, Contos, Poesia, Teatro, História e viagens), com as capas reais. A lista fica guardada por 24 h.
- **Catálogo completo** (`app/catalog.tsx`): busca por título ou autor e "carregar mais".
- **Ao abrir:** o app baixa o texto uma vez (prefere o `.txt`; se não houver, o EPUB), tira o cabeçalho e o rodapé do Gutenberg, remonta os parágrafos e guarda na biblioteca. Os capítulos ("CAPÍTULO I", "CAPITULO PRIMEIRO"…) aparecem no glossário.
- **Cópia no deploy** (`scripts/build-gutenberg.ts`): a cada deploy (e toda segunda-feira) o GitHub Actions baixa o catálogo em português do Gutendex — com o catálogo oficial do Gutenberg em CSV como reserva — e o texto já limpo dos 60 livros mais lidos, e publica tudo junto com o app em `/gutenberg/`. A lista e a busca carregam na hora, sem depender do Gutendex (que costuma ser lento) nem do bloqueio do navegador (CORS). Se a montagem falhar, o deploy segue e o app volta a consultar o Gutendex ao vivo.
- **Livros fora da cópia:** o app baixa do gutenberg.org. No celular é direto; na web, se o navegador bloquear, usa a função `gutenberg` do servidor (só endereços do Gutenberg, só leitores logados).

## Verificações

```bash
npm run verify                    # tudo abaixo de uma vez
npm test                          # testes (Jest): núcleo, motor de áudio, leitor, reflow, repositório de sons
bun scripts/verify-repo.ts        # SQL da biblioteca local (precisa do Bun)
bun scripts/verify-functions.ts   # funções do servidor com Supabase/Claude simulados
bun scripts/verify-gutenberg.ts   # montagem da cópia do Gutenberg com serviços simulados
```

O que já foi verificado fora do celular:

| Parte | Como |
|---|---|
| Texto, EPUB, glossário, plano de som | 15 testes automáticos (EPUB real gerado com JSZip) |
| Biblioteca local (SQLite) | 15 checagens com SQLite real |
| Motor de áudio | testes com contexto de áudio simulado: máx. 4 stems por prioridade, low-pass, curva de potência constante, transições de 2,5–4 s, ducking, modo foco, loops e volumes separados |
| Leitor | testes de ritmo de leitura (WPM), X-Ray sem spoiler, recapitulação e matriz pós-suavização; no Chromium: Modo Zen, toques, rolagem, tipografia, X-Ray, pacote inicial de stems tocando, página cheia, deslize, teclado, marcador, grifo com nota, sumário, busca |
| Anotações | grifos sobrepostos cortam o texto certo, frases com posições exatas, exportação Markdown, busca sem acento, página cheia não passa da altura e títulos de capítulo abrem tela nova |
| Importação | testes de reflow: cabeçalhos/rodapés repetidos, paginação, hifenização, EPUB (marcadores e notas), Gutenberg |
| Obras iniciais | planos calibrados válidos para todas as páginas das 3 obras |
| Repositório de sons | 18 testes (semelhança, chave, geração única, limite, normalização de volume) + 14 checagens da função `sound-resolve` + funções SQL num PostgreSQL 16 |
| Funções do servidor | 40 checagens: login, cache compartilhado, limite diário, só-cache para livros públicos, pré-cálculo com segredo, entradas inválidas, PDF de outro leitor, PDF apagado após leitura |
| Migração do banco | aplicada num PostgreSQL 16 com ambiente Supabase simulado; regras de acesso testadas (cada leitor só vê o que é seu) |
| Tipos | `tsc` estrito em todo o código do app |

**Ainda precisa ser testado num aparelho** (não havia como instalar as bibliotecas nativas no ambiente onde o projeto foi escrito):

- primeira compilação: possíveis ajustes de versão das bibliotecas (`npx expo-doctor` ajuda);
- `react-native-audio-api`: nomes das opções do plugin no `app.json` e de `AudioManager.setAudioSessionOptions` (em `src/audio/context.ts`) podem variar por versão — se o `prebuild` reclamar do plugin, remova a entrada dele; o modo de áudio em segundo plano do iOS já está no `infoPlist`;
- `createBiquadFilter` (low-pass) no `react-native-audio-api`: se a versão instalada não tiver, o motor segue sem o filtro;
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
src/core/            lógica pura, testável: texto, reflow, EPUB, palavras-chave, planos/matriz de mixagem,
                     suavização, enredo (scenery), capítulos, glossário, X-Ray, ritmo, recapitulação
src/reader/          componentes do leitor: texto com X-Ray, painéis de som, tipografia e X-Ray
src/audio/           motor de áudio (engine); context.ts = celular, context.web.ts = navegador
src/state/           SQLite local (repo) e diretor de cena (planos da IA em lotes)
src/services/        Supabase, IA, importação, sincronização, repositório de sons, offline, Gutenberg, pacote inicial
src/data/            histórias de exemplo (books.ts) e obras de domínio público sonorizadas (classics.ts)
supabase/            migração SQL e funções (Deno)
scripts/             verificações, cópia do Gutenberg, pacote de stems e pré-cálculo (Bun)
__tests__/           testes (Jest)
```

## Próximos passos até a loja

1. **Testar num aparelho** e ajustar o que a lista acima apontar.
2. **Pacote inicial de stems**: adicionar o segredo `ELEVENLABS_API_KEY` no GitHub e conferir os sons gerados.
3. **Conta com e-mail**: vincular a conta anônima (`supabase.auth.updateUser({ email })`) para levar a biblioteca a outro aparelho sem perder nada.
4. **Assinatura** (compras dentro do app — obrigatório nas lojas para conteúdo digital), por exemplo com RevenueCat; o `AI_DAILY_LIMIT` pode variar por plano.
5. **Ícone, splash, política de privacidade** (explicar que PDFs são lidos no servidor e apagados, e que trechos vão para a IA) e notas para a revisão da Apple.
6. **Publicar** com `npx eas build --profile production` e `npx eas submit`.

## Preview web

Há uma versão para navegador, só para visualizar o app (biblioteca, leitor, glossário e sons sintetizados pelo Web Audio). No navegador o banco local usa `sql.js` (`src/state/db.web.ts`), salvo no `localStorage`.

- Rodar localmente: `npx expo start --web`
- Publicada automaticamente no GitHub Pages pelo workflow `.github/workflows/preview.yml` a cada push. Se o deploy falhar na primeira vez, ative em **Settings → Pages → Source: GitHub Actions** e rode o workflow de novo.
