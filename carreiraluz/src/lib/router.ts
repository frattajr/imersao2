import { useEffect, useState } from 'react';

// Rotas por hash no formato #guia, #desafio--pedir-aumento: só letras, números
// e hífens, para funcionar em qualquer hospedagem estática e em visualizadores
// que não repassam "#/caminho". Também aceita o formato antigo (#/guia).

const SEP = '--';

function current(): string[] {
  const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, '').split('?')[0]);
  if (!h || h === 'inicio') return [];
  return (h.includes('/') ? h.split('/') : h.split(SEP)).filter(Boolean);
}

export function useRoute(): string[] {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const on = () => {
      setRoute(current());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** "/desafio/pedir-aumento" → "#desafio--pedir-aumento"; "/" → "#inicio". */
export const href = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  return `#${parts.length ? parts.join(SEP) : 'inicio'}`;
};

export function navigate(path: string) {
  window.location.hash = href(path);
}
