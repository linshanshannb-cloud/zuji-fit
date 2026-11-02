const test = require('node:test');
const assert = require('node:assert');
const P = require('../utils/diet-present');

test('remaining copy never goes negative and does not divide by a zero target', () => {
  const hit = P.kcalRemain(850, 1584);
  assert.strictEqual(hit.line, '850 / 1584 kcal');
  assert.strictEqual(hit.remain, '剩余 734 kcal');
  const over = P.kcalRemain(1800, 1584);
  assert.strictEqual(over.remain, '超出 216 kcal');
  assert.ok(!over.remain.includes('-') && !over.line.includes('-'));
  assert.strictEqual(P.kcalRemain(100, 0).remain, '未设置目标');
  assert.strictEqual(P.kcalRemain(100, null).line, '100 kcal');
  const low = P.macroRemain(40, 100);
  assert.strictEqual(low.right, '40 / 100g');
  assert.strictEqual(low.gap, '还差 60g');
  assert.strictEqual(low.bar, 40);
  const high = P.macroRemain(250, 100);
  assert.strictEqual(high.gap, '超出 150g');
  assert.strictEqual(high.bar, 100);
  assert.ok(!high.gap.includes('-') && !high.right.includes('-'));
  const unset = P.macroRemain(10, 0);
  assert.deepStrictEqual([unset.right, unset.gap, unset.bar], ['未设置目标', '', 0]);
  assert.strictEqual(P.macroRemain(10, null).bar, 0);
});

test('cooked rice scales per 100g and meal copy stays explicit', () => {
  assert.strictEqual(P.basisPhrase('米饭', 'cooked'), '米饭（熟），每 100g');
  assert.strictEqual(P.basisPhrase('米饭', 'raw'), '米饭（生），每 100g');
  assert.deepStrictEqual(P.scaleSnap({ carbsG: 25, proteinG: 2.7, fatG: 0.3 }, 'cooked', 200), {
    carbsG: 50, proteinG: 5.4, fatG: 0.6, kcal: 227,
  });
  assert.strictEqual(P.mealSummary([
    { kind: 'food', name: '米饭', basis: 'cooked', qty: 150 },
    { kind: 'food', name: '鸡胸肉', basis: 'cooked', qty: 100 },
  ]), '米饭 150g · 鸡胸肉 100g');
  assert.strictEqual(P.dayTitle('2026-11-02', '2026-11-02'), '11月2日·周一');
  assert.strictEqual(P.dayTitle('2025-11-02', '2026-11-02'), '2025年11月2日·周日');
  assert.strictEqual(P.inferMeal(new Date(2026, 10, 2, 8, 30)), 'breakfast');
  assert.strictEqual(P.inferMeal(new Date(2026, 10, 2, 12, 0)), 'lunch');
  assert.strictEqual(P.inferMeal(new Date(2026, 10, 2, 16, 0)), 'snack');
  assert.strictEqual(P.inferMeal(new Date(2026, 10, 2, 19, 0)), 'dinner');
  assert.strictEqual(P.inferMeal(new Date(2026, 10, 2, 23, 0)), 'snack');
});

test('legacy quick rows migrate to unnamed nutrient records without guessing a food', () => {
  const once = P.migrateEntry({ id: 'e', kind: 'quick', name: '快速记录', carbsG: 10, proteinG: 20, fatG: 5 });
  assert.strictEqual(once.kind, 'nutrient');
  assert.strictEqual(once.meal, 'other');
  assert.strictEqual(once.name, '');
  assert.deepStrictEqual([once.carbsG, once.proteinG, once.fatG], [10, 20, 5]);
  const twice = P.migrateEntry(once);
  assert.deepStrictEqual(twice, once);
  const food = P.migrateEntry({ id: 'f', kind: 'food', name: '米饭', basis: 'cooked', qty: 200, carbsG: 50, proteinG: 0, fatG: 0 });
  assert.strictEqual(food.kind, 'food');
  assert.strictEqual(food.name, '米饭');
  assert.strictEqual(food.snap.carbsG, 25);
  assert.deepStrictEqual(P.migrateEntry(food), food);
});
