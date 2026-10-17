"""Persistência: Supabase (PostgREST + Storage) ou memória (dev/testes)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Protocol
from uuid import UUID

import httpx

from .schemas import CreateInspection, Inspection, StoredFinding, Vehicle


class Repository(Protocol):
    async def create_inspection(self, user_id: str, data: CreateInspection) -> Inspection: ...
    async def get_inspection(self, inspection_id: UUID, user_id: str) -> Inspection | None: ...
    async def add_finding(self, finding: StoredFinding) -> None: ...
    async def list_findings(self, inspection_id: UUID) -> list[StoredFinding]: ...
    async def save_photo(
        self, inspection_id: UUID, slot: str, data: bytes, ttl_days: int
    ) -> str | None: ...
    async def purge_expired_photos(self, now: datetime) -> int: ...


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MemoryRepository:
    def __init__(self) -> None:
        self.inspections: dict[UUID, Inspection] = {}
        self.findings: list[StoredFinding] = []
        self.photos: dict[str, tuple[bytes, datetime]] = {}

    async def create_inspection(self, user_id: str, data: CreateInspection) -> Inspection:
        insp = Inspection(
            id=uuid.uuid4(),
            user_id=user_id,
            vehicle=data.vehicle,
            terms_version=data.terms_version,
            created_at=_now(),
        )
        self.inspections[insp.id] = insp
        return insp

    async def get_inspection(self, inspection_id: UUID, user_id: str) -> Inspection | None:
        insp = self.inspections.get(inspection_id)
        return insp if insp and insp.user_id == user_id else None

    async def add_finding(self, finding: StoredFinding) -> None:
        self.findings.append(finding)

    async def list_findings(self, inspection_id: UUID) -> list[StoredFinding]:
        return [f for f in self.findings if f.inspection_id == inspection_id]

    async def save_photo(self, inspection_id: UUID, slot: str, data: bytes, ttl_days: int) -> str:
        path = f"{inspection_id}/{slot}-{uuid.uuid4().hex[:8]}.jpg"
        self.photos[path] = (data, _now() + timedelta(days=ttl_days))
        return path

    async def purge_expired_photos(self, now: datetime) -> int:
        expired = [p for p, (_, exp) in self.photos.items() if exp <= now]
        for p in expired:
            del self.photos[p]
        return len(expired)


class SupabaseRepository:
    """Usa a service role no servidor; o app nunca vê essa chave.

    Toda consulta filtra por `user_id` explicitamente (a service role ignora
    RLS, então o isolamento entre usuários é feito aqui).
    """

    def __init__(self, url: str, service_key: str, bucket: str, client: httpx.AsyncClient):
        self.base = url.rstrip("/")
        self.bucket = bucket
        self.client = client
        self.h = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    async def _rest(self, method: str, path: str, **kw) -> httpx.Response:
        r = await self.client.request(
            method, f"{self.base}/rest/v1/{path}", headers={**self.h, **kw.pop("headers", {})}, **kw
        )
        r.raise_for_status()
        return r

    async def create_inspection(self, user_id: str, data: CreateInspection) -> Inspection:
        row = {
            "user_id": user_id,
            "vehicle": data.vehicle.model_dump(),
            "terms_version": data.terms_version,
            "terms_accepted_at": data.terms_accepted_at.isoformat(),
        }
        r = await self._rest(
            "POST", "inspections", json=row, headers={"Prefer": "return=representation"}
        )
        return self._inspection(r.json()[0])

    async def get_inspection(self, inspection_id: UUID, user_id: str) -> Inspection | None:
        r = await self._rest(
            "GET",
            "inspections",
            params={"id": f"eq.{inspection_id}", "user_id": f"eq.{user_id}", "select": "*"},
        )
        rows = r.json()
        return self._inspection(rows[0]) if rows else None

    async def add_finding(self, finding: StoredFinding) -> None:
        res = finding.result
        await self._rest(
            "POST",
            "findings",
            json={
                "inspection_id": str(finding.inspection_id),
                "component_id": res.component_id,
                "position": finding.position,
                "status": res.status.value,
                "confidence_score": res.confidence_score,
                "result": res.model_dump(mode="json"),
                "source": finding.source,
                "model": finding.model,
            },
            headers={"Prefer": "return=minimal"},
        )

    async def list_findings(self, inspection_id: UUID) -> list[StoredFinding]:
        r = await self._rest(
            "GET",
            "findings",
            params={"inspection_id": f"eq.{inspection_id}", "select": "*", "order": "created_at"},
        )
        return [
            StoredFinding(
                inspection_id=row["inspection_id"],
                position=row["position"],
                result=row["result"],
                source=row["source"],
                model=row.get("model"),
                created_at=row["created_at"],
            )
            for row in r.json()
        ]

    async def save_photo(self, inspection_id: UUID, slot: str, data: bytes, ttl_days: int) -> str:
        path = f"{inspection_id}/{slot}-{uuid.uuid4().hex[:8]}.jpg"
        r = await self.client.post(
            f"{self.base}/storage/v1/object/{self.bucket}/{path}",
            content=data,
            headers={**self.h, "Content-Type": "image/jpeg", "x-upsert": "false"},
        )
        r.raise_for_status()
        await self._rest(
            "POST",
            "photos",
            json={
                "inspection_id": str(inspection_id),
                "path": path,
                "expires_at": (_now() + timedelta(days=ttl_days)).isoformat(),
            },
            headers={"Prefer": "return=minimal"},
        )
        return path

    async def purge_expired_photos(self, now: datetime) -> int:
        r = await self._rest(
            "GET",
            "photos",
            params={"expires_at": f"lte.{now.isoformat()}", "select": "path", "limit": "500"},
        )
        paths = [row["path"] for row in r.json()]
        if not paths:
            return 0
        # Storage API (apagar direto em storage.objects deixaria o arquivo órfão).
        d = await self.client.request(
            "DELETE",
            f"{self.base}/storage/v1/object/{self.bucket}",
            json={"prefixes": paths},
            headers=self.h,
        )
        d.raise_for_status()
        in_list = ",".join(f'"{p}"' for p in paths)
        await self._rest("DELETE", "photos", params={"path": f"in.({in_list})"})
        return len(paths)

    @staticmethod
    def _inspection(row: dict) -> Inspection:
        return Inspection(
            id=row["id"],
            user_id=row["user_id"],
            vehicle=Vehicle.model_validate(row["vehicle"]),
            terms_version=row["terms_version"],
            created_at=row["created_at"],
        )
