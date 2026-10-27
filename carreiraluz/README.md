# CarreiraLuz — MVP

Plataforma educacional que ajuda profissionais a entender o que precisam dominar para ocupar, desempenhar bem e evoluir em um cargo. Protótipo navegável, sem backend: todo o estado fica no navegador.

```bash
cd carreiraluz
npm install
npm run dev        # desenvolvimento
npm test           # testes (vitest)
npm run build      # typecheck + build estático em dist/ (abre em qualquer subpasta)
```

## O que dá para fazer

1. **Início** — três seletores: cargo (busca com sugestões por área + nível), mercado (cards) e porte (cards, com opção "não sei o número exato").
2. **Seu guia** (`#/guia`) — os quatro indicadores (tempo na posição, salário, principal desafio, diferencial) com explicação ao passar o cursor/tocar e a natureza de cada dado; observações do mercado e do porte; "O que você precisa saber para sentar nessa cadeira" em quatro abas (técnico, comportamental, entregas, próxima cadeira) com barras de domínio e autoavaliação opcional; a seção "Desafios que ninguém conversa". O perfil pode ser alterado ali mesmo, sem recomeçar.
3. **Desafios** (`#/desafio/:id`) — 15 guias com os 8 passos (o que está acontecendo → quando exige cautela), frases copiáveis, checklist de preparação e notas para o mercado/porte escolhidos.
4. **Meu PDI** (`#/pdi`) — plano de 30/60/90 dias gerado do perfil; marcar como concluído, progresso por horizonte e geral, editar, remover e adicionar itens. Itens **genéricos** e **personalizados** (vindos da autoavaliação ou escritos pela pessoa) são identificados.
5. **Biblioteca** (`#/biblioteca`) — busca em linguagem natural (sem acento, sinônimos, plural) e filtros por cargo, senioridade, mercado, porte, tema, tipo de desafio e momento de carreira.
6. **Explorar cargos** e **Sobre o projeto** (legenda de natureza dos dados, fontes candidatas, hipóteses a validar, apagar dados locais).

## Credibilidade dos dados

Toda informação carrega um `DataKind`: `observado`, `estimativa`, `demonstrativo`, `qualitativo`, `recomendacao`, `hipotese` ou `insuficiente`, mostrado na interface com fonte, período, recorte e data de revisão.

- **Não há integração com bases reais.** Salário (R$ 7.000–12.000) e permanência (2 a 4 anos) do perfil de referência são **demonstrativos** e aparecem assim. Mediana e percentis só aparecem com dados observados.
- Cargos sem conteúdo revisado usam um **guia genérico** (área × senioridade) e mostram **"Dados insuficientes"** nos números.

## Como incluir cargos e dados

```
src/data/
  types.ts            modelo (perfil, indicadores, desafios, PDI)
  catalog.ts          cargos, níveis, mercados, portes
  profiles/           perfis revisados + gerador do guia genérico
  context.ts          observações por mercado e porte
  challenges.ts       guias "Desafios que ninguém conversa"
  library.ts          artigos, temas, tipos e momentos de carreira
src/lib/              busca, gerador do PDI, estado local, rotas
```

- **Novo cargo:** adicione em `ROLES` (`catalog.ts`). Ele já ganha guia genérico.
- **Conteúdo revisado:** crie `profiles/<cargo>-<nivel>.ts` no formato de `analista-marketing-senior.ts` e registre em `profiles/index.ts`.
- **Dados reais:** troque `salary`/`tenure` do perfil por `kind: 'observado'` com `source`, `period`, `geography` e `percentiles`; a interface passa a mostrá-los sem mudanças.
