/** Painel "Aa": tipografia e tema sem sair da leitura. */
import { Choice } from '../ui/components';
import { LINE_HEIGHTS, MARGINS, PALETTES, PARA_SPACING, READING_FONTS, SIZES, THEME_LABEL, usePrefs, type ReadingFont, type ThemeName } from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

export function TypeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { type, setType, sizeI, setSize, theme, setTheme, layout, setLayout } = usePrefs();
  return (
    <Sheet visible={visible} title="Aa  Leitura" onClose={onClose}>
      <SheetRow label="Tema">
        <Choice value={theme} onChange={setTheme} options={(Object.keys(PALETTES) as ThemeName[]).map((t) => ({ value: t, label: THEME_LABEL[t] }))} />
      </SheetRow>
      <SheetRow label="Fonte">
        <Choice value={type.font} onChange={(f: ReadingFont) => setType({ font: f })}
          options={(Object.keys(READING_FONTS) as ReadingFont[]).map((f) => ({ value: f, label: READING_FONTS[f].label }))} />
      </SheetRow>
      <SheetRow label="Tamanho">
        <Choice value={sizeI} onChange={setSize} options={SIZES.map((x, i) => ({ value: i, label: `${Math.round(x * 100)}%` }))} />
      </SheetRow>
      <SheetRow label="Linhas">
        <Choice value={type.lineI} onChange={(v) => setType({ lineI: v })} options={LINE_HEIGHTS.map((x, i) => ({ value: i, label: x.toFixed(2).replace('.', ',') }))} />
      </SheetRow>
      <SheetRow label="Parágrafos">
        <Choice value={type.paraI} onChange={(v) => setType({ paraI: v })} options={PARA_SPACING.map((_, i) => ({ value: i, label: ['Juntos', 'Pequeno', 'Médio', 'Grande'][i] }))} />
      </SheetRow>
      <SheetRow label="Margens">
        <Choice value={type.marginI} onChange={(v) => setType({ marginI: v })} options={MARGINS.map((_, i) => ({ value: i, label: ['Estreitas', 'Normais', 'Largas', 'Muito largas'][i] }))} />
      </SheetRow>
      <SheetRow label="Alinhamento">
        <Choice value={type.justify ? 1 : 0} onChange={(v) => setType({ justify: v === 1 })} options={[{ value: 1, label: 'Justificado' }, { value: 0, label: 'À esquerda' }]} />
      </SheetRow>
      <SheetRow label="Modo de leitura" hint="Na rolagem, o som acompanha o parágrafo que está na tela.">
        <Choice value={layout} onChange={setLayout} options={[{ value: 'pages', label: '📄 Páginas' }, { value: 'scroll', label: '📜 Rolagem' }]} />
      </SheetRow>
    </Sheet>
  );
}
