/** Painel "Aa": tipografia, tema e modo de leitura sem sair da leitura. */
import { router } from 'expo-router';
import { View } from 'react-native';
import { Choice, RoundButton } from '../ui/components';
import {
  LAYOUT_LABEL, LINE_HEIGHTS, MARGIN_LABEL, MARGINS, PARA_LABEL, PARA_SPACING, READING_FONTS, SIZES, THEME_CHOICES, THEME_LABEL, usePrefs,
  type ReadingFont, type ReadingLayout,
} from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

/** Linhas de tipografia (usadas aqui e nas Configurações). */
export function TypeRows({ compact }: { compact?: boolean }) {
  const { type, setType, sizeI, setSize, theme, setTheme, layout, setLayout } = usePrefs();
  return (
    <>
      <SheetRow label="Tema" hint={compact ? undefined : 'Automático: sépia de dia, escuro das 19h às 7h.'}>
        <Choice value={theme} onChange={setTheme} options={THEME_CHOICES.map((t) => ({ value: t, label: THEME_LABEL[t] }))} />
      </SheetRow>
      <SheetRow label="Modo de leitura" hint={compact ? undefined : 'Página cheia: como um livro. Um parágrafo: mais cinematográfico. Rolagem: texto contínuo.'}>
        <Choice value={layout} onChange={setLayout} options={(Object.keys(LAYOUT_LABEL) as ReadingLayout[]).map((l) => ({ value: l, label: LAYOUT_LABEL[l] }))} />
      </SheetRow>
      <SheetRow label="Fonte">
        <Choice value={type.font} onChange={(f: ReadingFont) => setType({ font: f })}
          options={(Object.keys(READING_FONTS) as ReadingFont[]).map((f) => ({ value: f, label: READING_FONTS[f].label }))} />
      </SheetRow>
      <SheetRow label="Tamanho">
        <Choice value={sizeI} onChange={setSize} options={SIZES.map((x, i) => ({ value: i, label: `${Math.round(x * 100)}%` }))} />
      </SheetRow>
      <SheetRow label="Estilo" hint="Livro: recuo na primeira linha, sem espaço entre parágrafos e abertura de capítulo.">
        <Choice value={type.book ? 1 : 0} onChange={(v) => setType({ book: v === 1 })} options={[{ value: 1, label: '📖 Livro' }, { value: 0, label: '🖥 Tela' }]} />
      </SheetRow>
      {!type.book && (
        <SheetRow label="Espaço entre parágrafos">
          <Choice value={type.paraI} onChange={(v) => setType({ paraI: v })} options={PARA_SPACING.map((_, i) => ({ value: i, label: PARA_LABEL[i] }))} />
        </SheetRow>
      )}
      <SheetRow label="Linhas">
        <Choice value={type.lineI} onChange={(v) => setType({ lineI: v })} options={LINE_HEIGHTS.map((x, i) => ({ value: i, label: x.toFixed(2).replace('.', ',') }))} />
      </SheetRow>
      <SheetRow label="Margens">
        <Choice value={type.marginI} onChange={(v) => setType({ marginI: v })} options={MARGINS.map((_, i) => ({ value: i, label: MARGIN_LABEL[i] }))} />
      </SheetRow>
      <SheetRow label="Alinhamento" hint={compact ? undefined : 'No celular, à esquerda lê melhor; justificado usa hifenização onde o aparelho permite.'}>
        <Choice value={type.justify ? 1 : 0} onChange={(v) => setType({ justify: v === 1 })} options={[{ value: 0, label: 'À esquerda' }, { value: 1, label: 'Justificado' }]} />
      </SheetRow>
      <SheetRow label="Virar a página">
        <Choice value={type.anim ? 1 : 0} onChange={(v) => setType({ anim: v === 1 })} options={[{ value: 1, label: 'Deslizando' }, { value: 0, label: 'Instantâneo' }]} />
      </SheetRow>
      <SheetRow label="Cor do clima" hint={compact ? undefined : 'Névoa de cor bem leve no alto da tela, conforme a cena.'}>
        <Choice value={type.tint ? 1 : 0} onChange={(v) => setType({ tint: v === 1 })} options={[{ value: 1, label: 'Ligada' }, { value: 0, label: 'Desligada' }]} />
      </SheetRow>
    </>
  );
}

export function TypeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Aa  Leitura" onClose={onClose}>
      <TypeRows compact />
      <View style={{ alignItems: 'flex-start' }}>
        <RoundButton label="⚙ Mais configurações" onPress={() => { onClose(); router.push('/settings'); }} />
      </View>
    </Sheet>
  );
}
