"""Camada de visão multimodal.

Provedores intercambiáveis por variável de ambiente (`VISION_PROVIDER`):
- `gemini`  → Gemini Flash com `responseSchema` (JSON estrito)
- `openai`  → GPT-4o-mini com `response_format: json_schema` strict
- `mock`    → resposta fixa, para desenvolvimento e testes

Todos devolvem `AnalysisResult` já validado pelo Pydantic. Resposta fora do
schema → uma nova tentativa; persistindo, `VisionError` (o chamador converte
em INCONCLUSIVE, nunca em GREEN).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from pydantic import ValidationError

from .prompts import SYSTEM_PROMPT
from .schemas import AnalysisResult


class VisionError(RuntimeError):
    pass


@dataclass(frozen=True)
class VisionInput:
    component_id: str
    prompt: str
    image_base64: str  # o servidor baixa URLs antes (ver main._load_image)
    mime_type: str = "image/jpeg"


class VisionProvider(Protocol):
    name: str
    model: str

    async def analyze(self, inp: VisionInput) -> AnalysisResult: ...


_PROPS: dict[str, dict[str, Any]] = {
    "component_id": {"type": "string"},
    "status": {"type": "string", "enum": ["GREEN", "YELLOW", "RED", "INCONCLUSIVE"]},
    "confidence_score": {"type": "number"},
    "visual_findings": {"type": "string"},
    "risk_assessment": {"type": "string"},
    "is_negotiation_lever": {"type": "boolean"},
    "estimated_cost_min": {"type": "integer"},
    "estimated_cost_max": {"type": "integer"},
    "legal_disclaimer": {"type": "string"},
    "user_guidance_next_step": {"type": "string"},
}
REQUIRED = list(_PROPS)

OPENAI_SCHEMA = {
    "type": "object",
    "properties": _PROPS,
    "required": REQUIRED,
    "additionalProperties": False,
}

GEMINI_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        k: {**v, "type": v["type"].upper()} for k, v in _PROPS.items()
    },
    "required": REQUIRED,
    "propertyOrdering": REQUIRED,
}


def parse_result(text: str, component_id: str) -> AnalysisResult:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`").removeprefix("json").strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise VisionError(f"resposta não é JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise VisionError("resposta não é um objeto JSON")
    data["component_id"] = component_id
    # Modelos às vezes mandam custos como float ou confiança em 0–100.
    for k in ("estimated_cost_min", "estimated_cost_max"):
        if isinstance(data.get(k), float):
            data[k] = round(data[k])
    conf = data.get("confidence_score")
    if isinstance(conf, (int, float)) and 1 < conf <= 100:
        data["confidence_score"] = conf / 100
    try:
        return AnalysisResult.model_validate(data)
    except ValidationError as exc:
        raise VisionError(f"resposta fora do schema: {exc.error_count()} erro(s)") from exc


async def _with_retry(call, component_id: str, attempts: int = 2) -> AnalysisResult:
    last: Exception | None = None
    for _ in range(attempts):
        try:
            return parse_result(await call(), component_id)
        except (VisionError, httpx.HTTPError, KeyError, IndexError) as exc:
            last = exc
    raise VisionError(str(last))


class GeminiProvider:
    name = "gemini"

    def __init__(self, api_key: str, model: str, client: httpx.AsyncClient) -> None:
        self.api_key, self.model, self.client = api_key, model, client

    async def analyze(self, inp: VisionInput) -> AnalysisResult:
        image_part = {"inline_data": {"mime_type": inp.mime_type, "data": inp.image_base64}}
        body = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": inp.prompt}, image_part]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 800,
                "responseMimeType": "application/json",
                "responseSchema": GEMINI_SCHEMA,
            },
        }
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent"
        )

        async def call() -> str:
            r = await self.client.post(
                url, json=body, headers={"x-goog-api-key": self.api_key}, timeout=30
            )
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]

        return await _with_retry(call, inp.component_id)


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str, client: httpx.AsyncClient) -> None:
        self.api_key, self.model, self.client = api_key, model, client

    async def analyze(self, inp: VisionInput) -> AnalysisResult:
        url = f"data:{inp.mime_type};base64,{inp.image_base64}"
        body = {
            "model": self.model,
            "temperature": 0.2,
            "max_tokens": 800,
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "analysis_result", "strict": True, "schema": OPENAI_SCHEMA},
            },
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": inp.prompt},
                        {"type": "image_url", "image_url": {"url": url, "detail": "high"}},
                    ],
                },
            ],
        }

        async def call() -> str:
            r = await self.client.post(
                "https://api.openai.com/v1/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

        return await _with_retry(call, inp.component_id)


class MockProvider:
    """Determinístico: útil para desenvolver o app sem gastar chamadas."""

    name = "mock"
    model = "mock-1"

    def __init__(self, canned: dict[str, dict[str, Any]] | None = None) -> None:
        self.canned = canned or {}
        self.calls: list[VisionInput] = []

    async def analyze(self, inp: VisionInput) -> AnalysisResult:
        self.calls.append(inp)
        data = {
            "component_id": inp.component_id,
            "status": "GREEN",
            "confidence_score": 0.85,
            "visual_findings": "Simulação: nenhum indício visual de anomalia.",
            "risk_assessment": "Simulação de desenvolvimento (VISION_PROVIDER=mock).",
            "is_negotiation_lever": False,
            "estimated_cost_min": 0,
            "estimated_cost_max": 0,
            "legal_disclaimer": "",
            "user_guidance_next_step": "",
            **self.canned.get(inp.component_id, {}),
        }
        return parse_result(json.dumps(data), inp.component_id)


def build_provider(settings, client: httpx.AsyncClient) -> VisionProvider:
    if settings.vision_provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY não configurada")
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model, client)
    if settings.vision_provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY não configurada")
        return OpenAIProvider(settings.openai_api_key, settings.openai_model, client)
    return MockProvider()
