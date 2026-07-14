from datetime import datetime, timezone
import logging

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from fastapi import HTTPException, status

from app.models.allergy.ingredient_testing import IngredientTesting
from app.models.allergy.confirmed_allergy import ConfirmedAllergy
from app.models.allergy.symptom_check import SymptomCheck
from app.schemas.allergy.ingredient_testing import IngredientTestingCreate, IngredientTestingUpdate
from app.crud.allergy.ingredient_testing import (
    _assert_no_active_overlap,
    _has_reaction_record,
    _is_active_testing_unique_violation,
    _status_from_dates,
    _test_end_date,
    get_ingredient_testing,
    purge_symptom_checks_for_testing,
    update_ingredient_testing,
)

logger = logging.getLogger("mammacare.allergy")


# _test_end_date / _status_from_dates / _has_reaction_record는
# crud.allergy.ingredient_testing의 단일 정의를 import해 쓴다(이중 정의 금지).


async def _load_testing_with_ingredient(
    db: AsyncSession,
    testing_id,
) -> IngredientTesting:
    result = await db.execute(
        select(IngredientTesting)
        .options(selectinload(IngredientTesting.ingredient))
        .where(IngredientTesting.id == testing_id)
        # populate_existing: 편집으로 ingredient_id가 바뀌면 이미 로드된 옛 ingredient
        # 관계가 남아 응답에 옛 재료명이 실린다. 강제 재적재로 새 재료를 반영한다.
        .execution_options(populate_existing=True)
    )
    item = result.scalar_one()
    item.has_reaction = await _has_reaction_record(db, item.id)
    return item


async def _find_existing_testing(
    db: AsyncSession,
    baby_id,
    ingredient_id: int,
) -> IngredientTesting | None:
    result = await db.execute(
        select(IngredientTesting)
        .where(
            IngredientTesting.baby_id == baby_id,
            IngredientTesting.ingredient_id == ingredient_id,
        )
        .order_by(IngredientTesting.test_start_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _is_confirmed_allergy(
    db: AsyncSession,
    baby_id,
    ingredient_id: int,
) -> bool:
    result = await db.execute(
        select(ConfirmedAllergy.id)
        .where(
            ConfirmedAllergy.baby_id == baby_id,
            ConfirmedAllergy.ingredient_id == ingredient_id,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def create_testing_with_end_date(
    db: AsyncSession,
    data: IngredientTestingCreate,
) -> IngredientTesting:
    """
    Keep one ingredient_testing row per baby and ingredient.

    If the row already exists, update it instead of inserting a duplicate.
    """
    now = datetime.now(timezone.utc)
    requested_status = data.test_status.value if data.test_status is not None else "testing"
    requested_start = data.test_start_date
    if requested_start.tzinfo is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="test_start_date은 timezone 정보가 포함되어야 합니다. (예: 2024-01-01T00:00:00+09:00)",
        )

    # 이미 확정 알레르기로 등록된 재료를 '안전 통과'로 추가하지 못하게 차단한다.
    # (알레르기 관리 페이지 '+ 추가(안전 통과)' 버튼 → test_status="completed_safe")
    if requested_status == "completed_safe" and await _is_confirmed_allergy(
        db, data.baby_id, data.ingredient_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 알레르기 확정된 재료는\n'안전 통과'로 추가할 수 없습니다.",
        )

    existing = await _find_existing_testing(db, data.baby_id, data.ingredient_id)
    if existing is not None:
        existing_start = existing.test_start_date
        if existing_start.tzinfo is None:
            existing_start = existing_start.replace(tzinfo=timezone.utc)
        existing_end = existing.test_end_date
        if existing_end is not None and existing_end.tzinfo is None:
            existing_end = existing_end.replace(tzinfo=timezone.utc)

        # 재테스트 판정: 완료된 테스트(completed_safe/completed_reaction)를 같은 재료로
        # '새 72시간 관찰'로 다시 시작하는 경우. 옛 관찰 창이 아직 안 끝났어도(예: 반응
        # 기록 직후 재테스트) 완료 상태에서 testing으로 재제출하면 재테스트로 본다 —
        # existing_end 도달을 요구하면 실사용 대부분의 재테스트가 이 분기를 못 타
        # SymptomCheck가 삭제되지 않고 has_reaction이 남는 문제가 있었다.
        # testing 행 재제출(진행 중 테스트 자체 수정)은 재테스트가 아니다.
        is_retest = (
            existing.test_status in ("completed_safe", "completed_reaction")
            and requested_status == "testing"
        )

        # 갱신 후 적용될 기간/상태를 mutation 전에 먼저 계산한다.
        # existing을 먼저 더럽히면 아래 _has_reaction_record/_assert 의 SELECT가
        # autoflush로 그 UPDATE를 선반영해 EXCLUDE 위반이 깨끗한 409 매핑 밖에서
        # 500으로 새어나간다. INSERT 경로처럼 "선검사 → mutation → flush 가드" 순서를 지킨다.
        if is_retest:
            # 창 전진: 새 관찰을 요청 시점부터 다시 72시간 잡는다.
            new_start = requested_start
            new_end = _test_end_date(requested_start)
        elif requested_start < existing_start:
            new_start = requested_start
            new_end = _test_end_date(requested_start)
        elif existing.test_end_date is None:
            new_start = existing_start
            new_end = _test_end_date(existing_start)
        else:
            new_start = existing_start
            new_end = existing.test_end_date

        if is_retest:
            # 직전 라운드의 SymptomCheck를 곧 삭제하므로 반응 플래그를 리셋한다.
            has_reaction = False
        else:
            has_reaction = (
                existing.test_status == "completed_reaction"
                or await _has_reaction_record(db, existing.id)
            )
        new_status = _status_from_dates(
            new_start,
            new_end,
            now,
            requested_status=requested_status,
            has_reaction=has_reaction,
        )

        # 갱신 결과가 미완료(NULL·testing)면 다른 재료의 진행 중 테스트와 겹치는지 선검사
        # (자기 재료는 자기 자신 갱신이므로 제외)
        if new_status in (None, "testing"):
            await _assert_no_active_overlap(
                db, data.baby_id, new_start, new_end,
                exclude_ingredient_id=data.ingredient_id,
            )

        existing.test_start_date = new_start
        existing.test_end_date = new_end
        existing.test_status = new_status
        if data.memo is not None:
            existing.memo = data.memo

        try:
            if is_retest:
                # 옛 SymptomCheck 물리 삭제. 내부 첫 SELECT/DELETE가 위 UPDATE를
                # autoflush하므로, 날짜 전진 + 삭제가 한 트랜잭션으로 묶이고
                # EXCLUDE 경합도 여기서 IntegrityError로 잡혀 409로 매핑된다.
                await purge_symptom_checks_for_testing(db, existing.id)
            else:
                await db.flush()
        except IntegrityError as exc:
            await db.rollback()
            # 선검사를 통과했어도 동시 요청 경합으로 EXCLUDE에 걸릴 수 있어 409로 매핑
            if _is_active_testing_unique_violation(exc):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="이미 진행 중인 테스트와\n기간이 겹칩니다.",
                ) from exc
            raise
        return await _load_testing_with_ingredient(db, existing.id)

    test_end = _test_end_date(requested_start)
    initial_status = _status_from_dates(
        requested_start,
        test_end,
        now,
        requested_status=requested_status,
    )
    if initial_status in (None, "testing"):
        await _assert_no_active_overlap(
            db, data.baby_id, requested_start, test_end,
            exclude_ingredient_id=data.ingredient_id,
        )
    obj = IngredientTesting(
        baby_id=data.baby_id,
        ingredient_id=data.ingredient_id,
        test_start_date=requested_start,
        test_end_date=test_end,
        memo=data.memo,
        test_status=initial_status,
    )
    db.add(obj)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        existing = await _find_existing_testing(db, data.baby_id, data.ingredient_id)
        if existing is not None:
            logger.info(
                "ingredient_testing duplicate insert raced; reused existing row baby_id=%s ingredient_id=%s",
                data.baby_id,
                data.ingredient_id,
            )
            return await _load_testing_with_ingredient(db, existing.id)
        # 다른 재료와 기간이 겹쳐 EXCLUDE 제약에 걸린 경합 — 500이 아니라 409로 매핑
        if _is_active_testing_unique_violation(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 진행 중이거나 예약된 알레르기 테스트와\n기간이 겹쳐 등록할 수 없습니다.",
            ) from exc
        raise

    return await _load_testing_with_ingredient(db, obj.id)


async def update_testing(
    db: AsyncSession,
    testing_id,
    data: IngredientTestingUpdate,
) -> IngredientTesting | None:
    """PATCH 진입점.

    memo / 반응확정(completed_reaction — 스키마에서 제한됨)만이면 단순 갱신 경로를 쓴다.
    ingredient_id / test_start_date 변경이 있으면 종료일·상태를 재계산하고 겹침을
    재검사하는 create 경로와 동일한 불변식(선검사 → mutation → flush 가드)을 따른다.
    """
    fields = data.model_dump(exclude_unset=True)
    if "ingredient_id" not in fields and "test_start_date" not in fields:
        return await update_ingredient_testing(db, testing_id, data)

    row = await get_ingredient_testing(db, testing_id)
    if row is None:
        return None
    now = datetime.now(timezone.utc)
    original_ingredient_id = row.ingredient_id

    # 반응이 확정/기록된 테스트는 재료·시작일을 수정할 수 없다. 날짜 재계산으로 창을 다시
    # 열어 completed_reaction(빨강)을 testing(노랑)으로 낮추거나, 반응 기록을 다른 재료로
    # 오귀속하는 경로를 원천 차단한다. 정정이 필요하면 삭제 후 재등록한다.
    if row.test_status == "completed_reaction" or await _has_reaction_record(db, row.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="반응이 기록된 테스트는 수정할 수 없습니다.\n삭제 후 다시 등록해 주세요.",
        )

    target_ingredient_id = fields.get("ingredient_id", original_ingredient_id)
    if "test_start_date" in fields:
        target_start = fields["test_start_date"]
        if target_start.tzinfo is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="test_start_date은 timezone 정보가 포함되어야 합니다. (예: 2024-01-01T00:00:00+09:00)",
            )
    else:
        target_start = row.test_start_date
        if target_start.tzinfo is None:  # DB 값 방어적 보정 (create 경로와 동일)
            target_start = target_start.replace(tzinfo=timezone.utc)

    if target_ingredient_id != original_ingredient_id:
        # 옛 재료에 귀속된 증상 기록이 새 재료로 오귀속되지 않도록, 기록이 있으면 변경 차단.
        has_checks = (
            await db.execute(
                select(SymptomCheck.id).where(SymptomCheck.testing_id == row.id).limit(1)
            )
        ).scalar_one_or_none() is not None
        if has_checks:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="증상 기록이 있는 테스트는 재료를 변경할 수 없습니다.\n삭제 후 다시 등록해 주세요.",
            )
        # 재료당 1행 불변식: 이미 테스트 기록이 있는 재료로는 옮길 수 없음.
        other = await _find_existing_testing(db, row.baby_id, target_ingredient_id)
        if other is not None and other.id != row.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="해당 재료는 이미 테스트 기록이 있습니다.",
            )

    # 반응 이력은 위에서 차단됐으므로 has_reaction=False. 다만 같은 PATCH에 명시된
    # test_status(스키마상 completed_reaction만 허용 — 항상 안전한 red 승격)는 존중해
    # 조용히 삭제되지 않도록 requested_status로 넘긴다.
    requested_status = fields.get("test_status")
    requested_status = getattr(requested_status, "value", requested_status)
    new_end = _test_end_date(target_start)
    new_status = _status_from_dates(
        target_start, new_end, now, requested_status=requested_status
    )

    # 확정 알레르기를 '안전 통과'로 만들 수 없다 (create 경로의 가드와 동일하게 우회 차단).
    if new_status == "completed_safe" and await _is_confirmed_allergy(
        db, row.baby_id, target_ingredient_id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 알레르기 확정된 재료는\n'안전 통과'로 추가할 수 없습니다.",
        )

    # 선검사(겹침) → mutation → flush 가드 순서를 create 경로와 동일하게 지킨다.
    # 편집 대상 자기 자신은 아직 DB에 '옛 ingredient_id'로 있으므로 그것으로 제외해야
    # 자기겹침 오탐(항상 409)을 피한다. 재료 미변경이면 원래 == 대상이라 그대로 동작한다.
    if new_status in (None, "testing"):
        await _assert_no_active_overlap(
            db, row.baby_id, target_start, new_end,
            exclude_ingredient_id=original_ingredient_id,
        )

    row.ingredient_id = target_ingredient_id
    row.test_start_date = target_start
    row.test_end_date = new_end
    row.test_status = new_status
    if "memo" in fields:
        row.memo = fields["memo"]

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        if _is_active_testing_unique_violation(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 진행 중인 테스트와\n기간이 겹칩니다.",
            ) from exc
        raise
    return await _load_testing_with_ingredient(db, row.id)
