from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    vision_provider: str
    gemini_api_key: str | None
    gemini_model: str
    openai_api_key: str | None
    openai_model: str
    supabase_url: str | None
    supabase_service_key: str | None
    photos_bucket: str
    photo_ttl_days: int
    auth_disabled: bool
    cron_secret: str | None
    max_analyses_per_inspection: int

    @property
    def use_supabase(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)


@lru_cache
def get_settings() -> Settings:
    return Settings(
        vision_provider=os.getenv("VISION_PROVIDER", "mock").lower(),
        gemini_api_key=os.getenv("GEMINI_API_KEY"),
        # Família Flash: rápida e barata. Ajuste para a versão disponível.
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_service_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        photos_bucket=os.getenv("PHOTOS_BUCKET", "inspection-photos"),
        photo_ttl_days=int(os.getenv("PHOTO_TTL_DAYS", "60")),
        auth_disabled=_bool("AUTH_DISABLED"),
        cron_secret=os.getenv("CRON_SECRET"),
        max_analyses_per_inspection=int(os.getenv("MAX_ANALYSES_PER_INSPECTION", "60")),
    )
