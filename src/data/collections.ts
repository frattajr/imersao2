/**
 * Coleções editoriais da biblioteca. A "Coleção do mês" troca sozinha a
 * cada mês; as outras são fixas. Os ids são do catálogo unificado
 * (exemplos `sample-…`, acervo `pt-…`). Obras que ainda não estão
 * disponíveis são puladas — a fileira só aparece com pelo menos 3.
 */
export interface Collection {
  id: string;
  title: string;
  subtitle: string;
  ids: string[];
}

/** Uma por mês, em rodízio. */
export const MONTHLY: Collection[] = [
  {
    id: 'goticos', title: 'Góticos para noite de chuva', subtitle: 'Coleção do mês · contos de medo para ler com o som baixinho',
    ids: ['sample-poe-coracao', 'sample-poe-amontillado', 'sample-dickens-sinaleiro', 'pt-noite-na-taverna', 'pt-o-alienista', 'pt-o-mandarim', 'pt-contos-machado'],
  },
  {
    id: 'amores', title: 'Amores do século XIX', subtitle: 'Coleção do mês · paixões, dotes e famílias contra',
    ids: ['pt-senhora', 'pt-luciola', 'pt-amor-de-perdicao', 'pt-a-moreninha', 'pt-iracema', 'pt-inocencia', 'pt-morgadinha', 'pt-primo-basilio'],
  },
  {
    id: 'rio', title: 'O Rio de Janeiro dos clássicos', subtitle: 'Coleção do mês · cortiços, redações, salões e malandros',
    ids: ['pt-dom-casmurro', 'pt-memorias-postumas', 'pt-quincas-borba', 'pt-o-cortico', 'pt-sargento-de-milicias', 'pt-policarpo-quaresma', 'pt-isaias-caminha', 'pt-esau-e-jaco', 'pt-memorial-de-aires'],
  },
  {
    id: 'natureza', title: 'Mata, sertão e mar', subtitle: 'Coleção do mês · para ler ao som da natureza',
    ids: ['pt-iracema', 'pt-o-guarani', 'pt-inocencia', 'pt-os-sertoes', 'pt-navio-negreiro', 'pt-espumas-flutuantes', 'pt-a-moreninha'],
  },
  {
    id: 'portugal', title: 'Uma viagem a Portugal', subtitle: 'Coleção do mês · Lisboa, Leiria, o Minho e Viseu',
    ids: ['pt-o-mandarim', 'pt-morgadinha', 'pt-amor-de-perdicao', 'pt-os-maias', 'pt-primo-basilio', 'pt-padre-amaro', 'pt-pupilas-do-senhor-reitor', 'pt-auto-da-barca'],
  },
];

export const monthlyCollection = (d = new Date()): Collection => MONTHLY[(d.getFullYear() * 12 + d.getMonth()) % MONTHLY.length];

/** Clássicos em domínio público que aparecem com frequência nas listas de leitura de vestibulares. */
export const VESTIBULAR: Collection = {
  id: 'vestibular', title: '🎓 Frequentes no vestibular', subtitle: 'Obras em domínio público que costumam cair nas listas de leitura',
  ids: [
    'pt-dom-casmurro', 'pt-memorias-postumas', 'pt-o-cortico', 'pt-iracema', 'pt-sargento-de-milicias', 'pt-a-moreninha',
    'pt-policarpo-quaresma', 'pt-os-sertoes', 'pt-o-ateneu', 'pt-quincas-borba', 'pt-auto-da-barca', 'pt-o-alienista', 'pt-o-mulato',
  ],
};
