import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { KindBadge } from '../components/ui';
import { LEVELS, MARKETS, ROLES, SIZES, findRole } from '../data/catalog';
import { CATEGORIES, CHALLENGE_TYPES, MOMENTS, categoryLabel } from '../data/library';
import type { CareerMoment, ChallengeCategory, ChallengeType, LevelId, MarketId, SizeId } from '../data/types';
import { href } from '../lib/router';
import { searchLibrary } from '../lib/search';
import { useStore } from '../lib/store';

const EXAMPLES = [
  'Como pedir para participar de projetos estratégicos?',
  'Como saber se estou pronto para ser gerente?',
  'Como conversar com meu chefe sobre salário?',
];

interface F {
  query: string;
  roleId: string;
  level: LevelId | '';
  market: MarketId | '';
  size: SizeId | '';
  category: ChallengeCategory | '';
  type: ChallengeType | '';
  moment: CareerMoment | '';
}

const EMPTY: F = { query: '', roleId: '', level: '', market: '', size: '', category: '', type: '', moment: '' };

export function Library() {
  const { state } = useStore();
  const [f, setF] = useState<F>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const set = <K extends keyof F>(k: K, v: F[K]) => setF((x) => ({ ...x, [k]: v }));

  const results = useMemo(
    () =>
      searchLibrary({
        query: f.query,
        level: f.level || undefined,
        area: f.roleId ? findRole(f.roleId)?.area : undefined,
        market: f.market || undefined,
        size: f.size || undefined,
        category: f.category || undefined,
        type: f.type || undefined,
        moment: f.moment || undefined,
      }),
    [f],
  );
  const active = Object.entries(f).filter(([k, v]) => k !== 'query' && v).length;

  return (
    <div className="wrap page">
      <header className="lib-head">
        <span className="eyebrow">
          <Icon name="book" size={16} /> Biblioteca de conhecimento
        </span>
        <h1>O que você quer saber?</h1>
        <p className="lead">Pergunte do seu jeito. A busca entende frases como as que você faria a um mentor.</p>
        <form className="lib-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <Icon name="search" size={20} />
          <input
            type="search"
            value={f.query}
            onChange={(e) => set('query', e.target.value)}
            placeholder="Ex.: como pedir aumento sem parecer ingrato?"
            aria-label="Buscar na biblioteca"
          />
          {f.query && (
            <button type="button" className="icon-btn" aria-label="Limpar busca" onClick={() => set('query', '')}>
              <Icon name="x" size={16} />
            </button>
          )}
        </form>
        <div className="chips-row">
          {EXAMPLES.map((q) => (
            <button key={q} type="button" className="chip chip-soft" onClick={() => set('query', q)}>
              {q}
            </button>
          ))}
        </div>
      </header>

      <div className="lib-layout">
        <aside className={`filters${showFilters ? ' open' : ''}`} aria-label="Filtros">
          <div className="filters-head">
            <b>Filtros</b>
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                setF((x) => ({
                  ...x,
                  roleId: state.selection.roleId,
                  level: state.selection.level,
                  market: state.selection.marketId,
                  size: state.selection.sizeId,
                }))
              }
            >
              Usar meu perfil
            </button>
          </div>
          <Select label="Cargo" value={f.roleId} onChange={(v) => set('roleId', v)} options={ROLES.map((r) => [r.id, r.title])} />
          <Select label="Senioridade" value={f.level} onChange={(v) => set('level', v as LevelId)} options={LEVELS.map((l) => [l.id, l.label])} />
          <Select label="Mercado" value={f.market} onChange={(v) => set('market', v as MarketId)} options={MARKETS.map((m) => [m.id, m.label])} />
          <Select label="Tamanho da empresa" value={f.size} onChange={(v) => set('size', v as SizeId)} options={SIZES.map((s) => [s.id, s.label])} />
          <Select label="Tema" value={f.category} onChange={(v) => set('category', v as ChallengeCategory)} options={CATEGORIES.map((c) => [c.id, c.label])} />
          <Select label="Tipo de desafio" value={f.type} onChange={(v) => set('type', v as ChallengeType)} options={CHALLENGE_TYPES.map((c) => [c.id, c.label])} />
          <Select label="Momento de carreira" value={f.moment} onChange={(v) => set('moment', v as CareerMoment)} options={MOMENTS.map((c) => [c.id, c.label])} />
          <p className="muted small">
            Mercado e porte destacam os conteúdos com orientação específica para o seu contexto; os demais continuam aparecendo.
          </p>
          {active > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF((x) => ({ ...EMPTY, query: x.query }))}>
              Limpar filtros
            </button>
          )}
        </aside>

        <section aria-live="polite">
          <div className="results-head">
            <span>
              {results.length} {results.length === 1 ? 'conteúdo' : 'conteúdos'}
              {f.query && ' para a sua pergunta'}
            </span>
            <button type="button" className="btn btn-ghost btn-sm filters-toggle" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
              <Icon name="list" size={16} /> Filtros{active ? ` (${active})` : ''}
            </button>
          </div>
          {results.length === 0 && (
            <div className="empty">
              <p>
                <b>Não encontramos um conteúdo para isso ainda.</b>
              </p>
              <p className="muted">Tente outras palavras ou remova alguns filtros. A biblioteca está crescendo.</p>
            </div>
          )}
          <ul className="results">
            {results.map(({ entry: e, contextual }) => (
              <li key={e.id}>
                <a className={`result ${e.kind}`} href={href(e.kind === 'desafio' ? `/desafio/${e.id}` : `/conteudo/${e.id}`)}>
                  <span className="result-meta">
                    <span className={`badge ${e.kind === 'desafio' ? 'badge-coral' : 'badge-blue'}`}>
                      {e.kind === 'desafio' ? 'Desafio que ninguém conversa' : 'Guia rápido'}
                    </span>
                    <span>{categoryLabel(e.category)}</span>
                    <span>
                      <Icon name="clock" size={14} /> {e.minutes} min
                    </span>
                    {contextual && (
                      <span className="cc-ctx">
                        <Icon name="compass" size={14} /> Orientação para o contexto filtrado
                      </span>
                    )}
                  </span>
                  <h2>{e.title}</h2>
                  <p>{e.teaser}</p>
                </a>
              </li>
            ))}
          </ul>
          <p className="muted small">
            <KindBadge kind="recomendacao" /> Todo o conteúdo da biblioteca é educacional e está em revisão com profissionais da área.
          </p>
        </section>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Todos</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
