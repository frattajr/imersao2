/**
 * Capa de um livro desenhada em código, no estilo de capa de editora: fundo
 * em degradê suave na cor do clima da história, moldura fina, título em
 * letra de livro e autor em versalete. Sem emoji nem ilustração (fica limpo
 * numa estante cheia). Se houver capa real (Open Library, Gutenberg), usa a
 * imagem.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Mood } from '../core/types';
import { FONTS } from './prefs';

/** cor de cima, cor de baixo e cor do ornamento, por clima (tons baixos, para o tema escuro) */
export const COVER_ART: Record<Mood, { colors: [string, string]; ink: string }> = {
  sea: { colors: ['#24505f', '#122630'], ink: '#a7d6df' },
  fire: { colors: ['#70381f', '#2b150f'], ink: '#f0b27a' },
  warm: { colors: ['#6e5031', '#2a1e13'], ink: '#f0cf9c' },
  tension: { colors: ['#5e2230', '#231019'], ink: '#efa3a9' },
  forest: { colors: ['#2f513b', '#122219'], ink: '#bcdcb4' },
  night: { colors: ['#33306a', '#14132b'], ink: '#d2cdf6' },
  cold: { colors: ['#465f72', '#1a242d'], ink: '#dce9f2' },
  city: { colors: ['#4b3961', '#1d1628'], ink: '#ead09a' },
  rain: { colors: ['#3b4f61', '#172029'], ink: '#d1e1ee' },
  calm: { colors: ['#45435a', '#1b1a24'], ink: '#e3e1f2' },
};

export const Cover = memo(function Cover({ title, author, mood, width, aspect = 1.5, showTitle = true, image }: {
  id?: string; title: string; author?: string;
  /** legado: as capas não usam mais emoji */
  emoji?: string;
  mood: Mood; width: number; aspect?: number; showTitle?: boolean;
  /** capa real; se não carregar, usa a capa desenhada */
  image?: string;
}) {
  const art = COVER_ART[mood] ?? COVER_ART.calm;
  const h = width * aspect;
  const small = width < 120;
  const radius = small ? 8 : 10;
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <View style={[st.box, { width, height: h, borderRadius: radius }]} accessibilityRole="image" accessibilityLabel={`Capa de ${title}`}>
        <LinearGradient colors={art.colors} style={StyleSheet.absoluteFill} />
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      </View>
    );
  }
  const fs = Math.max(12, Math.min(26, width * (title.length > 28 ? 0.105 : 0.125)));
  const pad = Math.max(8, width * 0.09);
  return (
    <View style={[st.box, { width, height: h, borderRadius: radius }]} accessibilityRole="image" accessibilityLabel={`Capa de ${title}`}>
      <LinearGradient colors={art.colors} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* lombada: faixa escura à esquerda, como num livro de verdade */}
      <View style={[st.spine, { width: Math.max(3, width * 0.035) }]} />
      <View style={[st.frame, { margin: Math.max(4, width * 0.045), borderColor: art.ink + '33', borderRadius: Math.max(2, radius - 4) }]} />
      {showTitle && (
        <View style={[st.inner, { padding: pad, paddingLeft: pad + width * 0.03, paddingTop: h * 0.17 }]}>
          <View style={{ gap: fs * 0.5, alignItems: 'center' }}>
            <Text style={[st.title, { fontSize: fs, lineHeight: fs * 1.18 }]} numberOfLines={small ? 4 : 5}>{title}</Text>
            <View style={[st.rule, { backgroundColor: art.ink, width: width * 0.14 }]} />
          </View>
          {author ? (
            <Text style={[st.author, { fontSize: Math.max(8, Math.min(11, width * 0.07)), color: art.ink }]} numberOfLines={2}>
              {author.toUpperCase()}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
});

const st = StyleSheet.create({
  box: { overflow: 'hidden', backgroundColor: '#1a1a20' },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.22)' },
  frame: { ...StyleSheet.absoluteFillObject, borderWidth: 1 },
  inner: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: FONTS.serifMedium, color: '#f3eee4', textAlign: 'center' },
  rule: { height: 1, opacity: 0.7 },
  author: { fontFamily: FONTS.uiBold, letterSpacing: 1.2, textAlign: 'center', opacity: 0.85 },
});
