import type { Challenge } from '../data/types';
import { categoryLabel } from '../data/library';
import { href } from '../lib/router';
import { useStore } from '../lib/store';
import { Icon } from './Icon';

export function ChallengeCard({ challenge: c, contextual }: { challenge: Challenge; contextual?: boolean }) {
  const { state } = useStore();
  const read = state.readGuides.includes(c.id);
  return (
    <a className="challenge-card" href={href(`/desafio/${c.id}`)}>
      <span className="cc-cat">{categoryLabel(c.category)}</span>
      <h3>{c.title}</h3>
      <p>{c.teaser}</p>
      <span className="cc-meta">
        <span>
          <Icon name="clock" size={14} /> {c.minutes} min
        </span>
        {contextual && (
          <span className="cc-ctx">
            <Icon name="compass" size={14} /> Orientação para o seu contexto
          </span>
        )}
        {read && (
          <span className="cc-read">
            <Icon name="check" size={14} /> Lido
          </span>
        )}
      </span>
    </a>
  );
}
