import { Layout } from './components/Layout';
import { useRoute } from './lib/router';
import { About } from './pages/About';
import { ArticlePage } from './pages/ArticlePage';
import { ChallengePage } from './pages/ChallengePage';
import { Explore } from './pages/Explore';
import { Guide } from './pages/Guide';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { NotFound } from './pages/NotFound';
import { Pdi } from './pages/Pdi';

export function App() {
  const route = useRoute();
  const [page, param] = route;
  let content;
  switch (page ?? '') {
    case '':
      content = <Home />;
      break;
    case 'guia':
      content = <Guide />;
      break;
    case 'desafio':
      content = <ChallengePage id={param ?? ''} />;
      break;
    case 'explorar':
      content = <Explore />;
      break;
    case 'pdi':
      content = <Pdi />;
      break;
    case 'biblioteca':
      content = <Library />;
      break;
    case 'conteudo':
      content = <ArticlePage id={param ?? ''} />;
      break;
    case 'sobre':
      content = <About />;
      break;
    default:
      content = <NotFound />;
  }
  return <Layout route={route}>{content}</Layout>;
}
