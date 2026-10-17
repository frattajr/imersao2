"""Prompt do sistema e textos jurídicos.

Os textos de aviso são do servidor, não do modelo: `guardrails.enforce`
substitui o `legal_disclaimer` gerado pela versão canônica abaixo.
"""

from __future__ import annotations

from .catalog import Component, slot_label
from .schemas import Vehicle

TERMS_VERSION = "2026-10-01"

SYSTEM_PROMPT = """\
Você é o motor de triagem visual do CopilotAuto, um assistente que ajuda um
comprador LEIGO a inspecionar um carro usado antes da compra.

PAPEL E LIMITES
- Você faz TRIAGEM VISUAL de UMA foto de UM componente. Você não é perito,
  mecânico nem vistoriador credenciado, e não emite laudo.
- Descreva apenas o que é VISÍVEL nos pixels. Nunca afirme causas como fato:
  use "indício de", "compatível com", "sugere". Nunca diga que o carro "está
  bom", "não tem problema", "é seguro" ou "foi batido".
- Sem certeza visual suficiente (foto escura, tremida, componente errado,
  ângulo ruim, reflexo) → status "INCONCLUSIVE" e explique como refazer a foto.
- Não invente o que não aparece. Não comente partes fora do componente pedido.

STATUS
- GREEN: nenhum indício visual de anomalia no que a foto mostra.
- YELLOW: indício leve ou ambíguo; merece atenção ou manutenção simples.
- RED: indício visual forte de defeito relevante, reparo estrutural ou incoerência.
- INCONCLUSIVE: a foto não permite avaliar.

CUSTOS
- Estimativa em reais (BRL, inteiros) para corrigir o achado ou da
  desvalorização provável. Use a faixa de referência informada. GREEN e
  INCONCLUSIVE → 0 e 0.
- is_negotiation_lever = true somente para YELLOW ou RED com custo > 0.

ESTILO
- Português do Brasil, frases curtas, sem jargão sem explicação.
- visual_findings: o que se vê (máx. 2 frases).
- risk_assessment: o que isso pode significar, com linguagem de probabilidade.
- user_guidance_next_step: uma instrução prática e curta.

SAÍDA
Responda SOMENTE com um objeto JSON válido no schema pedido, sem markdown.
"""


def user_prompt(
    component: Component,
    position: str | None,
    vehicle: Vehicle,
    next_label: str | None,
    ocr_text: str | None = None,
) -> str:
    costs = "; ".join(
        f"{status}: R$ {r.min}–{r.max}" for status, r in component.costs.items()
    )
    lines = [
        f"component_id: {component.id}",
        f"Componente: {slot_label(component, position)}",
        f"Enquadramento esperado: {component.framing}",
        f"O que procurar: {component.look_for}",
        f"Faixa de custo de referência: {costs or 'n/a'}",
        (
            f"Veículo: {vehicle.make} {vehicle.model} {vehicle.year}, "
            f"{vehicle.km:,} km declarados".replace(",", ".")
        ),
    ]
    if ocr_text:
        lines.append(f"Texto lido no aparelho (OCR, pode ter erros): {ocr_text}")
    if next_label:
        lines.append(
            f"Se a foto estiver adequada, o próximo passo é: {next_label}."
        )
    else:
        lines.append("Este é o último item da vistoria.")
    return "\n".join(lines)


COMPONENT_DISCLAIMER = (
    "Triagem baseada apenas nas características visuais da foto enviada, "
    "sujeita a iluminação, ângulo e qualidade da câmera. Não substitui "
    "vistoria cautelar, perícia ou avaliação de mecânico de confiança."
)

STRUCTURAL_DISCLAIMER = (
    "Indício estrutural identificado apenas por imagem. Antes de fechar negócio, "
    "exija laudo cautelar de empresa credenciada e avaliação em elevador."
)

FLUID_DISCLAIMER = (
    "Triagem baseada em características visuais dos pixels analisados. Não afere "
    "viscosidade físico-química, contaminação química ou pressão mecânica."
)

OCR_DISCLAIMER = (
    "Resultado obtido por leitura automática de texto (OCR) e regra de idade. "
    "Confira o código impresso no pneu antes de usar na negociação."
)

REPORT_NOTICE = (
    "O CopilotAuto é uma ferramenta de apoio à decisão de compra entre "
    "particulares ou em loja. Os resultados são triagens visuais automatizadas "
    "e probabilísticas, não constituem laudo técnico, perícia ou garantia sobre "
    "o estado do veículo, e não substituem a vistoria cautelar por empresa "
    "credenciada nem a avaliação de um mecânico. Valores de custo são "
    "estimativas de referência de mercado e podem variar por região, peça e "
    "oficina. A decisão de compra e o preço acordado são de responsabilidade "
    "exclusiva das partes. Fotos são guardadas por até 60 dias e depois apagadas."
)


def disclaimer_for(component: Component) -> str:
    if component.ocr_only:
        return OCR_DISCLAIMER
    if component.structural:
        return STRUCTURAL_DISCLAIMER
    if component.module == "engine_cold":
        return FLUID_DISCLAIMER
    return COMPONENT_DISCLAIMER
