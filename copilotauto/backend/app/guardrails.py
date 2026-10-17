"""Travas aplicadas a TODA resposta antes de chegar ao usuário.

Objetivo: o app nunca afirma algo que uma foto não sustenta. O maior risco
civil (CDC, arts. 12/14 e 37) é a falsa tranquilidade — dizer "está tudo bem"
e o comprador levar um carro com defeito oculto — e a afirmação categórica
contra o vendedor ("o carro foi batido"). Por isso:

1. Confiança baixa vira INCONCLUSIVE (GREEN exige confiança maior que RED).
2. Linguagem categórica é suavizada para linguagem de probabilidade.
3. Custos são limitados à faixa do catálogo; GREEN/INCONCLUSIVE custam 0.
4. O aviso jurídico é sempre o texto canônico do servidor.
5. Achado estrutural vermelho sempre recomenda laudo cautelar.
"""

from __future__ import annotations

import re

from .catalog import Component
from .prompts import disclaimer_for
from .schemas import AnalysisResult, Status

MIN_CONFIDENCE = 0.50  # abaixo disso, nenhum status além de INCONCLUSIVE
MIN_CONFIDENCE_GREEN = 0.70  # "não vi problema" precisa de mais certeza

# (padrão, substituição). A ordem importa: frases antes de palavras soltas.
_ABSOLUTE_CLAIMS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(p, re.IGNORECASE), r)
    for p, r in [
        (r"\b(o )?carro (est[aá]|se encontra) (em )?(perfeito|[oó]timo) estado\b",
         "não foram vistos indícios de anomalia neste item"),
        (r"\bn[aã]o (tem|h[aá]|possui|apresenta) (nenhum )?(problema|defeito)s?\b",
         "não foram vistos indícios visuais de anomalia"),
        (r"\bsem (nenhum )?(problema|defeito)s?\b",
         "sem indícios visuais de anomalia"),
        (r"\b(foi|[ée]) (batido|sinistrado)\b", "apresenta indícios compatíveis com reparo"),
        (r"\bcarro batido\b", "carro com indícios de reparo"),
        (r"\b(hod[oô]metro|km|quilometragem) (foi )?(adulterad[oa]|rodad[oa]|voltad[oa])\b",
         r"\1 com indício de incoerência"),
        (r"\b(motor|junta) (est[aá] )?(queimad[oa]|condenad[oa])\b",
         r"\1 com indício de falha"),
        (r"\bcom (absoluta )?certeza\b", "provavelmente"),
        (r"\b(garantid[oa]|garantimos|garante)\b", "estimado"),
        (r"\b100 ?%", "alta probabilidade"),
        (r"\b(totalmente|completamente) (seguro|confi[aá]vel)\b", "sem indícios visuais de risco"),
        (r"\bpode comprar\b", "siga com a vistoria completa"),
        (r"\bn[aã]o compre\b", "considere uma avaliação profissional antes de decidir"),
    ]
]


def soften(text: str) -> str:
    out = text
    for pattern, repl in _ABSOLUTE_CLAIMS:
        out = pattern.sub(repl, out)
    return out.strip()


def enforce(
    raw: AnalysisResult,
    component: Component,
    *,
    retake_guidance: str,
    next_guidance: str,
) -> AnalysisResult:
    r = raw.model_copy(deep=True)
    r.component_id = component.id

    if r.confidence_score < MIN_CONFIDENCE or (
        r.status is Status.GREEN and r.confidence_score < MIN_CONFIDENCE_GREEN
    ):
        if r.status is not Status.INCONCLUSIVE:
            r.risk_assessment = (
                "A foto não permitiu uma conclusão segura. "
                + "Refaça a foto para uma nova análise."
            )
        r.status = Status.INCONCLUSIVE

    r.visual_findings = soften(r.visual_findings)
    r.risk_assessment = soften(r.risk_assessment)
    r.user_guidance_next_step = soften(r.user_guidance_next_step)

    band = component.costs.get(r.status.value)
    if r.status in (Status.GREEN, Status.INCONCLUSIVE) or band is None:
        r.estimated_cost_min = r.estimated_cost_max = 0
    else:
        lo = min(max(r.estimated_cost_min or band.min, band.min), band.max)
        hi = min(max(r.estimated_cost_max or band.max, band.min), band.max)
        r.estimated_cost_min, r.estimated_cost_max = min(lo, hi), max(lo, hi)

    r.is_negotiation_lever = (
        r.status in (Status.YELLOW, Status.RED) and r.estimated_cost_max > 0
    )

    if r.status is Status.INCONCLUSIVE:
        r.user_guidance_next_step = retake_guidance
    elif not r.user_guidance_next_step:
        r.user_guidance_next_step = next_guidance

    if component.structural and r.status is Status.RED:
        note = "Recomendado laudo cautelar antes de fechar negócio."
        if note not in r.risk_assessment:
            r.risk_assessment = f"{r.risk_assessment} {note}".strip()

    r.legal_disclaimer = disclaimer_for(component)
    # Revalida limites de tamanho depois das substituições.
    return AnalysisResult.model_validate(
        {
            **r.model_dump(),
            "visual_findings": r.visual_findings[:600],
            "risk_assessment": r.risk_assessment[:600],
            "user_guidance_next_step": r.user_guidance_next_step[:300],
        }
    )


def inconclusive(
    component: Component, findings: str, guidance: str, confidence: float = 0.0
) -> AnalysisResult:
    return AnalysisResult(
        component_id=component.id,
        status=Status.INCONCLUSIVE,
        confidence_score=confidence,
        visual_findings=findings,
        risk_assessment="Não foi possível avaliar este item com a foto enviada.",
        is_negotiation_lever=False,
        estimated_cost_min=0,
        estimated_cost_max=0,
        legal_disclaimer=disclaimer_for(component),
        user_guidance_next_step=guidance,
    )
