/**
 * X-Ray: ficha discreta de um personagem/termo tocado no texto. Mostra o
 * glossário (se houver), a explicação da IA sob demanda e as menções —
 * tudo só até a página atual (sem spoiler).
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { XrayInfo } from '../core/xray';
import { RoundButton } from '../ui/components';
import { FONTS, usePrefs } from '../ui/prefs';
import { Sheet, SheetRow } from './Sheet';

export function XraySheet({ term, info, glossDesc, canExplain, explain, onAdd, onClose }: {
  term: string | null; info: XrayInfo | null; glossDesc?: string; canExplain: boolean;
  explain: (term: string) => Promise<string>; onAdd: (term: string, desc: string) => void; onClose: () => void;
}) {
  const { c } = usePrefs();
  const [ai, setAi] = useState<{ state: 'idle' | 'busy' | 'done' | 'error'; text: string }>({ state: 'idle', text: '' });
  useEffect(() => setAi({ state: 'idle', text: '' }), [term]);
  const q = { fontFamily: FONTS.serif, fontSize: 15.5, lineHeight: 23, color: c.fg, fontStyle: 'italic' as const };
  const desc = glossDesc || ai.text;
  return (
    <Sheet visible={!!term} title={term ?? ''} onClose={onClose}>
      {desc ? <Text style={{ fontFamily: FONTS.ui, fontSize: 16, lineHeight: 23, color: c.fg }}>{desc}</Text> : null}
      {!glossDesc && canExplain && ai.state !== 'done' && (
        <View style={{ alignItems: 'flex-start' }}>
          <RoundButton icon="sparkle" label={ai.state === 'busy' ? 'Lendo…' : ai.state === 'error' ? 'Não consegui agora — tentar de novo' : 'Explicar sem spoilers'} disabled={ai.state === 'busy'}
            onPress={() => {
              if (!term) return;
              setAi({ state: 'busy', text: '' });
              explain(term).then((t) => setAi(t ? { state: 'done', text: t } : { state: 'error', text: '' })).catch(() => setAi({ state: 'error', text: '' }));
            }} />
        </View>
      )}
      {info && (
        <>
          <SheetRow label={`Primeira aparição · página ${info.firstPage + 1}`}><Text style={q}>“{info.firstQuote}”</Text></SheetRow>
          {info.lastQuote && <SheetRow label={`Mais recente · página ${(info.lastPage ?? 0) + 1}`}><Text style={q}>“{info.lastQuote}”</Text></SheetRow>}
          <Text style={{ fontFamily: FONTS.ui, fontSize: 13, color: c.mut }}>
            {info.mentions} {info.mentions === 1 ? 'menção' : 'menções'} até aqui · só o que você já leu, sem spoilers
          </Text>
        </>
      )}
      {term && !glossDesc && (
        <View style={{ alignItems: 'flex-start' }}>
          <RoundButton variant="ghost" icon="notebook" label="Guardar no glossário" onPress={() => onAdd(term, ai.text)} />
        </View>
      )}
    </Sheet>
  );
}
