# Atendente IA para WhatsApp

Painel web em que você **cadastra as APIs e os dados dos serviços**. O servidor monta o resto sozinho: o prompt da IA, as ferramentas de orçamento, agenda, desconto e cobrança, o webhook do WhatsApp, o funil de clientes, os follow-ups e os eventos para integração.

Feito para pequenas empresas de serviço: diarista, eletricista, clínica de estética etc. Várias empresas podem usar o mesmo servidor.

## Como rodar

```bash
cd atendente
npm install
cp .env.example .env        # defina SENHA_PAINEL e URL_PUBLICA
node --env-file=.env src/servidor.js
```

Abra `http://localhost:3000` e entre com o usuário `admin` e a senha do `.env`.

## Passo a passo no painel

1. **Nova empresa:** informe o nome e o ramo. Os serviços e as perguntas frequentes do ramo vêm preenchidos.
2. **Negócio, Serviços e Regras:** ajuste preços, expediente, bairros, desconto máximo, sinal e follow-up.
3. **APIs e integrações:** cole a chave da Anthropic, o token e o ID do número do WhatsApp, e a forma de pagamento (Pix ou Mercado Pago). Clique em **Testar conexões**.
4. **Estrutura gerada:** copie a URL e o token do webhook para o app da Meta (assine o campo `messages`) e veja o que ainda falta.
5. **Testar conversa:** converse com a IA como se fosse um cliente, sem enviar nada pelo WhatsApp.
6. **Clientes e agenda:** acompanhe o funil, leia as conversas e assuma ou devolva um atendimento para a IA.

Para receber mensagens de verdade, o servidor precisa estar num endereço público com HTTPS (Render, Railway, Fly.io ou uma VPS). Para testar no seu computador, use `cloudflared tunnel` ou `ngrok`.

## O que a IA pode fazer (ferramentas)

| Ferramenta | O que faz | Regra garantida pelo código |
|---|---|---|
| `calcular_orcamento` | Preço fixo, por unidade, faixa ou visita técnica | A IA nunca faz a conta |
| `aplicar_desconto` | Aprova ou recusa o desconto | Limite máximo da empresa |
| `horarios_livres` / `agendar` | Agenda interna | Expediente, antecedência e conflito de horário |
| `gerar_cobranca_sinal` | Chave Pix ou link do Mercado Pago | Percentual do sinal da empresa |
| `registrar_lead` | Etapa do funil e dados do cliente | — |
| `chamar_humano` | Passa a conversa para a equipe e avisa o dono | A IA para de responder esse cliente |

Outros comportamentos automáticos:
- **Follow-up:** a cada 15 minutos, o servidor manda mensagem para orçamentos sem resposta (1 e 3 dias, configurável) e lembretes de agendamento nas próximas 24h. Fora da janela de 24h, usa os modelos aprovados pela Meta que você cadastrar.
- **Webhook de saída:** cada evento (`orcamento.calculado`, `agendamento.criado`, `cobranca.gerada`, `lead.<etapa>`...) vai em JSON para a URL configurada (n8n, Make, Zapier ou CRM).

## Testes

```bash
npm test
```

## Limites desta versão

- Os dados ficam em arquivos JSON na pasta `dados/`, com as chaves de API em texto puro. Proteja o servidor e faça backup dessa pasta. Para muitas empresas, troque `src/armazem.js` por Postgres.
- Fotos e áudios chegam como aviso ("o cliente enviou uma foto"). Ler a imagem e transcrever o áudio ficam para o próximo passo.
- A confirmação automática de pagamento (webhook do Mercado Pago) e o Google Agenda ainda não estão ligados. A agenda é interna.
- Se não houver modelo de follow-up cadastrado, o follow-up daquele cliente é pulado (aparece o evento `followup.sem_modelo`) e não é reenviado depois.

## Estrutura

```
src/servidor.js     painel, API e webhook do WhatsApp
src/estrutura.js    monta o prompt, as ferramentas e a checklist a partir dos dados
src/ia.js           conversa com o Claude (cache de prompt, troca automática de modelo em recusa)
src/ferramentas.js  regras de negócio das ferramentas
src/precos.js       motor de preços
src/agenda.js       horários livres com fuso horário
src/atendimento.js  junta mensagens picadas, transferência para humano
src/followup.js     follow-ups e lembretes
src/whatsapp.js     WhatsApp Cloud API
src/pagamento.js    Pix manual e Mercado Pago
src/eventos.js      webhook de saída
src/ramos.js        modelos prontos por ramo
public/             painel (HTML, CSS e JS, sem build)
```
