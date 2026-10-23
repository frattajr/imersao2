# Lago Sereno — pescaria com gestos

Jogo de pescaria calmo, feito para o celular. Os controles são gestos com o dedo, no estilo da captura do Pokémon GO.

| Gesto | O que faz |
| --- | --- |
| **Tocar ou passar o dedo na água** | Faz uma gota e uma onda na água. As vitórias-régias balançam e os peixes por perto vêm ver. Com a boia na água, isso chama peixe mais rápido. |
| **Arrastar a boia para cima** | Mira. Um círculo pontilhado na água mostra onde a boia vai cair: quanto mais alto o dedo, mais longe, e o lado do dedo define a direção. A mira é puxada de leve para a sombra mais próxima. |
| **Soltar com o anel pequeno** | Lança. O peixe na mira ganha um anel que encolhe. Soltar com o anel pequeno dá *Legal*, *Ótimo* ou *Excelente*. A cor do anel mostra a raridade. |
| **Girar a boia antes de soltar** | Arremesso em curva, que vale um bônus a mais. |
| **Puxar de leve para baixo** | Fisga quando a boia afunda (há mais de 1 segundo para reagir). Se puxar cedo, o peixe só recua e volta. Se perder a hora, ele belisca de novo uma vez. Sem peixe por perto, o mesmo gesto recolhe a boia. |
| **Fazer círculos pequenos** | Gira a carretilha. Com a linha no limite, a carretilha cede linha sozinha. Ela só arrebenta se você insistir girando forte por mais de 2 segundos. |
| **Inclinar o dedo para o lado** | Quando o peixe corre, uma seta mostra para onde levar o dedo. Inclinar para o lado contrário segura a corrida e cansa o peixe mais rápido. |

## Câmera

A câmera desliza devagar, sempre com suavização:
- **Mira:** acompanha o alvo, levanta o olhar para lances longos e aproxima um pouco.
- **Arremesso:** segue a boia.
- **Espera:** centraliza a boia.
- **Briga:** acompanha o peixe e treme de leve quando ele dá uma corrida.
- **Repouso:** olha para onde o dedo está e "respira" devagar.

Morros, mata e juncos se movem em velocidades diferentes, o que dá profundidade. Quem ativa *reduzir movimento* no aparelho fica sem a respiração e sem o tremor.

## O que deixa o jogo relaxante

- **Ciclo de dia:** 12 minutos de jogo equivalem a um dia inteiro (alvorada, dia, pôr do sol, noite com estrelas e vaga-lumes). De vez em quando cai uma chuva leve.
- **Som ambiente sintetizado na hora** (Web Audio), sem arquivos para baixar. Tem água batendo, vento e chuva, passarinhos de dia, grilos e sapos à noite, além dos sons da boia, da carretilha e do respingo.
- **Vibração** ao fisgar, ao beliscar e quando a linha estica (nos aparelhos que suportam).
- **Pesque e solte:** todo peixe volta para o lago e fica anotado no **Caderno de pesca**, com quantidade e recorde de tamanho.

## Espécies

São 11 peixes de água doce do Brasil, com nome científico, tamanho real e peso calculado pelo comprimento. Alguns aparecem mais em certos horários:

- **Comum:** Lambari, Acará (dia), Tilápia.
- **Incomum:** Traíra (noite), Piau-três-pintas (alvorada e fim de tarde), Pacu (dia), Tambaqui.
- **Raro:** Tucunaré (dia), Dourado (alvorada e fim de tarde), Pintado (noite).
- **Lendário:** Pirarucu.

## Como abrir

Não precisa de instalação nem de compilação: é uma página só (`index.html`).

- **No computador:** abra `pescaria/index.html` no navegador.
- **No celular:** publique a pasta em qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify, Vercel). Depois toque em *Adicionar à tela inicial*: o jogo abre em tela cheia e funciona sem internet (`sw.js` guarda os arquivos no aparelho).

## Arquivos

- `index.html`: o jogo inteiro (desenho em canvas, gestos, som e caderno).
- `manifest.webmanifest`, `icon.svg`: dados para instalar como app.
- `sw.js`: cache para jogar offline.

O caderno fica salvo no `localStorage` do navegador.
