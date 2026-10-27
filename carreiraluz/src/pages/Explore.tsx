import { useState } from 'react';
import { Icon } from '../components/Icon';
import { AREAS, LEVELS, ROLES, roleTitle } from '../data/catalog';
import { reviewedProfileKeys } from '../data/profiles';
import type { LevelId, Role } from '../data/types';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

const AREA_ICON: Record<string, string> = {
  marketing: 'sparkles',
  growth: 'trend',
  crm: 'users',
  dados: 'database',
  produto: 'layers',
  tecnologia: 'cloud',
  rh: 'heart',
  financas: 'wallet',
  comercial: 'briefcase',
};

export function Explore() {
  const { state, dispatch } = useStore();
  const [area, setArea] = useState('');
  const reviewed = new Set(reviewedProfileKeys());
  const open = (r: Role, level: LevelId) => {
    dispatch({ type: 'select', selection: { ...state.selection, roleId: r.id, level } });
    navigate('/guia');
  };

  return (
    <div className="wrap page">
      <header className="lib-head">
        <span className="eyebrow">
          <Icon name="compass" size={16} /> Explorar cargos
        </span>
        <h1>Conheça outras cadeiras</h1>
        <p className="lead">
          Veja o que esperam de cada cargo e nível. Começamos por nove áreas; o conteúdo revisado está marcado. Os demais usam um
          guia genérico por área e senioridade.
        </p>
      </header>
      <div className="chips-row" role="group" aria-label="Filtrar por área">
        <button type="button" className={`chip${!area ? ' on' : ''}`} onClick={() => setArea('')}>
          Todas as áreas
        </button>
        {AREAS.map((a) => (
          <button type="button" key={a.id} className={`chip${area === a.id ? ' on' : ''}`} onClick={() => setArea(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <div className="explore-grid">
        {AREAS.filter((a) => !area || a.id === area).map((a) => (
          <section key={a.id} className="area-card">
            <header>
              <span className="ind-icon">
                <Icon name={AREA_ICON[a.id]} />
              </span>
              <h2>{a.label}</h2>
            </header>
            <ul>
              {ROLES.filter((r) => r.area === a.id).map((r) => (
                <li key={r.id}>
                  <span className="role-name">{r.title}</span>
                  <span className="role-levels">
                    {LEVELS.filter((l) => r.levels.includes(l.id)).map((l) => {
                      const full = reviewed.has(`${r.id}:${l.id}`);
                      return (
                        <button
                          type="button"
                          key={l.id}
                          className={`chip chip-sm${full ? ' chip-full' : ''}`}
                          onClick={() => open(r, l.id)}
                          aria-label={`Abrir guia: ${roleTitle(r.id, l.id)}${full ? ' (conteúdo revisado)' : ''}`}
                        >
                          {full && <Icon name="check" size={12} />} {l.label}
                        </button>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="muted small center">
        <span className="chip chip-sm chip-full">
          <Icon name="check" size={12} /> Revisado
        </span>{' '}
        = conteúdo completo do MVP. Os demais níveis abrem um guia genérico, identificado como tal.
      </p>
    </div>
  );
}
