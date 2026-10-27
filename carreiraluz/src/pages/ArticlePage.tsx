import { Icon } from '../components/Icon';
import { ProvenanceLine } from '../components/ui';
import { findChallenge } from '../data/challenges';
import { categoryLabel, findArticle } from '../data/library';
import { href } from '../lib/router';
import { NotFound } from './NotFound';

export function ArticlePage({ id }: { id: string }) {
  const a = findArticle(id);
  if (!a) return <NotFound />;
  return (
    <article className="wrap page narrow article">
      <div className="crumbs">
        <a href={href('/biblioteca')}>Biblioteca</a> <Icon name="chevron-right" size={14} /> {categoryLabel(a.category)}
      </div>
      <div className="tag-row">
        <span className="badge badge-blue">Guia rápido</span>
        <span className="muted small">
          <Icon name="clock" size={14} /> {a.minutes} min de leitura
        </span>
      </div>
      <h1>{a.title}</h1>
      <p className="lead">{a.teaser}</p>
      {a.sections.map((s, i) => (
        <section key={s.title} className={`article-section${i === 0 ? ' tldr' : ''}`}>
          <h2>{s.title}</h2>
          {s.body && <p>{s.body}</p>}
          {s.bullets && (
            <ul className="icon-list">
              {s.bullets.map((b) => (
                <li key={b}>
                  <Icon name="check" size={16} /> <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <ProvenanceLine p={a.provenance} />
      {a.related.length > 0 && (
        <section className="related">
          <h2>Para aprofundar</h2>
          <div className="link-row">
            {a.related.map((r) => {
              const c = findChallenge(r);
              return c ? (
                <a key={r} className="btn btn-coral" href={href(`/desafio/${r}`)}>
                  {c.title} <Icon name="arrow-right" size={16} />
                </a>
              ) : null;
            })}
          </div>
        </section>
      )}
    </article>
  );
}
