/**
 * Navegação do livro: barra de progresso arrastável e três abas —
 * Sumário (capítulos), Marcadores e Grifos & notas (com exportação).
 * Também traz o download do capítulo para ler offline.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HIGHLIGHT_BG, type Annotation } from '../core/annotations';
import type { Chapter } from '../core/chapters';
import { RoundButton, Segmented } from '../ui/components';
import { FONTS, usePrefs } from '../ui/prefs';
import { Scrubber } from './Scrubber';
import { Sheet } from './Sheet';

type Tab = 'toc' | 'marks' | 'notes';

export function NavSheet({ visible, onClose, n, idx, chapters, annotations, onJump, onExport, onDownload, download, chapterLabel }: {
  visible: boolean; onClose: () => void; n: number; idx: number; chapters: Chapter[]; annotations: Annotation[];
  onJump: (page: number) => void; onExport: () => void; onDownload: () => void; download: string | null;
  chapterLabel: (page: number) => string;
}) {
  const { c } = usePrefs();
  const [tab, setTab] = useState<Tab>('toc');
  const marks = annotations.filter((a) => a.kind === 'bookmark');
  const notes = annotations.filter((a) => a.kind === 'highlight');
  const curCh = chapters.findIndex((ch) => idx >= ch.start && idx < ch.end);
  const go = (p: number) => { onJump(p); onClose(); };
  const row = { borderColor: c.line };
  return (
    <Sheet visible={visible} title="Navegar" onClose={onClose}>
      <Scrubber value={idx} max={n} onCommit={go}
        label={(p) => `${chapterLabel(p)} · ${Math.round(((p + 1) / n) * 100)}% · parágrafo ${p + 1} de ${n}`} />
      <Segmented value={tab} onChange={setTab} accessibilityLabel="Ver" options={[
        { value: 'toc', label: `Sumário ${chapters.length}` },
        { value: 'marks', label: `Marcadores ${marks.length}` },
        { value: 'notes', label: `Grifos ${notes.length}` },
      ]} />

      {tab === 'toc' && chapters.map((ch, i) => (
        <Pressable key={i} onPress={() => go(ch.start)} style={[st.row, row, i === curCh && { borderColor: c.accent, backgroundColor: c.accentSoft }]}
          accessibilityRole="button" accessibilityLabel={`${ch.title}${i === curCh ? ', capítulo atual' : ''}`}>
          <Text style={[st.title, { color: c.fg }]} numberOfLines={2}>{ch.title}</Text>
          <Text style={[st.meta, { color: i === curCh ? c.accent : c.mut }]}>{i === curCh ? 'você está aqui · ' : ''}{Math.round((ch.start / n) * 100)}%</Text>
        </Pressable>
      ))}

      {tab === 'marks' && (marks.length ? marks.map((m) => (
        <Pressable key={m.id} onPress={() => go(m.page)} style={[st.row, row]} accessibilityRole="button">
          <Text style={[st.quote, { color: c.fg }]} numberOfLines={2}>{m.quote}</Text>
          <Text style={[st.meta, { color: c.mut }]}>{chapterLabel(m.page)} · {Math.round(((m.page + 1) / n) * 100)}%</Text>
        </Pressable>
      )) : <Text style={[st.meta, { color: c.mut }]}>Nenhum marcador ainda. Toque no ícone de marcador, no alto da tela, para marcar a página.</Text>)}

      {tab === 'notes' && (
        <>
          {notes.length > 0 && <View style={{ alignItems: 'flex-start' }}><RoundButton icon="share" label="Exportar grifos e notas" onPress={onExport} /></View>}
          {notes.length ? notes.map((h) => (
            <Pressable key={h.id} onPress={() => go(h.page)} style={[st.row, row]} accessibilityRole="button">
              <Text style={[st.quote, { color: c.fg }]} numberOfLines={4}>
                <Text style={{ backgroundColor: HIGHLIGHT_BG[h.color ?? 'yellow'] }}>{h.quote}</Text>
              </Text>
              {h.note ? <Text style={[st.note, { color: c.fg }]}>{h.note}</Text> : null}
              <Text style={[st.meta, { color: c.mut }]}>{chapterLabel(h.page)}</Text>
            </Pressable>
          )) : <Text style={[st.meta, { color: c.mut }]}>Nenhum grifo ainda. Toque e segure um parágrafo para grifar, anotar, copiar ou compartilhar.</Text>}
        </>
      )}

      <View style={{ alignItems: 'flex-start', marginTop: 4 }}>
        <RoundButton variant="ghost" icon="download" label={download ?? 'Baixar este capítulo para ler offline'} disabled={!!download && !download.startsWith('✓')} onPress={onDownload} />
      </View>
    </Sheet>
  );
}

const st = StyleSheet.create({
  row: { borderRadius: 14, padding: 12, gap: 4, borderWidth: 1 },
  title: { fontFamily: FONTS.serifMedium, fontSize: 16 },
  quote: { fontFamily: FONTS.serif, fontSize: 15, lineHeight: 22 },
  note: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 20 },
  meta: { fontFamily: FONTS.ui, fontSize: 12.5 },
});
