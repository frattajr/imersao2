# Lago Sereno — pescaria com gestos

Jogo de pescaria calmo, feito para o celular. Os controles são gestos com o dedo, no estilo da captura do Pokémon GO.

| Gesto | O que faz |
| --- | --- |
| **Segurar a boia e deslizar para cima** | Lança a boia. A força do gesto define a distância e o ângulo define a direção. |
| **Soltar com o anel pequeno** | Enquanto você segura a boia, cada sombra de peixe ganha um anel que encolhe. Cair dentro dele dá *Legal*, *Ótimo* ou *Excelente*, e o peixe morde mais rápido e briga menos. A cor do anel mostra a raridade: verde, amarelo, laranja ou rosa. |
| **Girar a boia antes de lançar** | Faz um arremesso em curva, que vale um bônus a mais. |
| **Puxar para baixo** | Fisga o peixe quando a boia afunda. Se puxar enquanto ele ainda só belisca, ele foge. Sem peixe por perto, o mesmo gesto recolhe a boia. |
| **Fazer círculos com o dedo** | Gira a carretilha. O arco mostra a tensão da linha: se ficar no vermelho, pare de girar e deixe o peixe correr, senão a linha arrebenta. |

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
