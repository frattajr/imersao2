import base64
import io
import os
import random
from datetime import date

os.environ["AUTH_DISABLED"] = "true"
os.environ["VISION_PROVIDER"] = "mock"
os.environ["CRON_SECRET"] = "s3cret"

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app import catalog, guardrails, negotiation, rules
from app.main import app
from app.prompts import TERMS_VERSION
from app.repository import MemoryRepository
from app.schemas import AnalysisResult, Status
from app.vision import MockProvider, VisionError, parse_result


def sharp_jpeg(size=(800, 600), brightness=128) -> str:
    img = Image.new("L", size, brightness)
    d = ImageDraw.Draw(img)
    rnd = random.Random(1)
    for _ in range(400):
        x, y = rnd.randrange(size[0]), rnd.randrange(size[1])
        d.rectangle([x, y, x + 6, y + 6], fill=rnd.choice([0, 255]))
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode()


def flat_jpeg(brightness=128) -> str:
    buf = io.BytesIO()
    Image.new("RGB", (800, 600), (brightness,) * 3).save(buf, "JPEG")
    return base64.b64encode(buf.getvalue()).decode()


VEHICLE = {"make": "VW", "model": "Gol 1.6", "year": 2018, "km": 62000, "asking_price": 52000}


@pytest.fixture
def client():
    app.state.repo = MemoryRepository()
    app.state.vision = MockProvider(
        {
            "engine_oil_cap": {
                "status": "RED",
                "confidence_score": 0.9,
                "visual_findings": "Emulsão bege na tampa. O motor está queimado.",
                "risk_assessment": "Com certeza a junta do cabeçote foi.",
                "estimated_cost_min": 100,
                "estimated_cost_max": 99999,
                "legal_disclaimer": "nada",
            },
            "coolant_reservoir": {"status": "GREEN", "confidence_score": 0.6},
            "strut_towers": {"status": "RED", "confidence_score": 0.8,
                             "estimated_cost_min": 6000, "estimated_cost_max": 9000},
        }
    )
    with TestClient(app) as c:
        yield c


def new_inspection(c) -> str:
    r = c.post(
        "/v1/inspections",
        json={"vehicle": VEHICLE, "terms_version": TERMS_VERSION,
              "terms_accepted_at": "2026-10-17T12:00:00Z"},
    )
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_requires_current_terms(client):
    r = client.post(
        "/v1/inspections",
        json={"vehicle": VEHICLE, "terms_version": "old", "terms_accepted_at": "2026-10-17T12:00:00Z"},
    )
    assert r.status_code == 409


def test_red_finding_is_clamped_and_softened(client):
    iid = new_inspection(client)
    r = client.post(f"/v1/inspections/{iid}/analyses",
                    json={"component_id": "engine_oil_cap", "image_base64": sharp_jpeg()})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "RED"
    band = catalog.BY_ID["engine_oil_cap"].costs["RED"]
    assert band.min <= body["estimated_cost_min"] <= body["estimated_cost_max"] <= band.max
    assert body["is_negotiation_lever"] is True
    assert "queimado" not in body["visual_findings"]
    assert "certeza" not in body["risk_assessment"].lower()
    assert "Não afere viscosidade" in body["legal_disclaimer"]
    assert "Reservatório de arrefecimento" in body["user_guidance_next_step"]


def test_low_confidence_green_becomes_inconclusive(client):
    iid = new_inspection(client)
    body = client.post(f"/v1/inspections/{iid}/analyses",
                       json={"component_id": "coolant_reservoir", "image_base64": sharp_jpeg()}).json()
    assert body["status"] == "INCONCLUSIVE"
    assert body["estimated_cost_max"] == 0


def test_blurry_photo_never_reaches_model(client):
    iid = new_inspection(client)
    body = client.post(f"/v1/inspections/{iid}/analyses",
                       json={"component_id": "pedals", "image_base64": flat_jpeg()}).json()
    assert body["status"] == "INCONCLUSIVE"
    assert app.state.vision.calls == []


def test_dark_photo_rejected(client):
    iid = new_inspection(client)
    body = client.post(f"/v1/inspections/{iid}/analyses",
                       json={"component_id": "pedals", "image_base64": sharp_jpeg(brightness=10)}).json()
    assert body["status"] == "INCONCLUSIVE"
    assert "escura" in body["visual_findings"]


def test_tire_dot_rule_without_model(client):
    iid = new_inspection(client)
    yy = (date.today().year - 8) % 100
    r = client.post(f"/v1/inspections/{iid}/analyses",
                    json={"component_id": "tire_dot", "position": "FL", "ocr_text": f"DOT XY 12{yy:02d}"})
    assert r.json()["status"] == "RED"
    assert app.state.vision.calls == []
    r = client.post(f"/v1/inspections/{iid}/analyses",
                    json={"component_id": "tire_dot", "ocr_text": "1220"})
    assert r.status_code == 422  # posição obrigatória


def test_report_with_negotiation_and_structural_flag(client):
    iid = new_inspection(client)
    for cid in ("engine_oil_cap", "strut_towers"):
        client.post(f"/v1/inspections/{iid}/analyses", json={"component_id": cid, "image_base64": sharp_jpeg()})
    rep = client.get(f"/v1/inspections/{iid}/report").json()
    neg = rep["negotiation"]
    assert len(neg["levers"]) == 2
    assert neg["recommend_professional_inspection"] is True
    assert neg["suggested_offer"] >= 52000 * 0.75
    assert neg["suggested_offer"] % 500 == 0
    assert neg["suggested_offer"] <= neg["walk_away_price"] <= 52000
    assert "não constituem laudo" in rep["legal_notice"]
    assert len(rep["missing_components"]) == len(catalog.required_slots()) - 2


def test_other_users_cannot_read(client):
    iid = new_inspection(client)
    app.state.repo.inspections[next(iter(app.state.repo.inspections))].__dict__["user_id"] = "x"
    assert client.get(f"/v1/inspections/{iid}").status_code == 404


def test_purge_requires_secret(client):
    assert client.post("/internal/purge-photos").status_code == 403
    assert client.post("/internal/purge-photos", headers={"X-Cron-Secret": "s3cret"}).json() == {"deleted": 0}


# ── unidades ─────────────────────────────────────────────────────────────────

def test_parse_result_rejects_garbage():
    with pytest.raises(VisionError):
        parse_result("não sei", "pedals")
    with pytest.raises(VisionError):
        parse_result('{"status": "MAYBE"}', "pedals")


def test_parse_result_normalizes_percent_confidence():
    r = parse_result(
        '```json\n{"status":"GREEN","confidence_score":88,"visual_findings":"a","risk_assessment":"b",'
        '"is_negotiation_lever":false,"estimated_cost_min":0,"estimated_cost_max":0,'
        '"legal_disclaimer":"","user_guidance_next_step":""}\n```',
        "pedals",
    )
    assert r.confidence_score == 0.88 and r.component_id == "pedals"


def test_soften():
    assert "indícios" in guardrails.soften("O carro foi batido.")
    assert "garant" not in guardrails.soften("Pintura original garantida").lower()


def test_parse_dot():
    today = date(2026, 10, 17)
    assert rules.parse_dot("DOT 4B 7H 3521", today) == (35, 2021)
    assert rules.parse_dot("DOT 5027", today) is None  # ano futuro
    assert rules.parse_dot("semana 53/26", today) is None


def test_odometer_mismatch():
    assert rules.odometer_mismatch(62000, "062.150 km") is None
    assert "112.400" in rules.odometer_mismatch(62000, "112400")


def test_tires_count_once_per_wheel():
    from datetime import datetime, timezone
    from uuid import uuid4

    from app.schemas import StoredFinding

    iid = uuid4()

    def f(cid, st, lo, hi):
        return StoredFinding(
            inspection_id=iid, position="FL", source="vision", created_at=datetime.now(timezone.utc),
            result=AnalysisResult(component_id=cid, status=st, confidence_score=0.9, visual_findings="x",
                                  risk_assessment="y", is_negotiation_lever=True, estimated_cost_min=lo,
                                  estimated_cost_max=hi, legal_disclaimer="", user_guidance_next_step=""),
        )

    s = negotiation.summarize([f("tire_dot", Status.RED, 350, 900), f("tire_tread", Status.YELLOW, 150, 400)], 40000)
    assert len(s.levers) == 1 and s.levers[0].component_id == "tire_dot"
