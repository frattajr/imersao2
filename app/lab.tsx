/**
 * Laboratório de som: descreva um som com os campos do repositório, ouça a
 * síntese e veja o repositório funcionando — "Buscar ou gerar" reaproveita
 * um som parecido já criado nesta sessão ou gera um novo pela ElevenLabs.
 *
 * O repositório é o do aparelho (src/services/localSounds.ts), o mesmo que
 * o leitor usa quando não há servidor: o que for gerado aqui toca na leitura.
 * A chave da ElevenLabs é digitada na tela e fica só neste aparelho.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  descKey, DISTANCES, generationRequest, INTENSITIES, LIB_LAYERS, LIB_SPOTS, MATERIALS, PLACES,
  sanitizeDetail, type SoundDesc,
} from '../supabase/functions/_shared/sound-library';
import { createAudioContext } from '../src/audio/context';
import { normalize, type BufferLike, type CtxLike, type SourceLike } from '../src/audio/engine';
import { renderLayer, renderSpot } from '../src/audio/recipes';
import { LAYER_LABEL, SPOT_LABEL } from '../src/core/analyze';
import type { Layer, SpotName } from '../src/core/types';
import { localSounds, type LocalSound } from '../src/services/localSounds';
import { supabase } from '../src/services/supabase';
import { RoundButton, SectionTitle } from '../src/ui/components';
import { FONTS, usePrefs } from '../src/ui/prefs';

const LABEL_PT: Record<string, string> = {
  wood: 'madeira', gravel: 'cascalho', stone: 'pedra', grass: 'grama', snow: 'neve', metal: 'metal', water: 'água',
  glass: 'vidro', fabric: 'tecido', paper: 'papel', leaves: 'folhas', mud: 'lama', sand: 'areia', tile: 'piso',
  indoor: 'interior', outdoor: 'ao ar livre', cave: 'caverna', hall: 'salão', vehicle: 'veículo', underwater: 'debaixo d’água',
  near: 'perto', mid: 'média', far: 'longe', soft: 'suave', medium: 'média', strong: 'forte',
};

type Status = { kind: 'info' | 'hit' | 'gen' | 'error'; text: string } | null;

function Chips<T extends string>({ items, value, onChange, label, allowNone = true }: {
  items: readonly T[]; value?: T; onChange: (v?: T) => void; label: (v: T) => string; allowNone?: boolean;
}) {
  const { c } = usePrefs();
  return (
    <View style={st.chips}>
      {allowNone && (
        <Pressable onPress={() => onChange(undefined)} style={[st.chip, { backgroundColor: value === undefined ? c.fg : c.btn }]}>
          <Text style={[st.chipText, { color: value === undefined ? c.bg : c.fg }]}>tanto faz</Text>
        </Pressable>
      )}
      {items.map((it) => (
        <Pressable key={it} onPress={() => onChange(it)} accessibilityRole="button" accessibilityState={{ selected: value === it }}
          style={[st.chip, { backgroundColor: value === it ? c.fg : c.btn }]}>
          <Text style={[st.chipText, { color: value === it ? c.bg : c.fg }]}>{label(it)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Lab() {
  const { c } = usePrefs();
  const insets = useSafeAreaInsets();
  const [desc, setDesc] = useState<SoundDesc>({ cat: 'layer', name: 'rain' });
  const [detail, setDetail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [repo, setRepo] = useState<LocalSound[]>([]);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const ctx = useRef<CtxLike | null>(null);
  const playing = useRef<SourceLike | null>(null);

  useEffect(() => {
    void localSounds.getKey().then(setApiKey);
    const refresh = () => void localSounds.list().then(setRepo);
    refresh();
    const off = localSounds.subscribe(refresh);
    return () => {
      off(); try { playing.current?.stop(); } catch { /* */ } void (ctx.current as unknown as { close?: () => Promise<void> })?.close?.(); };
  }, []);

  const full: SoundDesc = useMemo(() => {
    const d: SoundDesc = { ...desc, detail: sanitizeDetail(detail) };
    if (!d.detail) delete d.detail;
    return d;
  }, [desc, detail]);
  const req = useMemo(() => generationRequest(full), [full]);

  const audio = useCallback((): CtxLike => {
    if (!ctx.current) ctx.current = createAudioContext();
    if (ctx.current.state === 'suspended') void ctx.current.resume();
    return ctx.current;
  }, []);

  const play = useCallback((buf: BufferLike, gain = 0.8, maxSeconds = 12) => {
    const a = audio();
    try { playing.current?.stop(); } catch { /* já parado */ }
    const g = a.createGain();
    const t = a.currentTime;
    const end = t + Math.min(buf.duration, maxSeconds);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.4);
    g.gain.setValueAtTime(gain, Math.max(t + 0.4, end - 1));
    g.gain.linearRampToValueAtTime(0, end);
    g.connect(a.destination);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(g);
    src.start(t);
    src.stop(end + 0.05);
    playing.current = src;
  }, [audio]);

  /** Baixa (do aparelho), iguala o volume e toca um som do repositório. */
  const bufs = useRef(new Map<string, BufferLike>());
  const playUrl = useCallback(async (id: string, url: string, layer: boolean) => {
    let b = bufs.current.get(id);
    if (!b) {
      const a = audio();
      if (!a.decodeAudioData) throw new Error('Este aparelho não decodifica o áudio.');
      b = await a.decodeAudioData(await (await fetch(url)).arrayBuffer());
      if (!normalize(b)) throw new Error('O som veio mudo.');
      bufs.current.set(id, b);
    }
    play(b, layer ? 0.6 : 0.8);
  }, [audio, play]);

  const playSaved = async (s: LocalSound) => {
    const url = await localSounds.urlOf(s.id);
    if (url) await playUrl(s.id, url, s.cat === 'layer').catch((e) => setStatus({ kind: 'error', text: String(e?.message ?? e) }));
  };

  const stop = () => { try { playing.current?.stop(); } catch { /* */ } };

  const playSynth = () => {
    const a = audio();
    const chans = desc.cat === 'layer'
      ? (() => { const { left, right } = renderLayer(desc.name as Layer, a.sampleRate, Date.now() % 1000); return [left, right]; })()
      : [renderSpot({
          s: desc.name as SpotName, at: 0, w: desc.intensity === 'soft' ? 0.3 : desc.intensity === 'strong' ? 0.8 : 0.5,
          surface: (['wood', 'gravel', 'stone', 'grass', 'snow', 'metal'] as const).find((m) => m === desc.material),
        }, a.sampleRate, Date.now() % 1000)];
    const b = a.createBuffer(chans.length, chans[0].length, a.sampleRate);
    chans.forEach((d, i) => (b.copyToChannel ? b.copyToChannel(d, i) : b.getChannelData(i).set(d)));
    play(b, desc.cat === 'layer' ? 1 : 0.9);
    setStatus({ kind: 'info', text: 'Tocando a síntese (a reserva que o app usa quando não há arquivo).' });
  };

  const saveKey = (k: string) => {
    setApiKey(k);
    void localSounds.setKey(k);
  };

  const findOrGenerate = async () => {
    setBusy(true);
    try {
      if (!apiKey.trim()) {
        const all = await localSounds.list();
        if (!all.length) {
          setStatus({ kind: 'info', text: 'Repositório vazio. Para gerar um som novo, cole a chave da ElevenLabs abaixo.' });
          return;
        }
      }
      setStatus({ kind: 'info', text: 'Procurando no repositório… (se for um som novo, a ElevenLabs leva alguns segundos)' });
      const r = await localSounds.findOrGenerate(full);
      await playUrl(r.sound.id, r.url, desc.cat === 'layer');
      setStatus(r.reused
        ? { kind: 'hit', text: `♻️ Reaproveitado do repositório (semelhança ${r.score.toFixed(2).replace('.', ',')}). Nenhuma geração, custo zero.` }
        : { kind: 'gen', text: '✨ Gerado e guardado no repositório. Ele já toca na leitura; peça algo parecido para ver o reaproveitamento.' });
    } catch (e) {
      setStatus({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const names = desc.cat === 'layer' ? LIB_LAYERS : LIB_SPOTS;
  const nameLabel = (n: string) => (desc.cat === 'layer' ? LAYER_LABEL[n as Layer] : SPOT_LABEL[n as SpotName]) ?? n;
  const set = (patch: Partial<SoundDesc>) => setDesc((d) => {
    const n = { ...d, ...patch };
    (Object.keys(n) as (keyof SoundDesc)[]).forEach((k) => n[k] === undefined && delete n[k]);
    return n;
  });
  const statusColor = status?.kind === 'error' ? '#e0806a' : status?.kind === 'hit' ? '#8fc9a0' : status?.kind === 'gen' ? '#d8b86a' : c.mut;

  return (
    <View style={{ flex: 1, backgroundColor: c.ov }}>
      <ScrollView contentContainerStyle={[st.wrap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }]}>
        <View style={st.head}>
          <RoundButton label="←" accessibilityLabel="Voltar" onPress={() => { stop(); router.back(); }} />
          <Text style={[st.h1, { color: c.fg }]}>Laboratório de som</Text>
        </View>
        <Text style={[st.lead, { color: c.mut }]}>
          Descreva um som como a IA descreve cada cena. “Buscar ou gerar” reaproveita um som parecido já criado ou gera um novo.
        </Text>

        <SectionTitle>Tipo</SectionTitle>
        <Chips items={['layer', 'spot'] as const} value={desc.cat} allowNone={false}
          label={(v) => (v === 'layer' ? 'Ambiente (loop)' : 'Som pontual')}
          onChange={(v) => v && setDesc({ cat: v, name: v === 'layer' ? 'rain' : 'steps' })} />

        <SectionTitle>Som</SectionTitle>
        <Chips items={names as readonly string[]} value={desc.name} allowNone={false} label={nameLabel} onChange={(v) => v && set({ name: v })} />

        <SectionTitle>Material</SectionTitle>
        <Chips items={MATERIALS} value={desc.material} label={(v) => LABEL_PT[v]} onChange={(v) => set({ material: v })} />
        <SectionTitle>Lugar</SectionTitle>
        <Chips items={PLACES} value={desc.place} label={(v) => LABEL_PT[v]} onChange={(v) => set({ place: v })} />
        <SectionTitle>Distância</SectionTitle>
        <Chips items={DISTANCES} value={desc.distance} label={(v) => LABEL_PT[v]} onChange={(v) => set({ distance: v })} />
        <SectionTitle>Intensidade</SectionTitle>
        <Chips items={INTENSITIES} value={desc.intensity} label={(v) => LABEL_PT[v]} onChange={(v) => set({ intensity: v })} />

        <SectionTitle>Detalhe (em inglês, até 6 palavras)</SectionTitle>
        <TextInput value={detail} onChangeText={setDetail} placeholder="ex.: tin roof, old wooden ship"
          placeholderTextColor={c.mut} style={[st.input, { color: c.fg, backgroundColor: c.card }]} autoCapitalize="none" />

        <View style={[st.box, { backgroundColor: c.card }]}>
          <Text style={[st.mono, { color: c.mut }]}>chave: {descKey(full)}</Text>
          <Text style={[st.small, { color: c.fg }]}>Pedido para a IA de áudio ({req.seconds} s{req.loop ? ', loop' : ''}):</Text>
          <Text style={[st.small, { color: c.mut }]}>{req.text}</Text>
        </View>

        <View style={st.actions}>
          <RoundButton label="▶ Ouvir síntese" onPress={playSynth} />
          <RoundButton big label={busy ? 'Gerando…' : '✨ Buscar ou gerar'} disabled={busy} onPress={() => void findOrGenerate()} />
          <RoundButton label="■" accessibilityLabel="Parar" onPress={stop} />
        </View>
        {status && <Text style={[st.status, { color: statusColor }]}>{status.text}</Text>}

        <SectionTitle>{`Repositório deste aparelho (${repo.length})`}</SectionTitle>
        {repo.length === 0 && <Text style={[st.small, { color: c.mut }]}>Vazio. Os sons gerados aqui ou durante a leitura aparecem nesta lista.</Text>}
        {repo.map((s) => (
          <View key={s.id} style={[st.item, { backgroundColor: c.card }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[st.itemTitle, { color: c.fg }]}>
                {s.cat === 'layer' ? LAYER_LABEL[s.name as Layer] : SPOT_LABEL[s.name as SpotName]}
                {[s.material, s.place, s.distance, s.intensity].filter(Boolean).map((v) => ' · ' + LABEL_PT[v as string]).join('')}
              </Text>
              <Text style={[st.small, { color: c.mut }]}>{s.detail ? `“${s.detail}” · ` : ''}usado {s.uses}×</Text>
            </View>
            <RoundButton label="▶" accessibilityLabel="Tocar" onPress={() => void playSaved(s)} />
            <RoundButton label="✕" accessibilityLabel="Apagar som" onPress={() => void localSounds.report(s.id)} />
          </View>
        ))}

        <SectionTitle>Chave da ElevenLabs</SectionTitle>
        <TextInput value={apiKey} onChangeText={saveKey} placeholder="sk_…" placeholderTextColor={c.mut} secureTextEntry
          autoCapitalize="none" autoCorrect={false} style={[st.input, { color: c.fg, backgroundColor: c.card }]} />
        <Text style={[st.small, { color: c.mut }]}>
          {supabase
            ? 'Fica salva só neste aparelho e vale para este laboratório. Na leitura, o app usa o repositório do servidor.'
            : 'Fica salva só neste aparelho/navegador e também vale para a leitura: sons novos são gerados enquanto você lê. No app publicado, a chave deve ficar no servidor (Supabase).'}
        </Text>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 10, maxWidth: 560, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontFamily: FONTS.serifMedium, fontSize: 28, flexShrink: 1 },
  lead: { fontFamily: FONTS.ui, fontSize: 15.5, lineHeight: 23 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 99, justifyContent: 'center' },
  chipText: { fontFamily: FONTS.uiBold, fontSize: 14 },
  input: { fontFamily: FONTS.ui, fontSize: 16, minHeight: 48, borderRadius: 14, paddingHorizontal: 14 },
  box: { borderRadius: 16, padding: 14, gap: 6, marginTop: 8 },
  mono: { fontFamily: FONTS.ui, fontSize: 12.5 },
  small: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 6 },
  status: { fontFamily: FONTS.uiBold, fontSize: 14.5, lineHeight: 21 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 12 },
  itemTitle: { fontFamily: FONTS.uiBold, fontSize: 15 },
});
