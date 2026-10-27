import { useMemo, useState } from 'react';
import { ChallengeCard } from '../components/ChallengeCard';
import { Icon } from '../components/Icon';
import { ProfileSelector } from '../components/ProfileSelector';
import { InfoTip, KindBadge, ProvenanceLine, SectionTitle } from '../components/ui';
import { CHALLENGES } from '../data/challenges';
import { levelLabel, marketLabel, roleTitle, sizeLabel } from '../data/catalog';
import { MARKET_CONTEXT, SIZE_CONTEXT } from '../data/context';
import { CATEGORIES } from '../data/library';
import { getProfile } from '../data/profiles';
import type { CareerProfile, Competency, CompetencyGroup, SalaryIndicator, TenureIndicator } from '../data/types';
import { SELF_LABELS, type SelfAssessment } from '../lib/pdi';
import { href, navigate } from '../lib/router';
import { profileKey, useStore } from '../lib/store';

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function Guide() {
  const { state, dispatch } = useStore();
  const sel = state.selection;
  const profile = getProfile(sel.roleId, sel.level);
  const [editing, setEditing] = useState(!state.chosen);
  const [draft, setDraft] = useState(sel);

  if (!profile) {
    return (
      <div className="wrap page narrow center">
        <p>Não encontramos esse cargo.</p>
        <a className="btn btn-primary" href={href('/')}>
          Escolher novamente
        </a>
      </div>
    );
  }
  const key = profileKey(sel);
  const self = state.self[key] ?? {};

  return (
    <div className="guide">
      <section className="guide-head">
        <div className="wrap">
          <div className="crumbs">
            <a href={href('/')}>Início</a> <Icon name="chevron-right" size={14} /> Seu guia
          </div>
          <div className="guide-title">
            <div>
              <h1>{roleTitle(sel.roleId, sel.level)}</h1>
              <p className="profile-line">
                <span>
                  <Icon name="briefcase" size={16} /> {marketLabel(sel.marketId)}
                </span>
                <span>
                  <Icon name="size-l" size={16} /> {sizeLabel(sel.sizeId)} empresa
                </span>
                {profile.coverage === 'completo' ? (
                  <span className="badge badge-green">Conteúdo revisado</span>
                ) : (
                  <span className="badge badge-gray" title="Combina referências da área e da senioridade">
                    Guia genérico — cargo em construção
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              aria-expanded={editing}
              onClick={() => {
                setDraft(sel);
                setEditing((e) => !e);
              }}
            >
              <Icon name={editing ? 'x' : 'edit'} size={16} /> {editing ? 'Fechar' : 'Alterar perfil'}
            </button>
          </div>
          {editing && (
            <div className="panel edit-panel">
              <ProfileSelector
                value={draft}
                onChange={setDraft}
                submitLabel="Atualizar meu guia"
                onSubmit={() => {
                  dispatch({ type: 'select', selection: draft });
                  setEditing(false);
                }}
              />
            </div>
          )}
          <p className="summary">{profile.summary}</p>
        </div>
      </section>

      <section className="wrap indicators" aria-label="Indicadores principais">
        <TenureCard t={profile.tenure} />
        <SalaryCard s={profile.salary} />
        <TextCard
          icon="mountain"
          tone="peach"
          title="Principal desafio da cadeira"
          tip="A situação que mais costuma pesar no dia a dia desta posição, considerando senioridade, mercado e porte."
          ind={profile.mainChallenge}
        />
        <TextCard
          icon="star"
          tone="lilac"
          title="O que mais diferencia esse profissional"
          tip="Comportamentos, competências ou resultados que costumam separar quem se destaca de quem apenas cumpre o esperado."
          ind={profile.differentiator}
        />
      </section>

      <section className="wrap context-row" aria-label="O seu contexto">
        {[MARKET_CONTEXT[sel.marketId], SIZE_CONTEXT[sel.sizeId]].map((n) => (
          <div className="context-note" key={n.title}>
            <Icon name="compass" size={18} />
            <div>
              <b>{n.title}</b>
              <p>{n.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="wrap page-section">
        <SectionTitle eyebrow="Expectativas" title="O que esperam de quem ocupa essa cadeira" />
        <ul className="checklist">
          {profile.expectations.map((e) => (
            <li key={e}>
              <Icon name="check" size={18} /> {e}
            </li>
          ))}
        </ul>
      </section>

      <ChairSection profile={profile} self={self} profileKeyStr={key} />

      <ChallengesSection levelId={sel.level} marketId={sel.marketId} sizeId={sel.sizeId} />

      <section className="wrap page-section">
        <div className="cta-pdi">
          <div>
            <span className="eyebrow">
              <Icon name="target" size={16} /> Meu plano de evolução
            </span>
            <h2>Transforme este guia em um plano de 30, 60 e 90 dias</h2>
            <p>
              O plano usa o seu cargo, mercado e porte. Se você fizer a autoavaliação acima, ele prioriza o que você mesmo(a)
              apontou como lacuna.
            </p>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/pdi')}>
            Criar meu PDI <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

function IndicatorShell({
  icon,
  tone,
  title,
  tip,
  children,
}: {
  icon: string;
  tone: string;
  title: string;
  tip: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className={`indicator tone-${tone}`}>
      <header>
        <span className="ind-icon">
          <Icon name={icon} size={20} />
        </span>
        <h3>{title}</h3>
        <InfoTip label={`O que significa: ${title}`}>{tip}</InfoTip>
      </header>
      {children}
    </article>
  );
}

function TenureCard({ t }: { t: TenureIndicator }) {
  const has = t.minYears != null && t.maxYears != null && t.kind !== 'insuficiente';
  return (
    <IndicatorShell
      icon="clock"
      tone="blue"
      title="Tempo médio na posição"
      tip={
        <>
          Quanto tempo as pessoas costumam permanecer nesta posição antes de mudar de cargo ou de empresa.{' '}
          <b>Não é o tempo até uma promoção</b>: muita gente muda de empresa ou de área sem ser promovida.
          {t.note && <span className="tip-note">{t.note}</span>}
        </>
      }
    >
      <p className={`ind-value${has ? '' : ' empty'}`}>{has ? `${t.minYears} a ${t.maxYears} anos` : 'Dados insuficientes'}</p>
      <ProvenanceLine p={t} compact />
    </IndicatorShell>
  );
}

function SalaryCard({ s }: { s: SalaryIndicator }) {
  const [open, setOpen] = useState(false);
  const r = s.range;
  const pct = r?.percentiles;
  return (
    <IndicatorShell
      icon="wallet"
      tone="green"
      title="Salário médio"
      tip={
        <>
          Faixa salarial mensal para o recorte escolhido. Mostramos uma faixa, e não um número só, porque a remuneração varia
          com região, empresa e trajetória.
          {s.note && <span className="tip-note">{s.note}</span>}
        </>
      }
    >
      {r && s.kind !== 'insuficiente' ? (
        <>
          <p className="ind-value">
            {brl(r.min)}–{brl(r.max).replace('R$', '').trim()}
            <small>/mês</small>
          </p>
          <p className="ind-sub">
            {r.gross ? 'Bruto' : 'Líquido'} · {r.basis}
          </p>
          <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Ocultar detalhes' : 'Mínimo, mediana e percentis'} <Icon name="chevron-down" size={14} />
          </button>
          {open && (
            <div className="salary-detail">
              <dl>
                <dt>Mínimo da faixa</dt>
                <dd>{brl(r.min)}</dd>
                <dt>Máximo da faixa</dt>
                <dd>{brl(r.max)}</dd>
                <dt>Mediana</dt>
                <dd>{r.median ? brl(r.median) : 'Dados insuficientes'}</dd>
              </dl>
              {pct ? (
                <dl>
                  {(['p10', 'p25', 'p50', 'p75', 'p90'] as const).map((k) =>
                    pct[k] ? (
                      <div key={k}>
                        <dt>{k.toUpperCase()}</dt>
                        <dd>{brl(pct[k]!)}</dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              ) : (
                <p className="muted small">
                  Percentis só aparecem com dados observados suficientes. Este valor é {s.kind === 'demonstrativo' ? 'demonstrativo' : 'uma estimativa'}.
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="ind-value empty">Dados insuficientes</p>
          <p className="ind-sub">Preferimos não mostrar um número a mostrar um número inventado.</p>
        </>
      )}
      <ProvenanceLine p={s} compact />
    </IndicatorShell>
  );
}

function TextCard({ icon, tone, title, tip, ind }: { icon: string; tone: string; title: string; tip: string; ind: CareerProfile['mainChallenge'] }) {
  return (
    <IndicatorShell icon={icon} tone={tone} title={title} tip={<>{tip}<span className="tip-note">{ind.detail}</span></>}>
      <p className="ind-text">{ind.headline}</p>
      <p className="ind-sub">{ind.detail}</p>
      <ProvenanceLine p={ind} compact />
    </IndicatorShell>
  );
}

const TABS = [
  { id: 'tecnico', label: 'Conhecimentos técnicos', letter: 'A' },
  { id: 'comportamental', label: 'Competências comportamentais', letter: 'B' },
  { id: 'entregas', label: 'Entregas esperadas', letter: 'C' },
  { id: 'proxima', label: 'O que muda na próxima cadeira', letter: 'D' },
] as const;

function ChairSection({ profile, self, profileKeyStr }: { profile: CareerProfile; self: SelfAssessment; profileKeyStr: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('tecnico');
  return (
    <section className="wrap page-section" aria-labelledby="cadeira">
      <SectionTitle
        id="cadeira"
        eyebrow="Para sentar nessa cadeira"
        title="O que você precisa saber para sentar nessa cadeira"
        subtitle="Conhecimentos, comportamentos, entregas e o que muda no próximo nível. Use a autoavaliação opcional para se situar."
      />
      <div className="tabs" role="tablist" aria-label="Grupos de conteúdo">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? 'on' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-letter">{t.letter}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'tecnico' && <CompetencyPanel group={profile.technical} self={self} profileKeyStr={profileKeyStr} />}
        {tab === 'comportamental' && <CompetencyPanel group={profile.behavioral} self={self} profileKeyStr={profileKeyStr} />}
        {tab === 'entregas' && <DeliverablesPanel profile={profile} />}
        {tab === 'proxima' && <NextChairPanel profile={profile} />}
      </div>
    </section>
  );
}

function CompetencyPanel({ group, self, profileKeyStr }: { group: CompetencyGroup; self: SelfAssessment; profileKeyStr: string }) {
  return (
    <div>
      <p className="muted">{group.subtitle}</p>
      <div className="disclaimer">
        <Icon name="info" size={16} />
        <span>
          A barra mostra o nível que <b>costuma ser esperado</b> nesta cadeira (referência qualitativa). A autoavaliação é só a
          sua percepção, para orientar o seu plano. <b>Não é uma avaliação científica</b> nem um diagnóstico.
        </span>
      </div>
      {group.sections.map((s) => (
        <div key={s.title} className="comp-section">
          <h3>{s.title}</h3>
          {s.items.map((c) => (
            <CompetencyRow key={c.id} c={c} value={self[c.id]} profileKeyStr={profileKeyStr} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CompetencyRow({ c, value, profileKeyStr }: { c: Competency; value?: number; profileKeyStr: string }) {
  const { dispatch } = useStore();
  return (
    <div className="comp">
      <div className="comp-main">
        <div className="comp-name">
          <b>{c.name}</b>
          <span className="muted">{c.description}</span>
        </div>
        <div className="mastery" aria-label={`Esperado: ${SELF_LABELS[c.expected - 1]}${value ? `; você: ${SELF_LABELS[value - 1]}` : ''}`}>
          <div className="mastery-track">
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`seg${n <= c.expected ? ' exp' : ''}${value && n <= value ? ' you' : ''}`} />
            ))}
          </div>
          <span className="mastery-label">
            Esperado: <b>{SELF_LABELS[c.expected - 1]}</b>
          </span>
        </div>
      </div>
      <p className="comp-example">
        <Icon name="bulb" size={16} /> <span>{c.example}</span>
      </p>
      {c.contextNote && (
        <p className="comp-context">
          <Icon name="compass" size={16} /> <span>{c.contextNote}</span>
        </p>
      )}
      <div className="self" role="radiogroup" aria-label={`Como você se percebe em ${c.name}`}>
        <span className="self-label">Como você se percebe hoje?</span>
        {SELF_LABELS.map((l, i) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === i + 1}
            className={`chip chip-sm${value === i + 1 ? ' on' : ''}`}
            onClick={() =>
              dispatch({ type: 'rate', profileKey: profileKeyStr, competencyId: c.id, value: value === i + 1 ? null : i + 1 })
            }
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeliverablesPanel({ profile }: { profile: CareerProfile }) {
  const d = profile.deliverables;
  return (
    <div className="deliv-grid">
      <div className="card">
        <h3>
          <Icon name="flag" size={18} /> Resultados que devem ser produzidos
        </h3>
        <ul className="checklist">
          {d.results.map((r) => (
            <li key={r}>
              <Icon name="check" size={16} /> {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>
          <Icon name="shield" size={18} /> Decisões que você deve conseguir tomar
        </h3>
        <ul className="checklist">
          {d.decisions.map((r) => (
            <li key={r}>
              <Icon name="check" size={16} /> {r}
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <h3>
          <Icon name="compass" size={18} /> Grau de autonomia esperado
        </h3>
        <p>{d.autonomy}</p>
      </div>
      <div className="card">
        <h3>
          <Icon name="trend" size={18} /> Indicadores de bom desempenho
        </h3>
        <ul className="tags">
          {d.kpis.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
      <div className="card span-2">
        <h3>
          <Icon name="layers" size={18} /> Como muda a expectativa entre níveis
        </h3>
        <ol className="level-steps">
          {d.byLevel.map((b) => (
            <li key={b.level} className={b.level === profile.level ? 'current' : ''}>
              <b>
                {levelLabel(b.level)}
                {b.level === profile.level && ' (você)'}
              </b>
              <span>{b.expectation}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function NextChairPanel({ profile }: { profile: CareerProfile }) {
  const n = profile.nextChair;
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  return (
    <div>
      <div className="compare">
        <div className="compare-head">
          <span>Hoje: {roleTitle(profile.roleId, profile.level)}</span>
          <span>Próximo nível: {n.nextTitle}</span>
        </div>
        {n.shifts.map((s) => (
          <div className="compare-row" key={s.today}>
            <p className="today">{s.today}</p>
            <Icon name="arrow-right" size={18} className="compare-arrow" />
            <p className="next">{s.next}</p>
          </div>
        ))}
      </div>
      <div className="card readiness">
        <h3>Sinais de que você está se aproximando do próximo nível</h3>
        <p className="muted small">Marque o que já acontece hoje. É uma reflexão pessoal, não uma avaliação.</p>
        <ul className="checklist interactive">
          {n.readinessSignals.map((r, i) => (
            <li key={r}>
              <label>
                <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked((c) => ({ ...c, [i]: e.target.checked }))} />
                {r}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChallengesSection({ levelId, marketId, sizeId }: { levelId: CareerProfile['level']; marketId: string; sizeId: string }) {
  const [cat, setCat] = useState<string>('');
  const relevant = useMemo(
    () => CHALLENGES.filter((c) => !c.levels.length || c.levels.includes(levelId)),
    [levelId],
  );
  const cats = CATEGORIES.filter((c) => relevant.some((r) => r.category === c.id));
  const shown = relevant
    .filter((c) => !cat || c.category === cat)
    .map((c) => ({ c, ctx: Boolean(c.marketNotes?.[marketId as never] || c.sizeNotes?.[sizeId as never]) }))
    .sort((a, b) => Number(b.ctx) - Number(a.ctx));

  return (
    <section className="challenges-zone" aria-labelledby="desafios">
      <div className="wrap page-section">
        <SectionTitle
          id="desafios"
          eyebrow="Desafios que ninguém conversa"
          title="Desafios que ninguém conversa — mas que fazem parte do trabalho."
          subtitle="Aprenda a lidar com situações reais que nem sempre aparecem na descrição do cargo."
        />
        <div className="chips-row" role="group" aria-label="Filtrar por tema">
          <button type="button" className={`chip${!cat ? ' on' : ''}`} onClick={() => setCat('')}>
            Todos ({relevant.length})
          </button>
          {cats.map((c) => (
            <button type="button" key={c.id} className={`chip${cat === c.id ? ' on' : ''}`} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="challenge-grid">
          {shown.map(({ c, ctx }) => (
            <ChallengeCard key={c.id} challenge={c} contextual={ctx} />
          ))}
        </div>
        <p className="muted small center">
          <KindBadge kind="recomendacao" /> Guias educacionais. Eles ajudam a avaliar cenários; não afirmam a intenção de ninguém.
        </p>
      </div>
    </section>
  );
}
