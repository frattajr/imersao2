# Lago Sereno

Um jogo de pescaria para o celular que é mais lugar do que jogo. Você está sentado num trapiche, com uma vara de bambu na mão, e o dia passa devagar sobre o lago. Não há placar, medidor nem contador. O que você pesca vira uma lembrança escrita à mão num diário, e todo peixe volta para a água.

## Gestos

Os gestos imitam o corpo de quem pesca. A parte de baixo da tela é a mão na vara; a parte de cima é a água. Um rastro suave mostra o caminho do dedo, e a vara sempre aponta para o que você está fazendo: para o dedo, para a boia ou para o peixe.

| Gesto | O que acontece |
| --- | --- |
| **Tocar na parte de baixo e arrastar para cima** | A boia vem para a mão e fica logo acima do dedo. Uma luz aparece na água sempre à mesma distância acima do dedo e segue cada movimento, sem atraso; a ponta da vara aponta para ela. A câmera fica parada enquanto você mira, para a água não escorregar debaixo do dedo. Perto de uma sombra, a luz é puxada de leve para ela. |
| **Soltar** | A boia sai do ponto onde o dedo soltou e faz um arco até a luz, enquanto a vara chicoteia para a frente. Soltar sem ter arrastado não lança nada. |
| **Tocar ou passar o dedo na água** | Gotas e ondas. As vitórias-régias balançam e os peixes por perto vêm ver. |
| **Um toque curto para cima, com a boia na água** | Dá vida à isca: a boia mexe e atrai quem estiver por perto. |
| **Puxar firme quando a boia afunda** | Fisga, para cima ou para baixo. Puxar cedo só faz o peixe recuar e voltar; perder a hora dá uma segunda chance. Sem peixe por perto, puxar para baixo recolhe a boia. |
| **Pequenos círculos** | Giram a carretilha de madeira. Não há barra de tensão: você sente pela vara que verga, pela linha que brilha e treme, pelo som da linha esticada e pela vibração do celular. Só arrebenta se insistir girando forte por mais de 2 segundos. |
| **Levar o dedo para o lado** | Quando o peixe corre, levar o dedo para o lado contrário segura a corrida e o cansa mais rápido. A câmera inclina junto. |
| **Deslizar a página para baixo** | Devolve o peixe: ele desce na linha, toca a água e nada para o fundo. |

As dicas aparecem só até a primeira pesca. Depois, o jogo fica em silêncio e só fala se a linha estiver no limite.

## O que deixa a cena viva

- **Câmera:** desliza devagar, sempre suavizada.
  - Na mira, acompanha a luz; no ar, segue a boia; na espera, centraliza a boia.
  - Na briga, acompanha o peixe e inclina com o dedo.
  - Quando o peixe sai da água, aproxima.
  - Em repouso, respira de leve.
- **Profundidade:** morros, mata e juncos se movem em velocidades diferentes. Quem ativa *reduzir movimento* no aparelho fica sem respiração, tremor, inclinação e grão.
- **Luz:** 12 minutos de jogo equivalem a um dia inteiro.
  - Hora dourada com raios de sol e partículas no ar.
  - Coluna de luz do sol ou da lua na água.
  - Névoa ao amanhecer e à noite.
  - Estrelas, vaga-lumes e uma lamparina no trapiche que acende ao entardecer e se reflete na água.
  - De vez em quando, chuva fina.
- **Natureza:** folhas caem e ficam boiando, pássaros cruzam o céu e peixes sobem para beijar a superfície. De longe, às vezes um peixe salta.
- **Som e música,** sintetizados na hora (Web Audio), sem arquivos:
  - **Ambiente:** água, vento, chuva, pássaros, grilos e sapos com reverberação de lago aberto.
  - **Piano:** toca notas soltas que mudam com a hora do dia e fica mais baixo durante a briga.
  - **Ao tirar um peixe da água:** uma frase curta.
- **Palavras:** a cada minuto e pouco, nos momentos de quietude, aparece um verso curto que muda com a hora e o tempo.

## Diário do lago

Cada peixe vira uma página com:
- a data e a hora do dia;
- uma lembrança escrita à mão (por exemplo, "Uma tilápia de 35 cm, no pôr do sol. A primeira vez que vi uma de perto.");
- medidas, nome científico e uma nota sobre a espécie.

O diário guarda as últimas lembranças e mostra os 11 peixes brasileiros: os que você já viu e os que ainda não viu, com dicas de quando costumam aparecer.

- **Comuns:** Lambari, Acará (de dia), Tilápia.
- **Pouco comuns:** Traíra (à noite), Piau-três-pintas (ao amanhecer e no fim da tarde), Pacu (de dia), Tambaqui.
- **Raros:** Tucunaré (de dia), Dourado (ao amanhecer e no fim da tarde), Pintado (à noite).
- **Lenda do lago:** Pirarucu.

## Como abrir

Não precisa de instalação nem de compilação: é uma página só (`index.html`).

- **No computador:** abra `pescaria/index.html` no navegador.
- **No celular:** publique a pasta em qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify, Vercel) e toque em *Adicionar à tela inicial*. O jogo abre em tela cheia e funciona sem internet (`sw.js` guarda os arquivos no aparelho).

## Arquivos

- `index.html`: o jogo inteiro (desenho em canvas, gestos, som, música e diário).
- `manifest.webmanifest`, `icon.svg`: dados para instalar como app.
- `sw.js`: cache para jogar offline.

O diário fica salvo no `localStorage` do navegador.
