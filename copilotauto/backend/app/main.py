"""API do CopilotAuto (FastAPI)."""

from __future__ import annotations

import base64
import logging
import secrets
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status

from . import catalog, guardrails, image_quality, negotiation, rules
from .auth import current_user
from .config import Settings, get_settings
from .prompts import REPORT_NOTICE, TERMS_VERSION, user_prompt
from .repository import MemoryRepository, Repository, SupabaseRepository
from .schemas import (
    AnalysisResult,
    AnalyzeRequest,
    CreateInspection,
    Inspection,
    Report,
    Status,
    StoredFinding,
)
from .vision import VisionError, VisionInput, VisionProvider, build_provider

log = logging.getLogger("copilotauto")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.http = httpx.AsyncClient(timeout=30)
    if not hasattr(app.state, "vision"):
        app.state.vision = build_provider(settings, app.state.http)
    if not hasattr(app.state, "repo"):
        app.state.repo = (
            SupabaseRepository(
                settings.supabase_url, settings.supabase_service_key,
                settings.photos_bucket, app.state.http,
            )
            if settings.use_supabase
            else MemoryRepository()
        )
    yield
    await app.state.http.aclose()


app = FastAPI(title="CopilotAuto API", version="0.1.0", lifespan=lifespan)


def repo(request: Request) -> Repository:
    return request.app.state.repo


def vision(request: Request) -> VisionProvider:
    return request.app.state.vision


async def owned_inspection(
    inspection_id: UUID,
    user_id: str = Depends(current_user),
    r: Repository = Depends(repo),
) -> Inspection:
    insp = await r.get_inspection(inspection_id, user_id)
    if not insp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vistoria não encontrada")
    return insp


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/v1/components")
async def components() -> dict:
    return {
        "terms_version": TERMS_VERSION,
        "modules": catalog.MODULES,
        "components": [
            {
                "id": c.id,
                "module": c.module,
                "label": c.label,
                "framing": c.framing,
                "per_position": c.per_position,
                "ocr_only": c.ocr_only,
            }
            for c in catalog.COMPONENTS
        ],
    }


@app.post("/v1/inspections", status_code=201, response_model=Inspection)
async def create_inspection(
    body: CreateInspection,
    user_id: str = Depends(current_user),
    r: Repository = Depends(repo),
) -> Inspection:
    if body.terms_version != TERMS_VERSION:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Aceite a versão atual dos termos ({TERMS_VERSION}) para continuar.",
        )
    return await r.create_inspection(user_id, body)


@app.get("/v1/inspections/{inspection_id}", response_model=Inspection)
async def get_inspection(insp: Inspection = Depends(owned_inspection)) -> Inspection:
    return insp


async def _load_image(body: AnalyzeRequest, settings: Settings, client: httpx.AsyncClient) -> bytes | None:
    if body.image_base64:
        return image_quality.decode(body.image_base64)
    if body.image_url:
        # Só URLs assinadas do nosso Storage (evita SSRF).
        allowed = f"{(settings.supabase_url or '').rstrip('/')}/storage/v1/object/sign/"
        if not settings.supabase_url or not body.image_url.startswith(allowed):
            raise image_quality.InvalidImage("image_url fora do Storage do projeto")
        resp = await client.get(body.image_url, timeout=15)
        resp.raise_for_status()
        if len(resp.content) > image_quality.MAX_BYTES:
            raise image_quality.InvalidImage("imagem maior que 6 MB")
        return resp.content
    return None


@app.post("/v1/inspections/{inspection_id}/analyses", response_model=AnalysisResult)
async def analyze(
    body: AnalyzeRequest,
    request: Request,
    insp: Inspection = Depends(owned_inspection),
    r: Repository = Depends(repo),
    provider: VisionProvider = Depends(vision),
    settings: Settings = Depends(get_settings),
) -> AnalysisResult:
    try:
        comp = catalog.get(body.component_id)
    except KeyError as exc:
        raise HTTPException(422, str(exc)) from exc
    if comp.per_position != (body.position is not None):
        raise HTTPException(
            422,
            "position é obrigatório para pneus e proibido nos demais itens",
        )

    existing = await r.list_findings(insp.id)
    if len(existing) >= settings.max_analyses_per_inspection:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Limite de análises desta vistoria")

    nxt = catalog.next_slot(comp.id, body.position)
    next_label = catalog.slot_label(*nxt) if nxt else None
    next_guidance = (
        f"Prossiga para: {next_label}." if next_label else "Vistoria concluída. Veja o relatório."
    )

    async def store(result: AnalysisResult, source: str, model: str | None = None) -> AnalysisResult:
        await r.add_finding(
            StoredFinding(
                inspection_id=insp.id,
                position=body.position,
                result=result,
                source=source,
                model=model,
                created_at=datetime.now(timezone.utc),
            )
        )
        return result

    # ── Pneu (DOT): regra determinística a partir do OCR do aparelho ────────
    if comp.ocr_only:
        result = rules.evaluate_dot(comp, body.ocr_text or "", date.today(), next_guidance)
        if result:
            return await store(result, "ocr_rule")
        return await store(
            guardrails.inconclusive(
                comp,
                "Não foi possível ler os 4 dígitos do código DOT.",
                "Limpe a lateral do pneu, ilumine de lado e fotografe de novo — "
                "ou digite os 4 dígitos manualmente.",
            ),
            "quality_gate",
        )

    # ── Imagem + portão de qualidade ───────────────────────────────────────
    try:
        data = await _load_image(body, settings, request.app.state.http)
    except (image_quality.InvalidImage, httpx.HTTPError) as exc:
        raise HTTPException(422, f"Imagem inválida: {exc}") from exc
    if data is None:
        raise HTTPException(422, "Envie a foto deste item")
    try:
        q = image_quality.assess(data)
    except image_quality.InvalidImage as exc:
        raise HTTPException(422, str(exc)) from exc
    if not q.ok:
        return await store(
            guardrails.inconclusive(
                comp,
                f"Foto recusada antes da análise: {q.reason}.",
                f"Refaça a foto. {image_quality.RETAKE_TIPS.get(q.reason or '', '')}".strip(),
            ),
            "quality_gate",
        )

    slot = comp.id + (f"-{body.position}" if body.position else "")
    try:
        await r.save_photo(insp.id, slot, data, settings.photo_ttl_days)
    except Exception:  # noqa: BLE001 — foto é evidência, não bloqueia a análise
        log.exception("falha ao guardar foto %s", slot)

    # ── Visão multimodal + travas ──────────────────────────────────────────
    retake = f"Refaça a foto enquadrando: {comp.framing}"
    try:
        raw = await provider.analyze(
            VisionInput(
                component_id=comp.id,
                prompt=user_prompt(comp, body.position, insp.vehicle, next_label, body.ocr_text),
                image_base64=base64.b64encode(data).decode(),
            )
        )
    except VisionError:
        log.exception("visão falhou em %s", comp.id)
        return await store(
            guardrails.inconclusive(
                comp, "A análise automática não respondeu no formato esperado.", retake
            ),
            "fallback",
        )

    result = guardrails.enforce(raw, comp, retake_guidance=retake, next_guidance=next_guidance)

    if comp.id == "odometer" and result.status is not Status.INCONCLUSIVE:
        mismatch = rules.odometer_mismatch(insp.vehicle.km, body.ocr_text)
        if mismatch:
            band = comp.costs["RED"]
            result = result.model_copy(
                update={
                    "status": Status.RED,
                    "visual_findings": f"{mismatch} {result.visual_findings}"[:600],
                    "risk_assessment": (
                        "Divergência entre o painel e o anúncio. Peça explicação ao "
                        "vendedor e confira o histórico de revisões e o laudo cautelar."
                    ),
                    "is_negotiation_lever": True,
                    "estimated_cost_min": band.min,
                    "estimated_cost_max": band.max,
                }
            )

    return await store(result, "vision", f"{provider.name}:{provider.model}")


@app.get("/v1/inspections/{inspection_id}/report", response_model=Report)
async def report(
    insp: Inspection = Depends(owned_inspection),
    r: Repository = Depends(repo),
) -> Report:
    findings = await r.list_findings(insp.id)
    done = {(f.result.component_id, f.position) for f in findings
            if f.result.status is not Status.INCONCLUSIVE}
    missing = [
        catalog.slot_label(catalog.BY_ID[cid], pos)
        for cid, pos in catalog.required_slots()
        if (cid, pos) not in done
    ]
    return Report(
        inspection=insp,
        findings=findings,
        missing_components=missing,
        negotiation=negotiation.summarize(findings, insp.vehicle.asking_price),
        legal_notice=REPORT_NOTICE,
    )


@app.post("/internal/purge-photos")
async def purge_photos(
    x_cron_secret: str | None = Header(default=None),
    r: Repository = Depends(repo),
    settings: Settings = Depends(get_settings),
) -> dict:
    if not settings.cron_secret or not x_cron_secret or not secrets.compare_digest(
        x_cron_secret, settings.cron_secret
    ):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Proibido")
    total = 0
    while (n := await r.purge_expired_photos(datetime.now(timezone.utc))) > 0:
        total += n
    return {"deleted": total}
