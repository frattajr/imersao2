"""Portão de qualidade no servidor (rede de segurança do filtro do aparelho).

Mesma métrica usada no app (variância do Laplaciano numa miniatura em tons de
cinza + brilho médio). Se a foto não passa, devolvemos INCONCLUSIVE sem chamar
o modelo de visão — cada foto ruim barrada aqui é uma chamada paga a menos.
"""

from __future__ import annotations

import base64
import binascii
import io
from dataclasses import dataclass

from PIL import Image, ImageOps

THUMB = 128
MIN_SHARPNESS = 60.0  # variância do Laplaciano (0–255²) na miniatura 128px
MIN_BRIGHTNESS = 45.0  # média de luminância 0–255
MAX_BRIGHTNESS = 235.0
MIN_SIDE = 480  # px; menor que isso o modelo não enxerga detalhe
MAX_BYTES = 6 * 1024 * 1024


@dataclass(frozen=True)
class Quality:
    ok: bool
    sharpness: float
    brightness: float
    reason: str | None = None


class InvalidImage(ValueError):
    pass


def decode(b64: str) -> bytes:
    if b64.startswith("data:"):
        b64 = b64.split(",", 1)[-1]
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise InvalidImage("base64 inválido") from exc
    if len(data) > MAX_BYTES:
        raise InvalidImage("imagem maior que 6 MB")
    return data


def laplacian_variance(gray: list[int], w: int, h: int) -> float:
    """Variância do Laplaciano 4-vizinhos. Igual a `mobile/src/quality.ts`."""
    vals: list[float] = []
    for y in range(1, h - 1):
        row = y * w
        for x in range(1, w - 1):
            i = row + x
            vals.append(
                gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i]
            )
    if not vals:
        return 0.0
    mean = sum(vals) / len(vals)
    return sum((v - mean) ** 2 for v in vals) / len(vals)


def assess(data: bytes) -> Quality:
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        img.load()
    except Exception as exc:  # noqa: BLE001 — qualquer falha de decodificação
        raise InvalidImage("arquivo não é uma imagem válida") from exc

    if min(img.size) < MIN_SIDE:
        return Quality(False, 0.0, 0.0, "resolução baixa")

    gray = img.convert("L")
    gray.thumbnail((THUMB, THUMB))
    w, h = gray.size
    px = list(gray.tobytes())
    brightness = sum(px) / len(px)
    sharpness = laplacian_variance(px, w, h)

    if brightness < MIN_BRIGHTNESS:
        return Quality(False, sharpness, brightness, "foto escura")
    if brightness > MAX_BRIGHTNESS:
        return Quality(False, sharpness, brightness, "foto estourada (luz demais)")
    if sharpness < MIN_SHARPNESS:
        return Quality(False, sharpness, brightness, "foto tremida ou fora de foco")
    return Quality(True, sharpness, brightness)


RETAKE_TIPS = {
    "resolução baixa": "Use a câmera traseira e aproxime-se do componente.",
    "foto escura": "Acenda a lanterna do celular ou procure luz natural.",
    "foto estourada (luz demais)": "Evite sol direto ou o flash refletindo; mude o ângulo.",
    "foto tremida ou fora de foco": "Apoie o celular, toque na tela para focar e aguarde 1 s.",
}
