import { useId, useMemo, useRef, useState } from 'react';
import { AREAS, LEVELS, MARKETS, ROLES, SIZES, findRole } from '../data/catalog';
import type { LevelId, Role, Selection } from '../data/types';
import { normalize } from '../lib/search';
import { Icon } from './Icon';

interface Props {
  value: Selection;
  onChange: (s: Selection) => void;
  onSubmit: () => void;
  submitLabel: string;
}

/** Os três seletores da página inicial (também usados para editar o perfil no guia). */
export function ProfileSelector({ value, onChange, onSubmit, submitLabel }: Props) {
  const role = findRole(value.roleId);
  const setRole = (r: Role) => {
    const level: LevelId = r.levels.includes(value.level) ? value.level : r.defaultLevel;
    onChange({ ...value, roleId: r.id, level });
  };

  return (
    <form
      className="selector"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <fieldset className="step">
        <legend>
          <span className="step-n">1</span> Qual é o seu cargo?
        </legend>
        <RoleSearch selected={role} onSelect={setRole} />
        {role && (
          <div className="levels" role="radiogroup" aria-label="Nível">
            <span className="levels-label">Nível</span>
            {LEVELS.filter((l) => role.levels.includes(l.id)).map((l) => (
              <button
                type="button"
                key={l.id}
                role="radio"
                aria-checked={value.level === l.id}
                className={`chip${value.level === l.id ? ' on' : ''}`}
                onClick={() => onChange({ ...value, level: l.id })}
              >
                {l.label}
              </button>
            ))}
            {role.levels.length < LEVELS.length && (
              <span className="levels-hint">Outros níveis aparecem em cargos de liderança (ex.: Coordenador, Gerente).</span>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="step">
        <legend>
          <span className="step-n">2</span> Em qual mercado você atua?
        </legend>
        <div className="card-grid markets" role="radiogroup" aria-label="Mercado">
          {MARKETS.map((m) => (
            <button
              type="button"
              key={m.id}
              role="radio"
              aria-checked={value.marketId === m.id}
              className={`pick${value.marketId === m.id ? ' on' : ''}`}
              onClick={() => onChange({ ...value, marketId: m.id })}
            >
              <span className="pick-icon">
                <Icon name={m.icon} />
              </span>
              <span className="pick-label">{m.label}</span>
              {value.marketId === m.id && <Icon name="check" size={16} className="pick-check" />}
            </button>
          ))}
        </div>
      </fieldset>

      <SizeStep value={value} onChange={onChange} />

      <div className="selector-submit">
        <button type="submit" className="btn btn-primary btn-lg" disabled={!role}>
          {submitLabel} <Icon name="arrow-right" size={18} />
        </button>
        <p className="muted small">Sem cadastro. Suas escolhas ficam só neste navegador.</p>
      </div>
    </form>
  );
}

function SizeStep({ value, onChange }: { value: Selection; onChange: (s: Selection) => void }) {
  const [approx, setApprox] = useState(false);
  return (
    <fieldset className="step">
      <legend>
        <span className="step-n">3</span> Qual é o tamanho da empresa?
      </legend>
      <label className="toggle">
        <input type="checkbox" checked={approx} onChange={(e) => setApprox(e.target.checked)} />
        <span>Não sei o número exato de funcionários</span>
      </label>
      <div className="card-grid sizes" role="radiogroup" aria-label="Tamanho da empresa">
        {SIZES.map((s) => (
          <button
            type="button"
            key={s.id}
            role="radio"
            aria-checked={value.sizeId === s.id}
            className={`pick pick-size${value.sizeId === s.id ? ' on' : ''}`}
            onClick={() => onChange({ ...value, sizeId: s.id })}
          >
            <span className="pick-icon">
              <Icon name={s.icon} />
            </span>
            <span className="pick-label">{s.label}</span>
            <span className="pick-desc">{approx ? s.hint : s.range}</span>
            {value.sizeId === s.id && <Icon name="check" size={16} className="pick-check" />}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function RoleSearch({ selected, onSelect }: { selected?: Role; onSelect: (r: Role) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return ROLES;
    return ROLES.filter((r) => {
      const hay = normalize([r.title, AREAS.find((a) => a.id === r.area)?.label, ...(r.aliases ?? [])].join(' '));
      return q.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [query]);

  const grouped = AREAS.map((a) => ({ area: a, roles: results.filter((r) => r.area === a.id) })).filter((g) => g.roles.length);
  const flat = grouped.flatMap((g) => g.roles);

  const choose = (r: Role) => {
    onSelect(r);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="combo" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <div className="combo-field">
        <Icon name="search" size={18} />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? `${listId}-${flat[active].id}` : undefined}
          aria-label="Buscar cargo"
          placeholder={selected ? 'Trocar de cargo: busque por nome ou área' : 'Busque: analista de marketing, growth, dados…'}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, flat.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open && flat[active]) {
              e.preventDefault();
              choose(flat[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
      </div>
      {selected && (
        <p className="combo-chosen">
          <Icon name="check" size={16} /> Cargo escolhido: <b>{selected.title}</b>
        </p>
      )}
      {open && (
        <div className="combo-list" id={listId} role="listbox" aria-label="Cargos">
          {grouped.length === 0 && <p className="combo-empty">Nenhum cargo encontrado. Tente outra palavra, como "dados" ou "vendas".</p>}
          {grouped.map((g) => (
            <div key={g.area.id} role="group" aria-label={g.area.label}>
              <div className="combo-group">{g.area.label}</div>
              {g.roles.map((r) => {
                const i = flat.indexOf(r);
                return (
                  <div
                    key={r.id}
                    id={`${listId}-${r.id}`}
                    role="option"
                    aria-selected={selected?.id === r.id}
                    className={`combo-opt${i === active ? ' active' : ''}${selected?.id === r.id ? ' chosen' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(r)}
                  >
                    {r.title}
                    {selected?.id === r.id && <Icon name="check" size={16} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
