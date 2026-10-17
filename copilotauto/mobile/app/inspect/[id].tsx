import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '../../src/api';
import { checkQuality, prepareUpload } from '../../src/capture';
import { parseDot, parseOdometer, recognizeText } from '../../src/ocr';
import { CameraOverlay } from '../../src/overlays';
import { ISSUE_TIP } from '../../src/quality';
import { MODULES, STEPS } from '../../src/steps';
import { brl, colors, STATUS } from '../../src/theme';
import type { AnalysisResult } from '../../src/types';

type Phase =
  | { kind: 'intro' }
  | { kind: 'camera'; tip?: string }
  | { kind: 'working'; label: string }
  | { kind: 'manualDot' }
  | { kind: 'result'; result: AnalysisResult };

export default function Inspect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [torch, setTorch] = useState(false);
  const [dotInput, setDotInput] = useState('');

  const step = STEPS[index];
  const module = MODULES[step.module];

  useEffect(() => setTorch(!!step.torch), [index, step.torch]);

  function goNext() {
    const next = index + 1;
    if (next >= STEPS.length) {
      router.replace({ pathname: '/report/[id]', params: { id } });
      return;
    }
    const newModule = STEPS[next].module !== step.module;
    setIndex(next);
    setPhase(newModule ? { kind: 'intro' } : { kind: 'camera' });
  }

  async function send(body: Parameters<typeof api.analyze>[1]) {
    setPhase({ kind: 'working', label: 'Analisando…' });
    try {
      const result = await api.analyze(id, body);
      Haptics.notificationAsync(
        result.status === 'RED'
          ? Haptics.NotificationFeedbackType.Error
          : result.status === 'GREEN'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
      );
      setPhase({ kind: 'result', result });
    } catch (e) {
      setPhase({ kind: 'camera', tip: `Falha de envio: ${e instanceof Error ? e.message : e}. Tente de novo.` });
    }
  }

  async function shoot() {
    if (!cam.current) return;
    setPhase({ kind: 'working', label: 'Conferindo a foto…' });
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.9 });
      if (!photo) throw new Error('sem foto');
      const text = step.ocr ? await recognizeText(photo.uri) : '';

      if (step.ocrOnly) {
        const dot = parseDot(text);
        if (!dot) {
          setPhase({ kind: 'manualDot' });
          return;
        }
        await send({
          component_id: step.componentId,
          position: step.position,
          ocr_text: `${String(dot.week).padStart(2, '0')}${String(dot.year % 100).padStart(2, '0')}`,
        });
        return;
      }

      // Portão local: foto tremida/escura não sai do aparelho.
      const q = await checkQuality(photo.uri);
      if (!q.ok && q.issue) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setPhase({ kind: 'camera', tip: ISSUE_TIP[q.issue] });
        return;
      }
      setPhase({ kind: 'working', label: 'Enviando…' });
      const image = await prepareUpload(photo.uri, photo.width, photo.height);
      const km = step.ocr === 'odometer' ? parseOdometer(text) : null;
      await send({
        component_id: step.componentId,
        position: step.position,
        image_base64: image,
        ocr_text: km != null ? String(km) : undefined,
        client_blur_score: q.sharpness,
        client_brightness: q.brightness,
      });
    } catch (e) {
      setPhase({ kind: 'camera', tip: `Não foi possível capturar: ${e instanceof Error ? e.message : e}` });
    }
  }

  if (!perm) return <View style={s.fill} />;
  if (!perm.granted) {
    return (
      <SafeAreaView style={[s.fill, s.center]}>
        <Text style={s.body}>Precisamos da câmera para guiar as fotos da vistoria.</Text>
        <Pressable style={s.cta} onPress={requestPerm}>
          <Text style={s.ctaText}>Permitir câmera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const progress = `${index + 1}/${STEPS.length}`;

  if (phase.kind === 'intro') {
    return (
      <SafeAreaView style={[s.fill, s.pad]}>
        <Text style={s.kicker}>{progress} · Módulo</Text>
        <Text style={s.h1}>{module.title}</Text>
        <Text style={s.body}>{module.intro}</Text>
        <View style={{ flex: 1 }} />
        <Pressable style={s.cta} onPress={() => setPhase({ kind: 'camera' })}>
          <Text style={s.ctaText}>Abrir câmera</Text>
        </Pressable>
        <Pressable style={s.ghost} onPress={() => router.replace({ pathname: '/report/[id]', params: { id } })}>
          <Text style={s.ghostText}>Encerrar e ver relatório</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'result') {
    const r = phase.result;
    const st = STATUS[r.status];
    const retake = r.status === 'INCONCLUSIVE';
    return (
      <SafeAreaView style={s.fill}>
        <ScrollView contentContainerStyle={s.pad}>
          <Text style={s.kicker}>{progress} · {step.title}</Text>
          <View style={[s.badge, { backgroundColor: st.color }]}>
            <Text style={s.badgeText}>{st.label}</Text>
          </View>
          <Text style={s.h2}>O que a foto mostra</Text>
          <Text style={s.body}>{r.visual_findings}</Text>
          <Text style={s.h2}>O que pode significar</Text>
          <Text style={s.body}>{r.risk_assessment}</Text>
          {r.is_negotiation_lever && (
            <View style={s.lever}>
              <Text style={s.leverTitle}>Argumento de negociação</Text>
              <Text style={s.leverValue}>
                {brl(r.estimated_cost_min)} – {brl(r.estimated_cost_max)}
              </Text>
            </View>
          )}
          <Text style={s.next}>{r.user_guidance_next_step}</Text>
          <Text style={s.disclaimer}>{r.legal_disclaimer}</Text>
          <Text style={s.disclaimer}>Confiança da triagem: {Math.round(r.confidence_score * 100)}%</Text>
        </ScrollView>
        <View style={s.footer}>
          <Pressable style={retake ? s.cta : s.ghost} onPress={() => setPhase({ kind: 'camera' })}>
            <Text style={retake ? s.ctaText : s.ghostText}>Refazer foto</Text>
          </Pressable>
          <Pressable style={retake ? s.ghost : s.cta} onPress={goNext}>
            <Text style={retake ? s.ghostText : s.ctaText}>
              {retake ? 'Pular este item' : index + 1 >= STEPS.length ? 'Ver relatório' : 'Próximo'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase.kind === 'manualDot') {
    const ok = /^\d{4}$/.test(dotInput) && parseDot(dotInput) !== null;
    return (
      <SafeAreaView style={[s.fill, s.pad]}>
        <Text style={s.kicker}>{progress} · {step.title}</Text>
        <Text style={s.h1}>Não consegui ler o DOT</Text>
        <Text style={s.body}>
          Procure "DOT" na lateral do pneu. Digite os 4 últimos dígitos, que ficam numa caixinha separada
          (ex.: 3521 = semana 35 de 2021).
        </Text>
        <TextInput
          style={s.input}
          value={dotInput}
          onChangeText={(v) => setDotInput(v.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          placeholder="SSAA"
          placeholderTextColor={colors.muted}
          maxLength={4}
        />
        <Pressable
          style={[s.cta, !ok && { opacity: 0.4 }]}
          disabled={!ok}
          onPress={() => {
            setDotInput('');
            send({ component_id: step.componentId, position: step.position, ocr_text: dotInput });
          }}
        >
          <Text style={s.ctaText}>Confirmar</Text>
        </Pressable>
        <Pressable style={s.ghost} onPress={() => setPhase({ kind: 'camera' })}>
          <Text style={s.ghostText}>Tentar outra foto</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={s.fill}>
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} autofocus="on" />
      <CameraOverlay kind={step.overlay} />
      <SafeAreaView style={s.camTop} edges={['top']}>
        <Text style={s.kicker}>{progress} · {module.title}</Text>
        <Text style={s.camTitle}>{step.title}</Text>
        <Text style={s.camHint}>{step.instruction}</Text>
        {phase.kind === 'camera' && phase.tip && <Text style={s.tip}>{phase.tip}</Text>}
      </SafeAreaView>
      <SafeAreaView style={s.camBottom} edges={['bottom']}>
        <Pressable style={s.torch} onPress={() => setTorch((t) => !t)} accessibilityLabel="Lanterna">
          <Text style={s.torchText}>{torch ? 'Luz ligada' : 'Luz'}</Text>
        </Pressable>
        <Pressable
          style={s.shutter}
          onPress={shoot}
          disabled={phase.kind === 'working'}
          accessibilityLabel="Tirar foto"
        >
          {phase.kind === 'working' ? <ActivityIndicator color={colors.onAccent} /> : <View style={s.shutterInner} />}
        </Pressable>
        <Pressable style={s.torch} onPress={goNext} accessibilityLabel="Pular">
          <Text style={s.torchText}>Pular</Text>
        </Pressable>
      </SafeAreaView>
      {phase.kind === 'working' && <Text style={s.working}>{phase.label}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  pad: { padding: 20, paddingBottom: 32 },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  h1: { color: colors.text, fontSize: 26, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  h2: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 6 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginTop: 12 },
  badgeText: { color: '#111', fontWeight: '700' },
  lever: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginTop: 20 },
  leverTitle: { color: colors.muted, fontSize: 13 },
  leverValue: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 4 },
  next: { color: colors.text, fontSize: 15, marginTop: 20, fontWeight: '500' },
  disclaimer: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 14 },
  footer: { flexDirection: 'row', gap: 12, padding: 16, borderTopColor: colors.line, borderTopWidth: 1 },
  cta: { flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  ctaText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
  ghost: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  ghostText: { color: colors.text, fontWeight: '600', fontSize: 16 },
  input: {
    backgroundColor: colors.surface, borderRadius: 10, color: colors.text, fontSize: 28, letterSpacing: 8,
    textAlign: 'center', paddingVertical: 12, marginVertical: 20,
  },
  camTop: { position: 'absolute', top: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(0,0,0,0.45)' },
  camTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 },
  camHint: { color: '#E6E6E6', fontSize: 14, lineHeight: 20, marginTop: 4 },
  tip: { color: colors.onAccent, backgroundColor: colors.accent, borderRadius: 8, padding: 10, marginTop: 10, fontWeight: '600' },
  camBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 16,
  },
  torch: { width: 80, paddingVertical: 10, alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
  torchText: { color: '#fff', fontWeight: '600' },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: '#111' },
  working: { position: 'absolute', alignSelf: 'center', top: '48%', color: '#fff', fontSize: 16, fontWeight: '600' },
});
