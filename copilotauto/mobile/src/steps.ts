/**
 * Roteiro de captura guiada. Espelha `backend/app/catalog.py` (o servidor
 * rejeita component_id desconhecido, então divergências aparecem no teste).
 */

export type Overlay =
  | 'cap'
  | 'reservoir'
  | 'bolts'
  | 'towers'
  | 'rails'
  | 'dot'
  | 'tread'
  | 'gap'
  | 'panel'
  | 'pedals'
  | 'wheel'
  | 'odometer';

export type TirePosition = 'FL' | 'FR' | 'RL' | 'RR';
export type OcrKind = 'dot' | 'odometer';

export interface Step {
  componentId: string;
  module: ModuleId;
  title: string;
  instruction: string;
  overlay: Overlay;
  position?: TirePosition;
  ocr?: OcrKind;
  /** Se true, o servidor decide só pelo texto (sem enviar foto). */
  ocrOnly?: boolean;
  torch?: boolean;
}

export type ModuleId = 'engine_cold' | 'front_structure' | 'tires' | 'body' | 'cabin';

export const MODULES: Record<ModuleId, { title: string; intro: string }> = {
  engine_cold: {
    title: 'Motor a frio',
    intro: 'Faça com o motor FRIO (desligado há pelo menos 2 h). Motor quente esconde sintomas e pode queimar.',
  },
  front_structure: {
    title: 'Estrutura frontal',
    intro: 'Com o capô aberto, vamos procurar sinais de reparo de colisão na frente do carro.',
  },
  tires: {
    title: 'Pneus & rodagem',
    intro: 'Para cada roda: o código DOT (idade) e a banda de rodagem (desgaste).',
  },
  body: {
    title: 'Vãos e lataria',
    intro: 'Frestas irregulares e reflexos ondulados denunciam peças desmontadas ou repintadas.',
  },
  cabin: {
    title: 'Autenticidade da cabine',
    intro: 'O desgaste interno precisa combinar com a quilometragem do painel.',
  },
};

const POS_LABEL: Record<TirePosition, string> = {
  FL: 'dianteiro esquerdo',
  FR: 'dianteiro direito',
  RL: 'traseiro esquerdo',
  RR: 'traseiro direito',
};

const TIRES: TirePosition[] = ['FL', 'FR', 'RL', 'RR'];

export const STEPS: Step[] = [
  {
    componentId: 'engine_oil_cap',
    module: 'engine_cold',
    title: 'Tampa de óleo',
    instruction: 'Desrosqueie a tampa de óleo e fotografe a parte de DENTRO dela, dentro do círculo.',
    overlay: 'cap',
    torch: true,
  },
  {
    componentId: 'coolant_reservoir',
    module: 'engine_cold',
    title: 'Reservatório de arrefecimento',
    instruction: 'Enquadre o reservatório inteiro com as marcas MIN e MAX. NÃO abra a tampa.',
    overlay: 'reservoir',
  },
  {
    componentId: 'fender_bolts_left',
    module: 'front_structure',
    title: 'Parafusos do para-lama esquerdo',
    instruction: 'Na borda esquerda sob o capô, alinhe os parafusos aos círculos.',
    overlay: 'bolts',
    torch: true,
  },
  {
    componentId: 'fender_bolts_right',
    module: 'front_structure',
    title: 'Parafusos do para-lama direito',
    instruction: 'Agora o lado direito. Marcas de chave na tinta são o que procuramos.',
    overlay: 'bolts',
    torch: true,
  },
  {
    componentId: 'strut_towers',
    module: 'front_structure',
    title: 'Torres dos amortecedores',
    instruction: 'De cima, enquadre as duas torres (os "copos" dos amortecedores) nos círculos.',
    overlay: 'towers',
  },
  {
    componentId: 'front_rails',
    module: 'front_structure',
    title: 'Longarinas',
    instruction: 'Ilumine atrás do para-choque e enquadre as pontas das longarinas nas barras.',
    overlay: 'rails',
    torch: true,
  },
  ...TIRES.flatMap((position): Step[] => [
    {
      componentId: 'tire_dot',
      module: 'tires',
      position,
      title: `DOT — pneu ${POS_LABEL[position]}`,
      instruction: 'Ache "DOT" na lateral e enquadre os 4 últimos dígitos na caixa. Luz de lado ajuda.',
      overlay: 'dot',
      ocr: 'dot',
      ocrOnly: true,
      torch: true,
    },
    {
      componentId: 'tire_tread',
      module: 'tires',
      position,
      title: `Banda — pneu ${POS_LABEL[position]}`,
      instruction: 'Enquadre a banda de rodagem com um ressalto TWI (marcado por um △ no ombro do pneu).',
      overlay: 'tread',
    },
  ]),
  {
    componentId: 'hood_gap_left',
    module: 'body',
    title: 'Fresta capô × para-lama (esquerdo)',
    instruction: 'Capô fechado. Agache na frente e alinhe a fresta à linha guia.',
    overlay: 'gap',
  },
  {
    componentId: 'hood_gap_right',
    module: 'body',
    title: 'Fresta capô × para-lama (direito)',
    instruction: 'Mesma foto do outro lado, na mesma altura.',
    overlay: 'gap',
  },
  {
    componentId: 'paint_reflection',
    module: 'body',
    title: 'Pintura sob luz refletida',
    instruction: 'Fotografe a lateral bem rente, com o reflexo de uma linha reta (poste, telhado) na faixa.',
    overlay: 'panel',
  },
  {
    componentId: 'pedals',
    module: 'cabin',
    title: 'Pedaleiras',
    instruction: 'Fotografe as borrachas dos pedais de frente.',
    overlay: 'pedals',
    torch: true,
  },
  {
    componentId: 'steering_wheel',
    module: 'cabin',
    title: 'Aro do volante',
    instruction: 'Enquadre o volante inteiro no anel, com as posições 9h e 3h visíveis.',
    overlay: 'wheel',
  },
  {
    componentId: 'odometer',
    module: 'cabin',
    title: 'Hodômetro',
    instruction: 'Ligue a ignição e enquadre a quilometragem TOTAL na caixa.',
    overlay: 'odometer',
    ocr: 'odometer',
  },
];

export const stepKey = (s: Pick<Step, 'componentId' | 'position'>) =>
  s.position ? `${s.componentId}:${s.position}` : s.componentId;
