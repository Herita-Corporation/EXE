"""
Unit tests for BudgetService.
Tests: calculation, allocation, validation, cache key, edge cases.
"""

import pytest

from app.core.exceptions import BudgetExceededError, InvalidBudgetError
from app.services.budget_service import BudgetService


@pytest.fixture
def service():
    return BudgetService()


class TestCalculatePlanningBudget:
    def test_correct_split(self, service):
        planning, reserve = service.calculate_planning_budget(10_000_000)
        assert planning == 7_000_000
        assert reserve == 3_000_000

    def test_zero_budget_raises(self, service):
        with pytest.raises(InvalidBudgetError):
            service.calculate_planning_budget(0)

    def test_negative_budget_raises(self, service):
        with pytest.raises(InvalidBudgetError):
            service.calculate_planning_budget(-5000)

    def test_small_budget(self, service):
        planning, reserve = service.calculate_planning_budget(1000)
        assert planning == 700.0
        assert reserve == 300.0

    def test_ratio_sum(self, service):
        planning, reserve = service.calculate_planning_budget(9_999_999)
        assert abs(planning + reserve - 9_999_999) < 1


class TestAllocateBudget:
    def test_total_equals_planning_budget(self, service):
        planning, _ = service.calculate_planning_budget(10_000_000)
        breakdown = service.allocate_budget(planning, 5)
        assert abs(breakdown.total - planning) < 1  # rounding tolerance

    def test_all_categories_positive(self, service):
        breakdown = service.allocate_budget(7_000_000, 3)
        assert breakdown.transportation > 0
        assert breakdown.accommodation > 0
        assert breakdown.food > 0
        assert breakdown.attractions > 0
        assert breakdown.contingency > 0

    def test_accommodation_is_largest(self, service):
        breakdown = service.allocate_budget(7_000_000, 3)
        assert breakdown.accommodation > breakdown.attractions


class TestValidateGeneratedBudget:
    def test_within_budget_passes(self, service):
        service.validate_generated_budget(6_000_000, 7_000_000)  # No exception

    def test_exact_budget_passes(self, service):
        service.validate_generated_budget(7_000_000, 7_000_000)

    def test_exceeds_budget_raises(self, service):
        with pytest.raises(BudgetExceededError):
            service.validate_generated_budget(7_000_001, 7_000_000)


class TestPerDayCalculations:
    def test_accommodation_cap(self, service):
        cap = service.get_per_day_accommodation_cap(2_100_000, 3)
        assert cap == 700_000.0

    def test_per_meal_cap(self, service):
        cap = service.get_per_meal_cap(1_050_000, 3)
        assert cap == 116_666.67

    def test_zero_days_returns_zero(self, service):
        assert service.get_per_day_accommodation_cap(1_000_000, 0) == 0.0


class TestCacheKey:
    def test_deterministic(self, service):
        key1 = service.build_cache_key(["Da Nang", "Hoi An"], 5_000_000, 3, ["food"])
        key2 = service.build_cache_key(["Hoi An", "Da Nang"], 5_000_000, 3, ["food"])
        assert key1 == key2  # Cities sorted

    def test_different_budget_different_key(self, service):
        key1 = service.build_cache_key(["Da Nang"], 5_000_000, 3, [])
        key2 = service.build_cache_key(["Da Nang"], 6_000_000, 3, [])
        assert key1 != key2
