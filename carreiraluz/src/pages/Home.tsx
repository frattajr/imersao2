import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ProfileSelector } from '../components/ProfileSelector';
import { DEFAULT_SELECTION } from '../data/catalog';
import { navigate } from '../lib/router';
import { useStore } from '../lib/store';

const QUESTIONS = [
  { icon: 'eye', text: 'O que esperam de quem ocupa esse cargo?' },
  { icon: 'wallet', text: 'Quanto ganha e quanto tempo costuma ficar na posição?' },
  { icon: 'star', text: 'O que diferencia quem se destaca?' },
  { icon: 'layers', text: 'O que preciso saber para ocupar essa cadeira?' },
  { icon: 'message', text: 'Quais desafios reais quase ninguém conversa?' },
];

export function Home() {
  const { state, dispatch } = useStore();
  const [draft, setDraft] = useState(state.selection);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-inner">
          <div className="hero-text">
            <span className="eyebrow">
              <Icon name="sparkles" size={16} /> Guia de carreira gratuito, sem cadastro
            </span>
            <h1>Entenda o que precisa saber para crescer na sua carreira.</h1>
            <p className="lead">
              Descubra o que esperam do seu cargo, o que diferencia os melhores profissionais e os desafios que ninguém costuma
              ensinar.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#perfil" onClick={(e) => { e.preventDefault(); document.getElementById('perfil')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Montar meu guia
              </a>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  dispatch({ type: 'select', selection: DEFAULT_SELECTION });
                  navigate('/guia');
                }}
              >
                Ver exemplo: Analista de Marketing Sênior
              </button>
            </div>
          </div>
          <HeroIllustration />
        </div>
        <div className="wrap">
          <ul className="questions" aria-label="O que o guia responde">
            {QUESTIONS.map((q) => (
              <li key={q.text}>
                <Icon name={q.icon} size={18} />
                {q.text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="wrap page" id="perfil" aria-labelledby="perfil-title">
        <div className="panel selector-panel">
          <h2 id="perfil-title">Conte sobre a sua cadeira</h2>
          <p className="muted">Três escolhas rápidas. Você pode mudar qualquer uma depois, sem recomeçar.</p>
          <ProfileSelector
            value={draft}
            onChange={setDraft}
            submitLabel="Descobrir meu guia de carreira"
            onSubmit={() => {
              dispatch({ type: 'select', selection: draft });
              navigate('/guia');
            }}
          />
        </div>
      </section>
    </>
  );
}

function HeroIllustration() {
  return (
    <svg className="hero-art" viewBox="0 0 360 300" role="img" aria-label="Ilustração: pessoa subindo degraus em direção a uma luz">
      <circle cx="285" cy="62" r="46" fill="var(--peach-soft)" />
      <circle cx="285" cy="62" r="22" fill="var(--peach)" />
      <g stroke="var(--peach)" strokeWidth="4" strokeLinecap="round">
        <path d="M285 6v10M285 108v10M229 62h10M331 62h10M246 23l7 7M317 94l7 7M324 23l-7 7M253 94l-7 7" />
      </g>
      <rect x="30" y="236" width="80" height="44" rx="10" fill="var(--blue-soft)" />
      <rect x="100" y="196" width="80" height="84" rx="10" fill="var(--lilac-soft)" />
      <rect x="170" y="156" width="80" height="124" rx="10" fill="var(--blue-soft)" />
      <rect x="240" y="116" width="80" height="164" rx="10" fill="var(--green-soft)" />
      <g>
        <circle cx="140" cy="128" r="15" fill="#f2c9a5" />
        <path d="M126 122c2-12 24-14 28 0-6-4-20-5-28 0z" fill="#3b2a26" />
        <path d="M122 196v-34c0-12 8-20 18-20s18 8 18 20v34z" fill="var(--blue)" />
        <path d="M155 152l22-16" stroke="#f2c9a5" strokeWidth="7" strokeLinecap="round" />
        <path d="M130 196l-6 0M150 196l14-38" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round" />
      </g>
      <g>
        <circle cx="62" cy="196" r="13" fill="#a8775a" />
        <path d="M49 192c1-14 26-14 26 0-4-6-20-6-26 0z" fill="#1f1a24" />
        <path d="M46 236v-20c0-10 7-16 16-16s16 6 16 16v20z" fill="var(--lilac)" />
        <path d="M76 214l18-10" stroke="#a8775a" strokeWidth="6" strokeLinecap="round" />
      </g>
      <g fill="var(--green)">
        <circle cx="262" cy="140" r="5" />
        <circle cx="280" cy="140" r="5" />
        <circle cx="298" cy="140" r="5" />
      </g>
    </svg>
  );
}
