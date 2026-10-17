"""Catálogo de componentes inspecionados.

Cada item define o que a foto deve mostrar, o que o modelo deve procurar e a
faixa de custo (R$) aceita para cada status. O modelo pode sugerir valores,
mas o servidor sempre limita à faixa do catálogo: o número que o usuário leva
para a negociação vem de uma tabela revisável, não da imaginação do modelo.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class CostRange:
    min: int
    max: int


@dataclass(frozen=True)
class Component:
    id: str
    module: str
    label: str
    framing: str  # o que precisa aparecer na foto
    look_for: str  # instruções específicas para o modelo
    costs: dict[str, CostRange] = field(default_factory=dict)  # por status
    per_position: bool = False  # pneus: uma foto por roda
    structural: bool = False  # achado vermelho → recomendar laudo cautelar
    ocr_only: bool = False  # resolvido por regra local, sem visão


MODULES: dict[str, str] = {
    "engine_cold": "Motor a frio",
    "front_structure": "Estrutura frontal",
    "tires": "Pneus & rodagem",
    "body": "Vãos e lataria",
    "cabin": "Autenticidade da cabine",
}

_C = CostRange

COMPONENTS: list[Component] = [
    # ── Módulo 1: motor a frio ──────────────────────────────────────────────
    Component(
        id="engine_oil_cap",
        module="engine_cold",
        label="Tampa de óleo (lado interno)",
        framing="Face interna da tampa de abastecimento de óleo, com o motor frio.",
        look_for=(
            "Borra preta endurecida (manutenção atrasada); emulsão pastosa clara/"
            "bege tipo 'maionese' (possível mistura de líquido de arrefecimento "
            "no óleo — indício de junta do cabeçote); película fina escura é normal."
        ),
        costs={"YELLOW": _C(300, 900), "RED": _C(2500, 7000)},
    ),
    Component(
        id="coolant_reservoir",
        module="engine_cold",
        label="Reservatório de arrefecimento",
        framing="Reservatório de expansão inteiro, com nível e marcas MIN/MAX visíveis.",
        look_for=(
            "Nível abaixo do MIN; líquido marrom/ferrugem; película oleosa ou "
            "manchas escuras na superfície (óleo no arrefecimento); água pura "
            "transparente sem aditivo; resíduos cristalizados na tampa."
        ),
        costs={"YELLOW": _C(150, 600), "RED": _C(2500, 7000)},
    ),
    # ── Módulo 2: estrutura frontal ─────────────────────────────────────────
    Component(
        id="fender_bolts_left",
        module="front_structure",
        label="Parafusos do para-lama (esquerdo)",
        framing="Parafusos de fixação do para-lama esquerdo, sob o capô aberto.",
        look_for=(
            "Marcas de chave na tinta da cabeça do parafuso, tinta descascada ou "
            "parafuso de cor diferente dos demais — sinais de que a peça foi "
            "removida (reparo de colisão ou troca)."
        ),
        costs={"YELLOW": _C(500, 1500), "RED": _C(1500, 4000)},
    ),
    Component(
        id="fender_bolts_right",
        module="front_structure",
        label="Parafusos do para-lama (direito)",
        framing="Parafusos de fixação do para-lama direito, sob o capô aberto.",
        look_for=(
            "Marcas de chave na tinta da cabeça do parafuso, tinta descascada ou "
            "parafuso de cor diferente dos demais."
        ),
        costs={"YELLOW": _C(500, 1500), "RED": _C(1500, 4000)},
    ),
    Component(
        id="strut_towers",
        module="front_structure",
        label="Torres dos amortecedores",
        framing="Torres (copos) dos amortecedores dianteiros, vistas de cima.",
        look_for=(
            "Ondulações, dobras, pontos de solda irregulares, massa plástica, "
            "selador de fábrica ausente ou refeito, assimetria entre os lados."
        ),
        costs={"YELLOW": _C(1500, 5000), "RED": _C(5000, 15000)},
        structural=True,
    ),
    Component(
        id="front_rails",
        module="front_structure",
        label="Longarinas visíveis",
        framing="Ponta das longarinas dianteiras, atrás do para-choque/radiador.",
        look_for=(
            "Amassados, dobras, marcas de repuxo (esticador), soldas fora do padrão "
            "de fábrica, ferrugem localizada em emendas, tinta diferente."
        ),
        costs={"YELLOW": _C(2000, 6000), "RED": _C(6000, 20000)},
        structural=True,
    ),
    # ── Módulo 3: pneus ─────────────────────────────────────────────────────
    Component(
        id="tire_dot",
        module="tires",
        label="Código DOT do pneu",
        framing="Os 4 últimos dígitos do código DOT na lateral do pneu (semana/ano).",
        look_for="Lido por OCR no aparelho; regra de idade aplicada no servidor.",
        costs={"YELLOW": _C(350, 900), "RED": _C(350, 900)},
        per_position=True,
        ocr_only=True,
    ),
    Component(
        id="tire_tread",
        module="tires",
        label="Banda de rodagem e TWI",
        framing="Banda de rodagem com um indicador TWI (ressalto no fundo do sulco) visível.",
        look_for=(
            "Sulco no nível do TWI (limite legal 1,6 mm); desgaste irregular — "
            "só nas bordas (calibragem baixa), só de um lado (alinhamento/"
            "geometria, possível sequela de colisão), em escamas (suspensão); "
            "bolhas ou cortes laterais."
        ),
        costs={"YELLOW": _C(150, 400), "RED": _C(350, 900)},
        per_position=True,
    ),
    # ── Módulo 4: vãos e lataria ────────────────────────────────────────────
    Component(
        id="hood_gap_left",
        module="body",
        label="Fresta capô × para-lama (esquerdo)",
        framing="Linha entre capô e para-lama esquerdo, de frente, em ângulo baixo.",
        look_for=(
            "Fresta mais larga ou mais estreita que o normal, variação ao longo da "
            "linha, desnível de altura entre as peças."
        ),
        costs={"YELLOW": _C(300, 1200), "RED": _C(1200, 3000)},
    ),
    Component(
        id="hood_gap_right",
        module="body",
        label="Fresta capô × para-lama (direito)",
        framing="Linha entre capô e para-lama direito, de frente, em ângulo baixo.",
        look_for=(
            "Fresta mais larga ou mais estreita que o normal, variação ao longo da "
            "linha, desnível de altura entre as peças."
        ),
        costs={"YELLOW": _C(300, 1200), "RED": _C(1200, 3000)},
    ),
    Component(
        id="paint_reflection",
        module="body",
        label="Pintura sob luz refletida",
        framing="Painel lateral fotografado em ângulo rasante, com reflexo de uma linha reta.",
        look_for=(
            "Reflexo ondulado (massa), casca de laranja diferente entre painéis, "
            "diferença de tom, poeira presa no verniz, névoa de pintura em borrachas."
        ),
        costs={"YELLOW": _C(600, 1500), "RED": _C(1500, 4000)},
    ),
    # ── Módulo 5: cabine ────────────────────────────────────────────────────
    Component(
        id="pedals",
        module="cabin",
        label="Pedaleiras",
        framing="Borrachas dos pedais de freio e embreagem/acelerador, de frente.",
        look_for=(
            "Desgaste da borracha (bordas lisas, metal aparente) ou borracha nova "
            "demais; comparar com a quilometragem declarada."
        ),
        costs={"YELLOW": _C(1000, 3000), "RED": _C(3000, 8000)},
    ),
    Component(
        id="steering_wheel",
        module="cabin",
        label="Aro do volante",
        framing="Aro do volante inteiro, com as posições 9h e 3h visíveis.",
        look_for=(
            "Brilho/descascado nas posições de pega, couro rachado, capa nova "
            "cobrindo o aro; comparar com a quilometragem declarada."
        ),
        costs={"YELLOW": _C(1000, 3000), "RED": _C(3000, 8000)},
    ),
    Component(
        id="odometer",
        module="cabin",
        label="Hodômetro",
        framing="Painel de instrumentos ligado, com a quilometragem total legível.",
        look_for=(
            "Dígitos desalinhados (analógico), luz de anomalia acesa, valor diferente "
            "do anunciado; coerência com o desgaste de pedais e volante."
        ),
        costs={"YELLOW": _C(1000, 3000), "RED": _C(3000, 8000)},
    ),
]

BY_ID: dict[str, Component] = {c.id: c for c in COMPONENTS}
TIRE_POSITIONS = ("FL", "FR", "RL", "RR")


def get(component_id: str) -> Component:
    try:
        return BY_ID[component_id]
    except KeyError as exc:
        raise KeyError(f"Componente desconhecido: {component_id}") from exc


def required_slots() -> list[tuple[str, str | None]]:
    """Todas as fotos esperadas numa vistoria completa (componente, posição)."""
    slots: list[tuple[str, str | None]] = []
    for c in COMPONENTS:
        if c.per_position:
            slots.extend((c.id, p) for p in TIRE_POSITIONS)
        else:
            slots.append((c.id, None))
    return slots


def next_slot(component_id: str, position: str | None) -> tuple[Component, str | None] | None:
    slots = required_slots()
    try:
        i = slots.index((component_id, position))
    except ValueError:
        return None
    if i + 1 >= len(slots):
        return None
    cid, pos = slots[i + 1]
    return BY_ID[cid], pos


POSITION_LABEL = {
    "FL": "dianteiro esquerdo",
    "FR": "dianteiro direito",
    "RL": "traseiro esquerdo",
    "RR": "traseiro direito",
}


def slot_label(component: Component, position: str | None) -> str:
    if position:
        return f"{component.label} — {POSITION_LABEL[position]}"
    return component.label
