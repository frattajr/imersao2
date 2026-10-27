import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { CopyButton, ProvenanceLine } from '../components/ui';
import { CHALLENGES, findChallenge } from '../data/challenges';
import { categoryLabel, typeLabel } from '../data/library';
import { roleTitle } from '../data/catalog';
import type { ContextNote } from '../data/types';
import { href } from '../lib/router';
import { useStore } from '../lib/store';
import { NotFound } from './NotFound';

const STEPS = [
  { id: 'happening', n: 1, title: 'O que está acontecendo' },
  { id: 'why', n: 2, title: 'Por que isso acontece' },
  { id: 'understand', n: 3, title: 'O que você precisa entender' },
  { id: 'prepare', n: 4, title: 'Como se preparar' },
  { id: 'approach', n: 5, title: 'Como abordar a situação' },
  { id: 'avoid', n: 6, title: 'O que evitar' },
  { id: 'evaluate', n: 7, title: 'Como avaliar o resultado' },
  { id: 'caution', n: 8, title: 'Quando a situação exige cautela' },
];

export function ChallengePage({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const c = findChallenge(id);
  const [active, setActive] = useState('happening');

  useEffect(() => {
    if (c) dispatch({ type: 'read', id: c.id });
  }, [c, dispatch]);

  useEffect(() => {
    const els = STEPS.map((s) => document.getElementById(`passo-${s.id}`)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id.replace('passo-', ''));
      },
      { rootMargin: '-20% 0px -60% 0px' },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, [id]);

  if (!c) return <NotFound />;
  const g = c.guide;
  const sel = state.selection;
  const notes = [c.marketNotes?.[sel.marketId], c.sizeNotes?.[sel.sizeId]].filter(Boolean) as ContextNote[];
  const idx = CHALLENGES.indexOf(c);
  const next = CHALLENGES[(idx + 1) % CHALLENGES.length];

  return (
    <article className="challenge-page">
      <header className="challenge-hero">
        <div className="wrap narrow">
          <div className="crumbs">
            <a href={href('/guia')}>Seu guia</a> <Icon name="chevron-right" size={14} /> Desafios que ninguém conversa
          </div>
          <div className="tag-row">
            <span className="badge badge-coral">{categoryLabel(c.category)}</span>
            <span className="badge badge-peach">{typeLabel(c.type)}</span>
            <span className="muted small">
              <Icon name="clock" size={14} /> {c.minutes} min de leitura
            </span>
          </div>
          <h1>{c.title}</h1>
          <p className="lead">{c.teaser}</p>
          <p className="muted small">
            Contextualizado para: {roleTitle(sel.roleId, sel.level)}. <a href={href('/guia')}>Alterar perfil</a>
          </p>
        </div>
      </header>

      <div className="wrap challenge-body">
        <nav className="steps-nav" aria-label="Passos do guia">
          <ol>
            {STEPS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#passo-${s.id}`}
                  className={active === s.id ? 'on' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`passo-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  <span>{s.n}</span> {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="steps">
          {notes.length > 0 && (
            <div className="context-box">
              <b>
                <Icon name="compass" size={16} /> No seu contexto
              </b>
              {notes.map((n) => (
                <p key={n.title}>
                  <b>{n.title}:</b> {n.text}
                </p>
              ))}
            </div>
          )}

          <Step id="happening" n={1} title="O que está acontecendo">
            <p>{g.happening}</p>
          </Step>

          <Step id="why" n={2} title="Por que isso acontece">
            <p className="muted small">Possíveis incentivos e dinâmicas envolvidos. São hipóteses para avaliar, não certezas sobre ninguém.</p>
            <List items={g.why} />
          </Step>

          <Step id="understand" n={3} title="O que você precisa entender">
            <List items={g.understand} icon="bulb" />
          </Step>

          <Step id="prepare" n={4} title="Como se preparar">
            <ChecklistLocal items={g.prepare} storageKey={`prep:${c.id}`} />
          </Step>

          <Step id="approach" n={5} title="Como abordar a situação">
            <ol className="numbered">
              {g.approach.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <h4>Exemplos de frases</h4>
            <p className="muted small">Adapte ao seu jeito de falar. Frases decoradas soam artificiais.</p>
            <div className="phrases">
              {g.approach.phrases.map((p) => (
                <figure className="phrase" key={p.text}>
                  <figcaption>{p.context}</figcaption>
                  <blockquote>{p.text}</blockquote>
                  <CopyButton text={p.text} />
                </figure>
              ))}
            </div>
          </Step>

          <Step id="avoid" n={6} title="O que evitar">
            <div className="avoid">
              {g.avoid.map((a) => (
                <div key={a.mistake} className="avoid-item">
                  <b>
                    <Icon name="x" size={16} /> {a.mistake}
                  </b>
                  <span>Possível consequência: {a.consequence}</span>
                </div>
              ))}
            </div>
          </Step>

          <Step id="evaluate" n={7} title="Como avaliar o resultado">
            <div className="two-col">
              <div>
                <h4>Sinais de avanço</h4>
                <List items={g.evaluate.progress} icon="trend" />
              </div>
              <div>
                <h4>Próximos passos</h4>
                <List items={g.evaluate.nextSteps} icon="arrow-right" />
              </div>
            </div>
          </Step>

          <Step id="caution" n={8} title="Quando a situação exige cautela" tone="caution">
            <List items={g.caution} icon="alert" />
          </Step>

          <ProvenanceLine p={c.provenance} />

          <div className="next-guide">
            <a className="btn btn-ghost" href={href('/guia')}>
              <Icon name="arrow-left" size={16} /> Voltar ao guia
            </a>
            <a className="btn btn-coral" href={href(`/desafio/${next.id}`)}>
              Próximo: {next.title} <Icon name="arrow-right" size={16} />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function Step({ id, n, title, tone, children }: { id: string; n: number; title: string; tone?: string; children: React.ReactNode }) {
  return (
    <section className={`step-card${tone ? ` ${tone}` : ''}`} id={`passo-${id}`} aria-labelledby={`h-${id}`}>
      <h2 id={`h-${id}`}>
        <span className="step-badge">{n}</span> {title}
      </h2>
      {children}
    </section>
  );
}

function List({ items, icon = 'chevron-right' }: { items: string[]; icon?: string }) {
  return (
    <ul className="icon-list">
      {items.map((i) => (
        <li key={i}>
          <Icon name={icon} size={16} /> <span>{i}</span>
        </li>
      ))}
    </ul>
  );
}

function ChecklistLocal({ items, storageKey }: { items: string[]; storageKey: string }) {
  const k = `carreiraluz:${storageKey}`;
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? '[]');
    } catch {
      return [];
    }
  });
  const toggle = (i: number) => {
    const next = [...done];
    next[i] = !next[i];
    setDone(next);
    try {
      localStorage.setItem(k, JSON.stringify(next));
    } catch {
      // armazenamento indisponível
    }
  };
  return (
    <ul className="checklist interactive">
      {items.map((it, i) => (
        <li key={it}>
          <label>
            <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} />
            {it}
          </label>
        </li>
      ))}
    </ul>
  );
}
