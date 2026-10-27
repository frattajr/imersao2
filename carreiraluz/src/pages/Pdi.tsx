import { useState } from 'react';
import { Icon } from '../components/Icon';
import { ConfirmButton, ProgressBar, SectionTitle } from '../components/ui';
import { marketLabel, roleTitle, sizeLabel } from '../data/catalog';
import { getProfile } from '../data/profiles';
import type { PdiHorizon, PdiItem, PdiKind } from '../data/types';
import { KIND_LABELS, generatePdi, newItem, priorities, progress } from '../lib/pdi';
import { href } from '../lib/router';
import { profileKey, useStore } from '../lib/store';

const HORIZONS: { h: PdiHorizon; title: string; focus: string }[] = [
  { h: 30, title: 'Primeiros 30 dias', focus: 'Entender e alinhar' },
  { h: 60, title: '31 a 60 dias', focus: 'Praticar' },
  { h: 90, title: '61 a 90 dias', focus: 'Demonstrar' },
];

export function Pdi() {
  const { state, dispatch } = useStore();
  const sel = state.selection;
  const key = profileKey(sel);
  const profile = getProfile(sel.roleId, sel.level);
  const plan = state.pdi[key];
  const self = state.self[key] ?? {};
  const [editing, setEditing] = useState(false);

  if (!profile) return null;
  const pr = priorities(profile, self);
  const assessedCount = Object.keys(self).length;

  const header = (
    <div className="pdi-head">
      <div className="crumbs">
        <a href={href('/guia')}>Seu guia</a> <Icon name="chevron-right" size={14} /> Meu plano de evolução
      </div>
      <h1>Meu plano de evolução</h1>
      <p className="profile-line">
        <span>{roleTitle(sel.roleId, sel.level)}</span>
        <span>{marketLabel(sel.marketId)}</span>
        <span>{sizeLabel(sel.sizeId)} empresa</span>
        <a href={href('/guia')}>Alterar</a>
      </p>
    </div>
  );

  if (!plan) {
    return (
      <div className="wrap page">
        {header}
        <div className="panel pdi-start">
          <div className="pdi-start-art">
            <Icon name="target" size={40} />
          </div>
          <h2>Crie um plano de 30, 60 e 90 dias</h2>
          <p>
            O plano parte do que costuma ser esperado de {roleTitle(sel.roleId, sel.level)} e do que muda no próximo nível. Ele
            inclui competências prioritárias, lacunas a investigar, ações práticas, conversas importantes, experiências,
            entregas e indicadores.
          </p>
          {assessedCount > 0 ? (
            <div className="note note-lilac">
              <Icon name="sparkles" size={18} />
              <span>
                Você fez a autoavaliação de {assessedCount} competência(s). As prioridades serão <b>personalizadas</b> com base no
                que você apontou{pr.items.length ? `: ${pr.items.map((i) => i.c.name).join(', ')}` : ''}.
              </span>
            </div>
          ) : (
            <div className="note note-gray">
              <Icon name="info" size={18} />
              <span>
                Sem autoavaliação, o plano será <b>genérico</b> para o cargo: não temos como saber as suas lacunas individuais.{' '}
                <a href={href('/guia')}>Fazer a autoavaliação no guia</a> (opcional, cerca de 2 minutos).
              </span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => dispatch({ type: 'pdi:set', profileKey: key, items: generatePdi(profile, self) })}
          >
            Gerar meu plano <Icon name="arrow-right" size={18} />
          </button>
        </div>
      </div>
    );
  }

  const pct = progress(plan.items);
  const counts = {
    personalizada: plan.items.filter((i) => i.origin === 'personalizada').length,
    generica: plan.items.filter((i) => i.origin === 'generica').length,
  };

  return (
    <div className="wrap page">
      {header}
      <div className="pdi-summary panel">
        <div className="pdi-progress">
          <div className="ring" style={{ ['--p' as string]: pct }} aria-hidden="true">
            <span>{pct}%</span>
          </div>
          <div>
            <b>
              {plan.items.filter((i) => i.done).length} de {plan.items.length} ações concluídas
            </b>
            <ProgressBar value={pct} label="Progresso do plano" />
            <p className="muted small">Criado em {new Date(plan.createdAt).toLocaleDateString('pt-BR')}. Salvo neste navegador.</p>
          </div>
        </div>
        <div className="pdi-legend">
          <span className="badge badge-lilac">
            <Icon name="sparkles" size={14} /> Personalizada · {counts.personalizada}
          </span>
          <span className="badge badge-gray">Genérica para o cargo · {counts.generica}</span>
        </div>
        <div className="pdi-actions">
          <button type="button" className={`btn ${editing ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEditing((e) => !e)}>
            <Icon name={editing ? 'check' : 'edit'} size={16} /> {editing ? 'Concluir edição' : 'Editar plano'}
          </button>
          <ConfirmButton
            label="Gerar novamente"
            question="Substituir o plano atual e o progresso?"
            confirmLabel="Gerar novo plano"
            onConfirm={() => dispatch({ type: 'pdi:set', profileKey: key, items: generatePdi(profile, self) })}
          />
        </div>
      </div>

      <div className="note note-gray">
        <Icon name="info" size={18} />
        <span>
          Itens <b>genéricos</b> valem para quem ocupa esta cadeira. Itens <b>personalizados</b> vêm da sua autoavaliação ou foram
          escritos por você. O plano é uma recomendação educacional: ajuste ao que você e sua liderança combinarem.
        </span>
      </div>

      <div className="pdi-columns">
        {HORIZONS.map(({ h, title, focus }) => {
          const items = plan.items.filter((i) => i.horizon === h);
          const p = progress(items);
          return (
            <section key={h} className="pdi-col" aria-labelledby={`h${h}`}>
              <header>
                <span className="pdi-h">{h} dias</span>
                <h2 id={`h${h}`}>{title}</h2>
                <span className="muted small">{focus}</span>
                <ProgressBar value={p} label={`Progresso de ${title}`} />
              </header>
              <ul className="pdi-items">
                {items.map((it) => (
                  <PdiRow key={it.id} item={it} editing={editing} profileKeyStr={key} />
                ))}
              </ul>
              {editing && <AddItem horizon={h} profileKeyStr={key} />}
            </section>
          );
        })}
      </div>

      <section className="page-section">
        <SectionTitle title="Precisa de apoio para uma das conversas?" subtitle="Os guias de situações difíceis têm roteiros e frases de exemplo." />
        <div className="link-row">
          <a className="btn btn-coral" href={href('/desafio/escopo-maior')}>
            Pedir um escopo maior
          </a>
          <a className="btn btn-coral" href={href('/desafio/sinais-promocao')}>
            Entender se estou sendo preparado(a)
          </a>
          <a className="btn btn-coral" href={href('/desafio/pedir-aumento')}>
            Negociar remuneração
          </a>
        </div>
      </section>
      <p className="center">
        <ConfirmButton
          label="Apagar plano"
          className="link-btn danger"
          question="Apagar este plano?"
          confirmLabel="Apagar"
          onConfirm={() => dispatch({ type: 'pdi:clear', profileKey: key })}
        />
      </p>
    </div>
  );
}

function PdiRow({ item, editing, profileKeyStr }: { item: PdiItem; editing: boolean; profileKeyStr: string }) {
  const { dispatch } = useStore();
  const [text, setText] = useState(item.text);
  const update = (patch: Partial<PdiItem>) => dispatch({ type: 'pdi:update', profileKey: profileKeyStr, item: { ...item, ...patch } });
  return (
    <li className={`pdi-item${item.done ? ' done' : ''}`}>
      <span className="pdi-kind">
        {KIND_LABELS[item.kind]}
        {item.origin === 'personalizada' ? (
          <span className="badge badge-lilac tiny">Personalizada</span>
        ) : (
          <span className="badge badge-gray tiny">Genérica</span>
        )}
      </span>
      {editing ? (
        <div className="pdi-edit">
          <textarea
            value={text}
            aria-label="Texto da ação"
            rows={3}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text.trim() && text !== item.text && update({ text: text.trim() })}
          />
          <button
            type="button"
            className="icon-btn danger"
            aria-label="Remover ação"
            onClick={() => dispatch({ type: 'pdi:remove', profileKey: profileKeyStr, id: item.id })}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      ) : (
        <label className="pdi-check">
          <input type="checkbox" checked={item.done} onChange={(e) => update({ done: e.target.checked })} />
          <span>{item.text}</span>
        </label>
      )}
      {item.reason && !editing && <span className="pdi-reason">{item.reason}</span>}
    </li>
  );
}

function AddItem({ horizon, profileKeyStr }: { horizon: PdiHorizon; profileKeyStr: string }) {
  const { dispatch } = useStore();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PdiKind>('acao');
  return (
    <form
      className="pdi-add"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        dispatch({ type: 'pdi:add', profileKey: profileKeyStr, item: newItem(horizon, kind, text.trim()) });
        setText('');
      }}
    >
      <select value={kind} onChange={(e) => setKind(e.target.value as PdiKind)} aria-label="Tipo de ação">
        {Object.entries(KIND_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Nova ação…" aria-label="Nova ação" />
      <button type="submit" className="btn btn-primary btn-sm">
        <Icon name="plus" size={16} /> Adicionar
      </button>
    </form>
  );
}
