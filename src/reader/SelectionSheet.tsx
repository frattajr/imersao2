/**
 * Seleção de trecho (toque longo num parágrafo, ou toque num grifo):
 * escolha as frases, depois grife (4 cores), anote, copie, compartilhe,
 * procure uma palavra no dicionário ou traduza o trecho.
 */
import * as Clipboard from 'expo-clipboard';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { HIGHLIGHT_BG, HIGHLIGHT_COLORS, HIGHLIGHT_LABEL, sentencesOf, type Annotation, type HighlightColor } from '../core/annotations';
import { RoundButton } from '../ui/components';
import { FONTS, usePrefs } from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

export interface SelectionTarget { page: number; text: string; edit?: Annotation }

export function SelectionSheet({ target, title, onClose, onSave, onDelete }: {
  target: SelectionTarget | null; title: string; onClose: () => void;
  onSave: (a: { page: number; start: number; end: number; quote: string; color: HighlightColor; note: string; id?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const { c } = usePrefs();
  const sents = useMemo(() => (target ? sentencesOf(target.text) : []), [target]);
  const [range, setRange] = useState<[number, number] | null>(null);
  const [note, setNote] = useState('');
  const [color, setColor] = useState<HighlightColor>('yellow');
  const [msg, setMsg] = useState('');
  const [words, setWords] = useState(false);

  useEffect(() => {
    if (!target) return;
    setMsg(''); setWords(false);
    const e = target.edit;
    if (e) {
      // grifo existente: seleciona as frases que ele cobre
      const a = sents.findIndex((s) => s.end > e.start), b = sents.findIndex((s) => s.end >= e.end);
      setRange([Math.max(0, a), b < 0 ? sents.length - 1 : b]);
      setNote(e.note); setColor(e.color ?? 'yellow');
    } else {
      setRange(sents.length === 1 ? [0, 0] : null); setNote(''); setColor('yellow');
    }
  }, [target, sents]);

  if (!target) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;
  const sel = range ? sents.slice(range[0], range[1] + 1) : [];
  const start = target.edit && range === null ? target.edit.start : sel[0]?.start ?? 0;
  const end = sel.length ? sel[sel.length - 1].end : target.edit?.end ?? 0;
  const quote = target.text.slice(start, end);
  const has = quote.trim().length > 0;

  const tap = (i: number) => {
    if (!range) return setRange([i, i]);
    const [a, b] = range;
    if (i < a) setRange([i, b]);
    else if (i > b) setRange([a, i]);
    else if (a === b && i === a) setRange(null);
    else setRange([i, i]); // toque dentro: recomeça daquela frase
  };
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };
  const shareText = `“${quote.trim()}”\n— ${title}`;
  const wordList = [...new Set(quote.match(/[\p{L}][\p{L}-]{2,}/gu) ?? [])].slice(0, 40);

  return (
    <Sheet visible title={target.edit ? 'Grifo' : 'Selecionar trecho'} onClose={onClose}>
      <Text style={[st.hint, { color: c.mut }]}>Toque na primeira e na última frase do trecho.</Text>
      <Text style={[st.para, { color: c.fg }]}>
        {sents.map((s, i) => {
          const on = range && i >= range[0] && i <= range[1];
          return (
            <Text key={i} onPress={() => tap(i)} accessibilityRole="button" accessibilityState={{ selected: !!on }}
              style={on ? { backgroundColor: HIGHLIGHT_BG[color] } : null}>{s.t}{i < sents.length - 1 ? ' ' : ''}</Text>
          );
        })}
      </Text>

      <SheetRow label="Grifar">
        <View style={st.colors}>
          {HIGHLIGHT_COLORS.map((k) => (
            <Pressable key={k} onPress={() => setColor(k)} accessibilityRole="radio" accessibilityState={{ checked: color === k }} accessibilityLabel={HIGHLIGHT_LABEL[k]}
              style={[st.dot, { backgroundColor: HIGHLIGHT_BG[k], borderColor: color === k ? c.fg : 'transparent' }]} />
          ))}
        </View>
        <TextInput value={note} onChangeText={setNote} placeholder="Nota (opcional)" placeholderTextColor={c.mut} multiline
          style={[st.input, { color: c.fg, backgroundColor: c.card }]} accessibilityLabel="Nota" />
        <View style={st.row}>
          <RoundButton big label={target.edit ? 'Salvar' : '✎ Grifar'} disabled={!has}
            onPress={() => { onSave({ page: target.page, start, end, quote: quote.trim(), color, note: note.trim(), id: target.edit?.id }); onClose(); }} />
          {target.edit && <RoundButton label="Apagar grifo" onPress={() => { onDelete(target.edit!.id); onClose(); }} />}
        </View>
      </SheetRow>

      <View style={st.row}>
        <RoundButton label="Copiar" disabled={!has} onPress={async () => { await Clipboard.setStringAsync(shareText); flash('Copiado ✓'); }} />
        <RoundButton label="Compartilhar" disabled={!has} onPress={async () => {
          try {
            if (Platform.OS === 'web') {
              const nav = globalThis.navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
              if (nav.share) await nav.share({ text: shareText });
              else { await Clipboard.setStringAsync(shareText); flash('Copiado para compartilhar ✓'); }
            } else await Share.share({ message: shareText });
          } catch { /* cancelado */ }
        }} />
        <RoundButton label="Dicionário" disabled={!has} onPress={() => setWords((w) => !w)} />
        <RoundButton label="Traduzir" disabled={!has}
          onPress={() => void Linking.openURL(`https://translate.google.com/?sl=auto&tl=en&op=translate&text=${encodeURIComponent(quote.trim().slice(0, 1500))}`)} />
      </View>
      {words && (
        <SheetRow label="Qual palavra?" hint="Abre a definição no Dicio, dicionário online de português.">
          <View style={st.colors}>
            {wordList.map((w) => (
              <Pressable key={w} onPress={() => void Linking.openURL(`https://www.dicio.com.br/${encodeURIComponent(w.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, ''))}/`)}
                style={[st.word, { backgroundColor: c.btn }]} accessibilityRole="link">
                <Text style={{ fontFamily: FONTS.ui, fontSize: 14, color: c.fg }}>{w}</Text>
              </Pressable>
            ))}
          </View>
        </SheetRow>
      )}
      {msg ? <Text style={[st.hint, { color: c.fg }]} accessibilityLiveRegion="polite">{msg}</Text> : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  hint: { fontFamily: FONTS.ui, fontSize: 13.5 },
  para: { fontFamily: FONTS.serif, fontSize: 17, lineHeight: 27 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  input: { fontFamily: FONTS.ui, fontSize: 15, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  word: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
});
