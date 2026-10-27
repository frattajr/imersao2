import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { DEFAULT_SELECTION, findRole } from '../data/catalog';
import type { PdiItem, Selection } from '../data/types';
import type { SelfAssessment } from './pdi';

// Estado local do protótipo (sem conta, sem servidor). Fica no navegador.

export interface AppState {
  selection: Selection;
  /** A pessoa já confirmou a seleção pelo menos uma vez. */
  chosen: boolean;
  /** Autoavaliação por perfil ("roleId:level" → competência → 1..4). */
  self: Record<string, SelfAssessment>;
  /** Plano por perfil. */
  pdi: Record<string, { items: PdiItem[]; createdAt: string }>;
  readGuides: string[];
}

type Action =
  | { type: 'select'; selection: Selection }
  | { type: 'rate'; profileKey: string; competencyId: string; value: number | null }
  | { type: 'pdi:set'; profileKey: string; items: PdiItem[] }
  | { type: 'pdi:update'; profileKey: string; item: PdiItem }
  | { type: 'pdi:remove'; profileKey: string; id: string }
  | { type: 'pdi:add'; profileKey: string; item: PdiItem }
  | { type: 'pdi:clear'; profileKey: string }
  | { type: 'read'; id: string }
  | { type: 'reset' };

const KEY = 'carreiraluz:v1';

const initial: AppState = { selection: DEFAULT_SELECTION, chosen: false, self: {}, pdi: {}, readGuides: [] };

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const s = { ...initial, ...JSON.parse(raw) } as AppState;
    // Descarta seleção de um cargo que deixou de existir.
    if (!findRole(s.selection.roleId)) s.selection = DEFAULT_SELECTION;
    return s;
  } catch {
    return initial;
  }
}

function withPdi(s: AppState, key: string, f: (items: PdiItem[]) => PdiItem[]): AppState {
  const cur = s.pdi[key];
  if (!cur) return s;
  return { ...s, pdi: { ...s.pdi, [key]: { ...cur, items: f(cur.items) } } };
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'select':
      return { ...s, selection: a.selection, chosen: true };
    case 'rate': {
      const cur = { ...(s.self[a.profileKey] ?? {}) };
      if (a.value == null) delete cur[a.competencyId];
      else cur[a.competencyId] = a.value;
      return { ...s, self: { ...s.self, [a.profileKey]: cur } };
    }
    case 'pdi:set':
      return { ...s, pdi: { ...s.pdi, [a.profileKey]: { items: a.items, createdAt: new Date().toISOString() } } };
    case 'pdi:update':
      return withPdi(s, a.profileKey, (items) => items.map((i) => (i.id === a.item.id ? a.item : i)));
    case 'pdi:remove':
      return withPdi(s, a.profileKey, (items) => items.filter((i) => i.id !== a.id));
    case 'pdi:add':
      return withPdi(s, a.profileKey, (items) => [...items, a.item]);
    case 'pdi:clear': {
      const pdi = { ...s.pdi };
      delete pdi[a.profileKey];
      return { ...s, pdi };
    }
    case 'read':
      return s.readGuides.includes(a.id) ? s : { ...s, readGuides: [...s.readGuides, a.id] };
    case 'reset':
      return initial;
  }
}

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Navegação privada ou armazenamento bloqueado: segue só em memória.
    }
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore fora do StoreProvider');
  return c;
}

export const profileKey = (s: Selection) => `${s.roleId}:${s.level}`;
