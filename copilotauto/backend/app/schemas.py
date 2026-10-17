"""Contratos da API (Pydantic v2).

`AnalysisResult` é o JSON exigido do modelo de visão. O servidor valida a
resposta contra ele e depois aplica as travas de `guardrails.py` — o texto do
modelo nunca chega ao app sem passar por elas.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Status(str, Enum):
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    RED = "RED"
    INCONCLUSIVE = "INCONCLUSIVE"


class AnalysisResult(BaseModel):
    """Saída estrita da camada de visão (e do endpoint de análise)."""

    model_config = ConfigDict(extra="forbid")

    component_id: str
    status: Status
    confidence_score: Annotated[float, Field(ge=0.0, le=1.0)]
    visual_findings: Annotated[str, Field(max_length=600)]
    risk_assessment: Annotated[str, Field(max_length=600)]
    is_negotiation_lever: bool
    estimated_cost_min: Annotated[int, Field(ge=0)]
    estimated_cost_max: Annotated[int, Field(ge=0)]
    legal_disclaimer: Annotated[str, Field(max_length=600)]
    user_guidance_next_step: Annotated[str, Field(max_length=300)]

    @model_validator(mode="after")
    def _cost_order(self) -> "AnalysisResult":
        if self.estimated_cost_max < self.estimated_cost_min:
            self.estimated_cost_min, self.estimated_cost_max = (
                self.estimated_cost_max,
                self.estimated_cost_min,
            )
        return self


class Vehicle(BaseModel):
    make: Annotated[str, Field(min_length=1, max_length=40)]
    model: Annotated[str, Field(min_length=1, max_length=60)]
    year: Annotated[int, Field(ge=1980, le=2100)]
    km: Annotated[int, Field(ge=0, le=2_000_000)]
    vin: Annotated[str | None, Field(default=None, max_length=17)] = None
    plate: Annotated[str | None, Field(default=None, max_length=8)] = None
    asking_price: Annotated[int | None, Field(default=None, ge=0)] = None


class CreateInspection(BaseModel):
    vehicle: Vehicle
    terms_version: str = Field(
        description="Versão dos termos de uso aceitos no app (obrigatório)."
    )
    terms_accepted_at: datetime


class Inspection(BaseModel):
    id: UUID
    user_id: str
    vehicle: Vehicle
    terms_version: str
    created_at: datetime


TirePosition = Literal["FL", "FR", "RL", "RR"]


class AnalyzeRequest(BaseModel):
    component_id: str
    image_base64: str | None = Field(
        default=None, description="JPEG em base64 (sem prefixo data:)."
    )
    image_url: str | None = Field(
        default=None, description="URL assinada temporária (Supabase Storage)."
    )
    position: TirePosition | None = None
    # Texto lido no aparelho pelo ML Kit (DOT do pneu, hodômetro, chassi).
    ocr_text: Annotated[str | None, Field(default=None, max_length=200)] = None
    # Métricas calculadas no aparelho antes do envio (auditoria de custo).
    client_blur_score: float | None = None
    client_brightness: float | None = None

    @model_validator(mode="after")
    def _one_image(self) -> "AnalyzeRequest":
        if not self.image_base64 and not self.image_url and not self.ocr_text:
            raise ValueError("Envie image_base64, image_url ou ocr_text.")
        return self


class StoredFinding(BaseModel):
    inspection_id: UUID
    position: TirePosition | None = None
    result: AnalysisResult
    source: Literal["vision", "ocr_rule", "quality_gate", "fallback"]
    model: str | None = None
    created_at: datetime


class NegotiationLever(BaseModel):
    component_id: str
    label: str
    position: TirePosition | None = None
    status: Status
    cost_min: int
    cost_max: int
    argument: str


class NegotiationSummary(BaseModel):
    levers: list[NegotiationLever]
    total_cost_min: int
    total_cost_max: int
    asking_price: int | None
    suggested_offer: int | None
    walk_away_price: int | None
    discount_capped: bool
    recommend_professional_inspection: bool
    recommendation: str


class Report(BaseModel):
    inspection: Inspection
    findings: list[StoredFinding]
    missing_components: list[str]
    negotiation: NegotiationSummary
    legal_notice: str
