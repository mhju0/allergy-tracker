"""Integration regressions for allergy_service.update_testing (Postgres).

update_testing's orchestration — the overlap EXCLUDE gate, one-row-per-ingredient,
date-driven status recompute, and the confirmed-allergen / reacted-row guards — is
Postgres-specific and unreachable by pure unit tests. These run against the local
dev database inside a transaction that is ALWAYS rolled back (nothing is ever
committed), so no data persists. They skip automatically when the database is
unreachable (CI does not run pytest and has no Postgres service).

Each test pins one defect the adversarial review caught in update_testing:
  1. keep-dates ingredient swap must SUCCEED   (regression: it 409'd on itself)
  2. editing into a cross-ingredient overlap must 409
  3. changing to a confirmed allergen that computes completed_safe must 409
  4. editing a row that already reacted must 409
"""
import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.models.parent_user import ParentUser
from app.models.baby_user import BabyUser
from app.models.ingredient import Ingredient
from app.models.allergy.ingredient_testing import IngredientTesting
from app.models.allergy.confirmed_allergy import ConfirmedAllergy
from app.schemas.allergy.ingredient_testing import IngredientTestingUpdate
from app.services import allergy_service

UTC = timezone.utc

# NullPool: 테스트마다 asyncio.run()으로 새 이벤트 루프를 돌리므로, 풀에 남은 커넥션이
# 이전 루프에 묶여 재사용되면 "attached to a different loop"로 깨진다. 풀링을 끄면
# 매 connect가 새 커넥션이라 루프 충돌이 없다.
_test_engine = create_async_engine(settings.db_url_decoded, poolclass=NullPool)


def _reachable() -> bool:
    async def _probe():
        conn = await _test_engine.connect()
        await conn.close()
        return True
    try:
        return asyncio.run(_probe())
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _reachable(), reason="Postgres dev DB not reachable")


async def _two_ingredient_ids(session: AsyncSession) -> tuple[int, int]:
    ids = (await session.execute(select(Ingredient.id).order_by(Ingredient.id).limit(2))).scalars().all()
    assert len(ids) >= 2, "seed DB에 재료가 2개 이상 있어야 함"
    return ids[0], ids[1]


async def _seed_baby(session: AsyncSession) -> BabyUser:
    s = uuid.uuid4().hex[:12]
    parent = ParentUser(
        username=f"t_{s}", email=f"t_{s}@test.local", name="테스트", nickname=f"n_{s}",
    )
    session.add(parent)
    await session.flush()
    baby = BabyUser(parent_id=parent.id, name="테스트아기", birth_date=date(2025, 1, 1))
    session.add(baby)
    await session.flush()
    return baby


def _testing(baby_id, ingredient_id, start, status) -> IngredientTesting:
    return IngredientTesting(
        baby_id=baby_id,
        ingredient_id=ingredient_id,
        test_start_date=start,
        test_end_date=start + timedelta(hours=72),
        test_status=status,
    )


def _run(body):
    """Run body(session) inside a transaction that is ALWAYS rolled back."""
    async def _tx():
        conn = await _test_engine.connect()
        trans = await conn.begin()
        # create_savepoint: update_testing가 내부에서 rollback해도(IntegrityError 경로)
        # 바깥 트랜잭션은 살아있어 시드가 유지되고, 끝에 전부 롤백된다.
        session = AsyncSession(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint",
        )
        try:
            await body(session)
        finally:
            await session.close()
            await trans.rollback()
            await conn.close()
    asyncio.run(_tx())


def test_keep_dates_ingredient_swap_succeeds():
    """Regression: the swap 409'd on itself (overlap excluded the NEW id, not self)."""
    async def body(session):
        ing_a, ing_b = await _two_ingredient_ids(session)
        baby = await _seed_baby(session)
        now = datetime.now(UTC)
        t = _testing(baby.id, ing_a, now - timedelta(hours=1), "testing")
        session.add(t)
        await session.flush()

        result = await allergy_service.update_testing(
            session, t.id, IngredientTestingUpdate(ingredient_id=ing_b)
        )
        assert result is not None
        assert result.ingredient_id == ing_b
        assert result.test_status == "testing"  # window still open
    _run(body)


def test_edit_into_cross_ingredient_overlap_409s():
    async def body(session):
        ing_a, ing_b = await _two_ingredient_ids(session)
        baby = await _seed_baby(session)
        now = datetime.now(UTC)
        active = _testing(baby.id, ing_a, now - timedelta(hours=1), "testing")
        reserved = _testing(baby.id, ing_b, now + timedelta(hours=100), None)  # future, no overlap
        session.add_all([active, reserved])
        await session.flush()

        with pytest.raises(HTTPException) as ei:
            await allergy_service.update_testing(
                session, reserved.id,
                IngredientTestingUpdate(test_start_date=now - timedelta(minutes=30)),
            )
        assert ei.value.status_code == 409
    _run(body)


def test_change_to_confirmed_allergen_that_computes_safe_409s():
    async def body(session):
        ing_a, ing_b = await _two_ingredient_ids(session)
        baby = await _seed_baby(session)
        now = datetime.now(UTC)
        session.add(ConfirmedAllergy(baby_id=baby.id, ingredient_id=ing_b, confirmed_date=date(2025, 6, 1)))
        t = _testing(baby.id, ing_a, now - timedelta(hours=1), "testing")
        session.add(t)
        await session.flush()

        with pytest.raises(HTTPException) as ei:
            await allergy_service.update_testing(
                session, t.id,
                IngredientTestingUpdate(
                    ingredient_id=ing_b,
                    test_start_date=now - timedelta(hours=100),  # elapsed → completed_safe
                ),
            )
        assert ei.value.status_code == 409
    _run(body)


def test_edit_reacted_row_409s():
    async def body(session):
        ing_a, _ = await _two_ingredient_ids(session)
        baby = await _seed_baby(session)
        now = datetime.now(UTC)
        t = _testing(baby.id, ing_a, now - timedelta(hours=1), "completed_reaction")
        session.add(t)
        await session.flush()

        with pytest.raises(HTTPException) as ei:
            await allergy_service.update_testing(
                session, t.id,
                IngredientTestingUpdate(test_start_date=now - timedelta(hours=2)),
            )
        assert ei.value.status_code == 409
    _run(body)
