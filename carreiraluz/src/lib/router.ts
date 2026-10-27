import { useEffect, useState } from 'react';

// Rotas por hash (#/guia, #/desafio/id): funcionam em qualquer hospedagem estática.

function current(): string[] {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent);
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

export function navigate(path: string) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

export const href = (path: string) => `#${path.startsWith('/') ? path : `/${path}`}`;
