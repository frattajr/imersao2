"""Regras determinísticas (sem IA) para dados lidos por OCR no aparelho.

DOT do pneu: os 4 últimos dígitos são semana (01–53) e ano (2 dígitos) de
fabricação. Fabricantes e o INMETRO recomendam avaliar a troca a partir de
5 anos e não rodar com pneus acima de ~10 anos; usamos 5 anos (atenção) e
7 anos (troca recomendada) como limites conservadores.
"""

from __future__ import annotations

import re
from datetime import date

from .catalog import Component
from .prompts import disclaimer_for
from .schemas import AnalysisResult, Status

DOT_YELLOW_YEARS = 5.0
DOT_RED_YEARS = 7.0

_DOT_RE = re.compile(r"(?<!\d)(\d{2})(\d{2})(?!\d)")


def parse_dot(text: str, today: date) -> tuple[int, int] | None:
    """Extrai (semana, ano) do texto do DOT. Prefere o último grupo válido."""
    cleaned = text.upper().replace("O", "0").replace(" ", "")
    candidates = []
    for m in _DOT_RE.finditer(cleaned):
        week, yy = int(m.group(1)), int(m.group(2))
        year = 2000 + yy
        if not 1 <= week <= 53 or year > today.year:
            continue
        if year == today.year and week > today.isocalendar().week:
            continue
        candidates.append((week, year))
    return candidates[-1] if candidates else None


def tire_age_years(week: int, year: int, today: date) -> float:
    made = date.fromisocalendar(year, min(week, 52), 1)
    return (today - made).days / 365.25


def evaluate_dot(
    component: Component, ocr_text: str, today: date, next_guidance: str
) -> AnalysisResult | None:
    parsed = parse_dot(ocr_text, today)
    if not parsed:
        return None
    week, year = parsed
    age = tire_age_years(week, year, today)
    age_txt = f"{age:.1f}".replace(".", ",")
    band = component.costs.get("RED" if age >= DOT_RED_YEARS else "YELLOW")

    if age >= DOT_RED_YEARS:
        status = Status.RED
        risk = (
            f"Pneu com cerca de {age_txt} anos. A borracha envelhece mesmo com "
            "sulco bom e perde aderência; troca recomendada."
        )
    elif age >= DOT_YELLOW_YEARS:
        status = Status.YELLOW
        risk = (
            f"Pneu com cerca de {age_txt} anos. Ainda pode rodar, mas a troca "
            "deve entrar no orçamento em breve."
        )
    else:
        status = Status.GREEN
        risk = f"Pneu com cerca de {age_txt} anos, dentro da faixa usual."

    cost_min = band.min if status is not Status.GREEN and band else 0
    cost_max = band.max if status is not Status.GREEN and band else 0
    return AnalysisResult(
        component_id=component.id,
        status=status,
        confidence_score=0.9,
        visual_findings=f"Código DOT lido: semana {week:02d} de {year}.",
        risk_assessment=risk,
        is_negotiation_lever=status is not Status.GREEN,
        estimated_cost_min=cost_min,
        estimated_cost_max=cost_max,
        legal_disclaimer=disclaimer_for(component),
        user_guidance_next_step=next_guidance,
    )


_KM_RE = re.compile(r"\d[\d.\s]{2,8}\d|\d{3,7}")


def parse_odometer(text: str) -> int | None:
    best = None
    for m in _KM_RE.finditer(text):
        digits = re.sub(r"\D", "", m.group(0))
        if 3 <= len(digits) <= 7:
            km = int(digits)
            best = km if best is None or km > best else best
    return best


def odometer_mismatch(declared_km: int, ocr_text: str | None) -> str | None:
    """Texto de alerta se o hodômetro lido difere do anunciado em >5%/2.000 km."""
    if not ocr_text:
        return None
    read = parse_odometer(ocr_text)
    if read is None:
        return None
    if abs(read - declared_km) > max(2000, declared_km * 0.05):
        fmt = lambda n: f"{n:,}".replace(",", ".")  # noqa: E731
        return (
            f"O painel mostra cerca de {fmt(read)} km, diferente dos "
            f"{fmt(declared_km)} km informados no anúncio."
        )
    return None
