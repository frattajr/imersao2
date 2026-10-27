import type { ReactNode } from 'react';
import { href } from '../lib/router';
import { Icon } from './Icon';

const NAV = [
  { path: '/', label: 'Início', icon: 'home', match: ['', 'guia'] },
  { path: '/explorar', label: 'Explorar cargos', short: 'Cargos', icon: 'compass', match: ['explorar'] },
  { path: '/pdi', label: 'Meu PDI', icon: 'target', match: ['pdi'] },
  { path: '/biblioteca', label: 'Biblioteca', icon: 'book', match: ['biblioteca', 'desafio', 'conteudo'] },
  { path: '/sobre', label: 'Sobre o projeto', short: 'Sobre', icon: 'info', match: ['sobre'] },
];

export function Layout({ route, children }: { route: string[]; children: ReactNode }) {
  const top = route[0] ?? '';
  const isActive = (m: string[]) => m.includes(top);
  return (
    <div className="app">
      <a className="skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a className="brand" href={href('/')} aria-label="CarreiraLuz, início">
            <Logo />
            <span>
              Carreira<b>Luz</b>
            </span>
          </a>
          <nav className="nav-desktop" aria-label="Principal">
            {NAV.map((n) => (
              <a key={n.path} href={href(n.path)} aria-current={isActive(n.match) ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <span className="badge badge-amber demo-pill" title="Protótipo com dados demonstrativos">
            MVP · dados demonstrativos
          </span>
        </div>
      </header>
      <main id="conteudo">{children}</main>
      <footer className="footer">
        <div className="wrap">
          <p>
            <b>CarreiraLuz</b> é um protótipo educacional. Salários e tempos de permanência exibidos são <b>demonstrativos</b> e
            identificados como tal; as orientações são recomendações educacionais, não aconselhamento profissional individual.
          </p>
          <p className="muted">
            <a href={href('/sobre')}>Como tratamos dados e fontes</a>
          </p>
        </div>
      </footer>
      <nav className="nav-mobile" aria-label="Principal">
        {NAV.map((n) => (
          <a key={n.path} href={href(n.path)} aria-current={isActive(n.match) ? 'page' : undefined}>
            <Icon name={n.icon} size={22} />
            <span>{n.short ?? n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--blue)" />
      <path d="M16 7v4M16 21v4M7 16h4M21 16h4M10 10l2.5 2.5M19.5 19.5L22 22M22 10l-2.5 2.5M12.5 19.5L10 22" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="3.2" fill="#fff" />
    </svg>
  );
}
