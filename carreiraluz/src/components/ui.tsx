import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { DataKind, Provenance } from '../data/types';
import { Icon } from './Icon';

export const KIND_INFO: Record<DataKind, { label: string; tone: string; text: string }> = {
  observado: { label: 'Dado observado', tone: 'green', text: 'Medido numa base identificada, com fonte, período e recorte.' },
  estimativa: { label: 'Estimativa', tone: 'blue', text: 'Calculado a partir de dados, com método declarado.' },
  demonstrativo: { label: 'Dado demonstrativo', tone: 'amber', text: 'Valor de exemplo para testar a interface. Não é dado de mercado.' },
  qualitativo: { label: 'Referência qualitativa', tone: 'lilac', text: 'Baseado em práticas recorrentes de mercado, não em uma medição.' },
  recomendacao: { label: 'Recomendação educacional', tone: 'lilac', text: 'Orientação prática para você adaptar ao seu contexto.' },
  hipotese: { label: 'Hipótese a validar', tone: 'gray', text: 'Hipótese de produto que ainda precisa ser validada.' },
  insuficiente: { label: 'Dados insuficientes', tone: 'gray', text: 'Não há dado confiável para este recorte.' },
};

export function KindBadge({ kind }: { kind: DataKind }) {
  const k = KIND_INFO[kind];
  return (
    <span className={`badge badge-${k.tone}`} title={k.text}>
      {k.label}
    </span>
  );
}

const fmtDate = (d?: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : undefined);

/** Linha de transparência: natureza, fonte, período, recorte e revisão. */
export function ProvenanceLine({ p, compact }: { p: Provenance; compact?: boolean }) {
  const parts = [
    p.source ? `Fonte: ${p.source}` : p.kind === 'demonstrativo' ? 'Sem fonte: valor de exemplo' : undefined,
    p.period ? `Período: ${p.period}` : undefined,
    p.geography ? `Recorte: ${p.geography}` : undefined,
    p.updatedAt ? `Revisado em ${fmtDate(p.updatedAt)}` : undefined,
  ].filter(Boolean);
  return (
    <div className={`provenance${compact ? ' compact' : ''}`}>
      <KindBadge kind={p.kind} />
      {parts.length > 0 && <span>{parts.join(' · ')}</span>}
    </div>
  );
}

/** Explicação que abre ao passar o cursor, focar ou tocar. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <span className="infotip" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="info" size={16} />
      </button>
      {open && (
        <span role="tooltip" id={id} className="infotip-pop">
          {children}
        </span>
      )}
    </span>
  );
}

export function ProgressBar({ value, tone = 'green', label }: { value: number; tone?: string; label?: string }) {
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div style={{ width: `${value}%` }} />
    </div>
  );
}

export function SectionTitle({ eyebrow, title, subtitle, id }: { eyebrow?: string; title: string; subtitle?: string; id?: string }) {
  return (
    <header className="section-title">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 id={id}>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </header>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Copiar frase"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // Sem permissão de área de transferência: nada a fazer.
        }
      }}
    >
      <Icon name={done ? 'check' : 'copy'} size={16} />
    </button>
  );
}

/** Ação destrutiva com confirmação na própria página (sem window.confirm). */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
  className = 'btn btn-ghost',
  icon,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  icon?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {icon && <Icon name={icon} size={16} />} {label}
      </button>
    );
  }
  return (
    <span className="confirm" role="group" aria-label={question}>
      <span>{question}</span>
      <button
        type="button"
        className="btn btn-sm btn-danger"
        autoFocus
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsking(false)}>
        Cancelar
      </button>
    </span>
  );
}
