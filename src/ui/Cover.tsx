/**
 * Capa ilustrada de um livro, desenhada em código: degradê e elementos do
 * cenário conforme o clima da história (ondas no mar, pinheiros na floresta,
 * estrelas e lua à noite, neve no frio, prédios na cidade…), o emoji do livro
 * como ilustração central e o título em letra de livro.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Mood } from '../core/types';
import { FONTS } from './prefs';

const ART: Record<Mood, { colors: [string, string, string]; glow: string }> = {
  sea: { colors: ['#2f6f86', '#163a55', '#0b1726'], glow: '#9fe0f0' },
  fire: { colors: ['#c4622d', '#6b2318', '#1d0d0b'], glow: '#ffbf6b' },
  warm: { colors: ['#c9915a', '#7a4a2c', '#24150e'], glow: '#ffd9a0' },
  tension: { colors: ['#7c2230', '#3a1220', '#0e080c'], glow: '#ff8a8a' },
  forest: { colors: ['#4f8a5b', '#1f4a33', '#0b1a12'], glow: '#c9f0b0' },
  night: { colors: ['#4b4590', '#211d4f', '#0a0a1c'], glow: '#d9d4ff' },
  cold: { colors: ['#9cc3dc', '#4f7590', '#16222e'], glow: '#ffffff' },
  city: { colors: ['#8a5fa8', '#3d2a5a', '#120c1c'], glow: '#ffcf7a' },
  rain: { colors: ['#6e8aa3', '#34475a', '#10171e'], glow: '#d6e6f5' },
  calm: { colors: ['#8a86a6', '#45425e', '#15141c'], glow: '#ecebff' },
};

/** Números pseudoaleatórios fixos por livro (a capa é sempre a mesma). */
function seeded(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function Motif({ mood, w, h, id }: { mood: Mood; w: number; h: number; id: string }) {
  const r = seeded(id);
  const dots = (n: number, color: string, maxY: number, size: [number, number]) =>
    Array.from({ length: n }, (_, i) => {
      const s = size[0] + r() * (size[1] - size[0]);
      return <View key={'d' + i} style={{ position: 'absolute', left: r() * w, top: r() * h * maxY, width: s, height: s, borderRadius: s, backgroundColor: color, opacity: 0.35 + r() * 0.5 }} />;
    });
  const tri = (x: number, base: number, height: number, color: string, k: string) => (
    <View key={k} style={{ position: 'absolute', left: x - base / 2, bottom: h * 0.18, width: 0, height: 0, borderLeftWidth: base / 2, borderRightWidth: base / 2, borderBottomWidth: height, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
  );
  switch (mood) {
    case 'sea':
      return <>{[0.62, 0.7, 0.78].map((y, i) => <View key={i} style={{ position: 'absolute', left: -w * 0.2, top: h * y, width: w * 1.4, height: h * 0.3, borderRadius: w, backgroundColor: ['#2c7c93', '#1b5a74', '#0f3a52'][i], opacity: 0.75 }} />)}</>;
    case 'forest':
      return <>{Array.from({ length: 7 }, (_, i) => tri((i + 0.3 + r() * 0.4) * (w / 6.5), w * (0.2 + r() * 0.12), h * (0.22 + r() * 0.16), i % 2 ? '#14331f' : '#1d4a2c', 't' + i))}</>;
    case 'night':
      return <>{dots(26, '#ffffff', 0.6, [1.5, 3])}<View style={{ position: 'absolute', right: w * 0.14, top: h * 0.1, width: w * 0.18, height: w * 0.18, borderRadius: w, backgroundColor: '#f2eeda', opacity: 0.9 }} /></>;
    case 'cold':
      return <>{tri(w * 0.3, w * 0.9, h * 0.32, '#dfeaf2', 'm1')}{tri(w * 0.78, w * 0.7, h * 0.25, '#b9cfdf', 'm2')}{dots(30, '#ffffff', 0.85, [2, 4])}</>;
    case 'city':
      return <>{Array.from({ length: 6 }, (_, i) => {
        const bw = w / 6.2, bh = h * (0.18 + r() * 0.22);
        return (
          <View key={i} style={{ position: 'absolute', left: i * (w / 6), bottom: h * 0.16, width: bw, height: bh, backgroundColor: '#1d1430', opacity: 0.9 }}>
            {Array.from({ length: 5 }, (_, k) => <View key={k} style={{ position: 'absolute', left: bw * (0.2 + (k % 2) * 0.4), top: 6 + Math.floor(k / 2) * 12, width: 4, height: 5, backgroundColor: '#ffcf7a', opacity: r() > 0.4 ? 0.85 : 0.15 }} />)}
          </View>
        );
      })}</>;
    case 'rain':
      return <>{Array.from({ length: 22 }, (_, i) => <View key={i} style={{ position: 'absolute', left: r() * w, top: r() * h * 0.8, width: 1.5, height: 14 + r() * 14, backgroundColor: '#dbe9f6', opacity: 0.35, transform: [{ rotate: '14deg' }] }} />)}</>;
    case 'fire':
    case 'warm':
      return <>{dots(14, mood === 'fire' ? '#ffb15c' : '#ffe2b0', 0.75, [2, 4])}</>;
    case 'tension':
      return <>{Array.from({ length: 5 }, (_, i) => <View key={i} style={{ position: 'absolute', left: (i + 0.5) * (w / 5), top: 0, width: 1.5, height: h, backgroundColor: '#ff9a9a', opacity: 0.12 + r() * 0.12 }} />)}</>;
    default:
      return null;
  }
}

export const Cover = memo(function Cover({ id, title, author, emoji, mood, width, aspect = 1.5, showTitle = true, image }: {
  id: string; title: string; author?: string; emoji: string; mood: Mood; width: number; aspect?: number; showTitle?: boolean;
  /** capa real (ex.: Project Gutenberg); se não carregar, usa a capa desenhada */
  image?: string;
}) {
  const art = ART[mood] ?? ART.calm;
  const h = width * aspect;
  const small = width < 140;
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <View style={[st.box, { width, height: h, borderRadius: small ? 10 : 14 }]} accessibilityRole="image" accessibilityLabel={`Capa de ${title}`}>
        <LinearGradient colors={art.colors} style={StyleSheet.absoluteFill} />
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      </View>
    );
  }
  return (
    <View style={[st.box, { width, height: h, borderRadius: small ? 10 : 14 }]} accessibilityRole="image" accessibilityLabel={`Capa de ${title}`}>
      <LinearGradient colors={art.colors} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      <Motif mood={mood} w={width} h={h} id={id} />
      <View style={[st.glow, { width: width * 0.62, height: width * 0.62, left: width * 0.19, top: h * (aspect > 1 ? 0.2 : 0.12), backgroundColor: art.glow }]} />
      <Text style={[st.emoji, { fontSize: width * (aspect > 1 ? 0.34 : 0.22), top: h * (aspect > 1 ? 0.25 : 0.16), width }]}>{emoji}</Text>
      {showTitle && (
        <>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={[st.shade, { height: h * 0.45 }]} />
          <View style={[st.caption, { padding: small ? 8 : 12 }]}>
            <Text style={[st.title, { fontSize: small ? 14 : width > 300 ? 26 : 18, lineHeight: small ? 17 : width > 300 ? 31 : 22 }]} numberOfLines={3}>{title}</Text>
            {author && !small ? <Text style={st.author} numberOfLines={1}>{author.toUpperCase()}</Text> : null}
          </View>
        </>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#111' },
  glow: { position: 'absolute', borderRadius: 999, opacity: 0.16 },
  emoji: { position: 'absolute', left: 0, textAlign: 'center' },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  caption: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 4 },
  title: { fontFamily: FONTS.serifMedium, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  author: { fontFamily: FONTS.uiBold, fontSize: 10.5, letterSpacing: 1.4, color: 'rgba(255,255,255,0.75)' },
});
