"""교차반응(cross-reactivity) 판정 — 서버 단일 소스.

데이터(`cross_reactivity_map.json`)는 프론트엔드 `crossReactivity.ts`의
`CROSS_REACTIVITY_MAP`을 그대로 추출한 것(59개 알레르겐, 277개 엣지)으로, 앞으로
UI·리포트·식단 게이트가 이 한 구현을 공유한다. 반환 DTO는 프론트가 쓰던
`SuspectedIngredient`와 동일한 camelCase 형태를 유지한다(프론트/리포트 공용).

재생성(데이터 갱신 시):
  node --experimental-strip-types 로 crossReactivity.ts의 CROSS_REACTIVITY_MAP을
  JSON.stringify → 이 파일로 저장. tests/test_cross_reactivity.py 가 프론트 함수와
  동일 출력을 고정한다.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_MAP_PATH = Path(__file__).parent / "cross_reactivity_map.json"
# {allergen_name: [{"name", "reason", "severity"}, ...]}
CROSS_REACTIVITY_MAP: dict[str, list[dict[str, str]]] = json.loads(
    _MAP_PATH.read_text(encoding="utf-8")
)

_SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def get_suspected_ingredients_prioritized(
    confirmed_allergen_names: list[str],
    reaction_allergen_names: list[str],
) -> list[dict[str, str]]:
    """확정·반응 알레르겐 이름으로 교차반응 의심 재료 목록을 반환.

    확정 기반 그룹이 먼저, 각 그룹 내 severity 높은 순(안정 정렬). 이미 알려진
    재료(확정·반응)는 제외. crossReactivity.ts의 getSuspectedIngredientsPrioritized와
    동일한 결과를 낸다(test_cross_reactivity.py 가 프론트 출력으로 고정).
    """
    all_known = set(confirmed_allergen_names) | set(reaction_allergen_names)

    def collect(names: list[str]) -> list[dict[str, str]]:
        seen: set[str] = set()
        out: list[dict[str, str]] = []
        for name in names:
            for cr in CROSS_REACTIVITY_MAP.get(name, []):
                if cr["name"] in all_known or cr["name"] in seen:
                    continue
                seen.add(cr["name"])
                out.append({
                    "suspectedName": cr["name"],
                    "reason": cr["reason"],
                    "severity": cr["severity"],
                    "sourceAllergen": name,
                })
        out.sort(key=lambda x: _SEVERITY_ORDER.get(x["severity"], 2))
        return out

    return collect(confirmed_allergen_names) + collect(reaction_allergen_names)


def is_cross_reactive_suspect(
    ingredient_name: str,
    reaction_ingredient_names: list[str],
) -> dict[str, Any]:
    """단일 재료가 반응 재료와 교차반응 관계인지 판정. crossReactivity.ts와 동일."""
    for reaction_name in reaction_ingredient_names:
        for cr in CROSS_REACTIVITY_MAP.get(reaction_name, []):
            if cr["name"] == ingredient_name:
                return {
                    "isSuspect": True,
                    "sourceAllergen": reaction_name,
                    "reason": cr["reason"],
                    "severity": cr["severity"],
                }
    return {"isSuspect": False}
