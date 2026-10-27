import { Icon } from '../components/Icon';
import { KIND_INFO, KindBadge, SectionTitle } from '../components/ui';
import type { DataKind } from '../data/types';
import { useStore } from '../lib/store';

const HYPOTHESES = [
  'Profissionais valorizam mais orientações sobre situações difíceis do que listas de competências.',
  'Uma faixa salarial com fonte clara gera mais confiança do que um número único.',
  'Um plano de 30/60/90 dias é um horizonte que as pessoas conseguem acompanhar sem abandonar.',
  'A autoavaliação opcional torna o plano mais útil sem afastar quem só quer explorar.',
];

const SOURCES = [
  { name: 'RAIS e Novo CAGED (Ministério do Trabalho e Emprego)', use: 'Remuneração e movimentação de vínculos formais por ocupação (CBO), região e setor.' },
  { name: 'PNAD Contínua (IBGE)', use: 'Rendimento por ocupação e características do trabalho, com recorte amostral.' },
  { name: 'Pesquisas salariais de consultorias de recrutamento', use: 'Faixas por cargo e porte, com metodologia própria a ser declarada em cada uso.' },
  { name: 'Dados enviados por usuários, com consentimento', use: 'Complemento, sempre identificado como autodeclarado e com tamanho de amostra.' },
];

export function About() {
  const { dispatch } = useStore();
  return (
    <div className="wrap page narrow about">
      <span className="eyebrow">
        <Icon name="info" size={16} /> Sobre o projeto
      </span>
      <h1>Tornar explícito o que se aprende só na prática</h1>
      <p className="lead">
        Muito do que define uma carreira nas empresas é aprendido de forma informal: o que esperam de você, como negociar, como
        ganhar influência, quais regras não estão escritas. O CarreiraLuz organiza esse conhecimento por cargo, senioridade,
        mercado e porte de empresa.
      </p>

      <section className="page-section">
        <SectionTitle title="As cinco perguntas que o guia responde" />
        <ol className="numbered">
          <li>O que esperam de alguém que ocupa esse cargo?</li>
          <li>Quanto ganha e quanto tempo costuma permanecer nessa posição?</li>
          <li>O que diferencia um profissional mediano de um que se destaca?</li>
          <li>O que preciso saber para estar preparado para ocupar essa cadeira?</li>
          <li>Quais são os desafios reais que quase ninguém conversa abertamente?</li>
        </ol>
      </section>

      <section className="page-section">
        <SectionTitle
          title="Como tratamos dados e fontes"
          subtitle="Cada informação mostra a sua natureza. Nunca apresentamos uma estimativa ou um exemplo como se fosse dado observado."
        />
        <div className="kind-legend">
          {(Object.keys(KIND_INFO) as DataKind[]).map((k) => (
            <div key={k}>
              <KindBadge kind={k} />
              <span>{KIND_INFO[k].text}</span>
            </div>
          ))}
        </div>
        <div className="note note-amber">
          <Icon name="alert" size={18} />
          <span>
            <b>Situação atual do MVP:</b> ainda não há integração com bases salariais ou de permanência. Os valores de salário e
            tempo na posição do perfil de exemplo são <b>demonstrativos</b>. Nos demais perfis, mostramos{' '}
            <b>Dados insuficientes</b> em vez de inventar números.
          </span>
        </div>
      </section>

      <section className="page-section">
        <SectionTitle title="Fontes candidatas para as próximas versões" subtitle="Ainda não integradas. Listadas para transparência sobre o caminho previsto." />
        <ul className="source-list">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <b>{s.name}</b>
              <span>{s.use}</span>
            </li>
          ))}
        </ul>
        <p className="muted small">
          Cuidados previstos: diferenciar salário bruto e líquido, informar data de referência, região e tamanho da amostra, e não
          confundir tempo de permanência no cargo com tempo até promoção.
        </p>
      </section>

      <section className="page-section">
        <SectionTitle title="Hipóteses que este MVP quer validar" />
        <ul className="icon-list">
          {HYPOTHESES.map((h) => (
            <li key={h}>
              <KindBadge kind="hipotese" /> <span>{h}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-section">
        <SectionTitle title="Privacidade" />
        <p>
          Não há conta nem servidor. Seleções, autoavaliação e plano ficam apenas no armazenamento deste navegador e não são
          enviados a lugar nenhum.
        </p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (!confirm('Apagar todas as suas escolhas, autoavaliações e planos deste navegador?')) return;
            try {
              Object.keys(localStorage)
                .filter((k) => k.startsWith('carreiraluz:prep:'))
                .forEach((k) => localStorage.removeItem(k));
            } catch {
              // armazenamento indisponível
            }
            dispatch({ type: 'reset' });
          }}
        >
          <Icon name="trash" size={16} /> Apagar meus dados deste navegador
        </button>
      </section>
    </div>
  );
}
