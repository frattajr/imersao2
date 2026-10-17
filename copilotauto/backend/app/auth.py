"""Autenticação via Supabase Auth.

O app manda o access token da sessão Supabase em `Authorization: Bearer`.
Validamos perguntando ao próprio Supabase (`/auth/v1/user`), o que funciona
com chaves JWT simétricas e assimétricas. Resultado em cache por 5 minutos.
"""

from __future__ import annotations

import time

import httpx
from fastapi import Depends, Header, HTTPException, Request, status

from .config import Settings, get_settings

_CACHE: dict[str, tuple[str, float]] = {}
_TTL = 300.0
DEV_USER = "00000000-0000-0000-0000-000000000000"


async def current_user(
    request: Request,
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> str:
    if settings.auth_disabled:
        return DEV_USER
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token ausente")
    token = authorization.split(" ", 1)[1].strip()

    hit = _CACHE.get(token)
    if hit and hit[1] > time.monotonic():
        return hit[0]

    if not settings.use_supabase:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Supabase não configurado")
    client: httpx.AsyncClient = request.app.state.http
    try:
        r = await client.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={"apikey": settings.supabase_service_key, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Auth indisponível") from exc
    if r.status_code != 200:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    user_id = r.json()["id"]
    if len(_CACHE) > 10_000:
        _CACHE.clear()
    _CACHE[token] = (user_id, time.monotonic() + _TTL)
    return user_id
