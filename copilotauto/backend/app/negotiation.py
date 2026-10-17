"""Módulo de negociação: transforma achados em argumentos e uma oferta.

Regras:
- Só contam achados YELLOW/RED com custo (alavancas). Para os pneus, cada roda
  conta uma vez, pelo pior resultado entre DOT e banda de rodagem.
- Oferta sugerida = preço pedido − média das faixas; teto de desconto de 25%
  do preço pedido (acima disso o argumento perde credibilidade na mesa).
- Preço de desistência = preço pedido − custo máximo.
- Qualquer RED estrutural ou mais de 3 alavancas RED → recomendar laudo
  cautelar ANTES de negociar preço.
"""

from __future__ import annotations

from .catalog import BY_ID, slot_label
from .schemas import NegotiationLever, NegotiationSummary, Status, StoredFinding

MAX_DISCOUNT_RATIO = 0.25
_RANK = {Status.RED: 2, Status.YELLOW: 1}


def _argument(label: str, f: StoredFinding) -> str:
    r = f.result
    fmt = lambda n: f"R$ {n:,}".replace(",", ".")  # noqa: E731
    return (
        f"{label}: {r.visual_findings} Custo estimado de correção entre "
        f"{fmt(r.estimated_cost_min)} e {fmt(r.estimated_cost_max)}."
    )


def summarize(findings: list[StoredFinding], asking_price: int | None) -> NegotiationSummary:
    # Último resultado de cada foto vale (o usuário pode refazer a foto).
    latest: dict[tuple[str, str | None], StoredFinding] = {}
    for f in sorted(findings, key=lambda x: x.created_at):
        latest[(f.result.component_id, f.position)] = f

    # Pneus: um custo por roda, mesmo que DOT e banda indiquem troca.
    chosen: dict[tuple[str, str | None], StoredFinding] = {}
    for (cid, pos), f in latest.items():
        if not f.result.is_negotiation_lever:
            continue
        key = ("tire", pos) if BY_ID[cid].module == "tires" else (cid, pos)
        cur = chosen.get(key)
        if cur is None or (
            _RANK[f.result.status], f.result.estimated_cost_max
        ) > (_RANK[cur.result.status], cur.result.estimated_cost_max):
            chosen[key] = f

    levers = []
    for f in chosen.values():
        comp = BY_ID[f.result.component_id]
        label = slot_label(comp, f.position)
        levers.append(
            NegotiationLever(
                component_id=comp.id,
                label=label,
                position=f.position,
                status=f.result.status,
                cost_min=f.result.estimated_cost_min,
                cost_max=f.result.estimated_cost_max,
                argument=_argument(label, f),
            )
        )
    levers.sort(key=lambda l: (-_RANK[l.status], -l.cost_max))

    total_min = sum(l.cost_min for l in levers)
    total_max = sum(l.cost_max for l in levers)

    structural_red = any(
        l.status is Status.RED and BY_ID[l.component_id].structural for l in levers
    )
    many_red = sum(1 for l in levers if l.status is Status.RED) > 3
    recommend_pro = structural_red or many_red

    suggested = walk_away = None
    capped = False
    if asking_price:
        discount = (total_min + total_max) // 2
        cap = int(asking_price * MAX_DISCOUNT_RATIO)
        if discount > cap:
            discount, capped = cap, True
        suggested = _round_down(asking_price - discount)
        walk_away = _round_down(asking_price - min(total_max, cap))

    if recommend_pro:
        rec = (
            "Há indícios que exigem confirmação profissional. Antes de discutir "
            "preço, peça um laudo cautelar de empresa credenciada e uma avaliação "
            "em elevador. Se o vendedor recusar, considere seguir para outro carro."
        )
    elif levers:
        rec = (
            "Apresente os pontos em ordem, do mais caro ao mais barato, com as "
            "fotos. Comece pela oferta sugerida e não ultrapasse o preço de "
            "desistência sem resolver os itens pendentes."
        )
    else:
        rec = (
            "Nenhum ponto de negociação identificado nas fotos analisadas. Isso "
            "não garante a ausência de defeitos: faça também um teste de rodagem "
            "e, se possível, um laudo cautelar."
        )

    return NegotiationSummary(
        levers=levers,
        total_cost_min=total_min,
        total_cost_max=total_max,
        asking_price=asking_price,
        suggested_offer=suggested,
        walk_away_price=walk_away,
        discount_capped=capped,
        recommend_professional_inspection=recommend_pro,
        recommendation=rec,
    )


def _round_down(value: int, step: int = 500) -> int:
    return max(0, value - value % step)
