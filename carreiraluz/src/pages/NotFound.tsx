import { href } from '../lib/router';

export function NotFound() {
  return (
    <div className="wrap page narrow center">
      <h1>Página não encontrada</h1>
      <p className="muted">O endereço pode ter mudado.</p>
      <a className="btn btn-primary" href={href('/')}>
        Voltar ao início
      </a>
    </div>
  );
}
