const test = require('node:test');
const assert = require('node:assert');
const F = require('../utils/diet-formula');

test('Mifflin-St Jeor and activity factors are the confirmed §8 numbers', () => {
  assert.strictEqual(F.bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 25 }), 1805);
  assert.strictEqual(F.bmr({ sex: 'female', weightKg: 80, heightCm: 180, age: 25 }), 1639);
  assert.strictEqual(F.bmr({ sex: '', weightKg: 80, heightCm: 180, age: 25 }), null);
  assert.deepStrictEqual(F.ACTIVITY.map(a => a.factor), [1.2, 1.375, 1.55, 1.725, 1.9]);
  const bmr = 1805;
  assert.strictEqual(F.tdee(bmr, 'moderate'), 1805 * 1.55);
  assert.strictEqual(F.targetFromTdee(1805 * 1.55, 20), 1805 * 1.55 * 0.8);
});

test('taper defaults: TDEE−20% is applied by the caller, S4b uses P=1.5 and F=22.5%', () => {
  const target = 2400;
  const raw = F.macrosFromTarget(target, { mode: 's4b', weightKg: 80, proteinPerKg: F.DEFAULTS.proteinPerKgTaper, fatPct: F.DEFAULTS.fatPct });
  assert.strictEqual(F.DEFAULTS.proteinPerKgTaper, 1.5);
  assert.strictEqual(F.DEFAULTS.fatPct, 0.225);
  assert.strictEqual(F.DEFAULTS.observeDays, 7);
  assert.strictEqual(F.DEFAULTS.stuckDeltaG, -15);
  assert.ok(Math.abs(raw.proteinG - 120) < 1e-9);
  assert.ok(Math.abs(raw.fatG - 60) < 1e-9);
  assert.ok(Math.abs(raw.carbsG - 345) < 1e-9);
  assert.ok(Math.abs(raw.kcal - (4 * 345 + 4 * 120 + 9 * 60)) < 1e-6);
  const ratio = F.macrosFromTarget(2500, { mode: '532', weightKg: 80, proteinPerKg: 1.5, fatPct: 0.225 });
  assert.ok(Math.abs(ratio.carbsG - 2500 * 0.5 / 4) < 1e-9);
  assert.ok(Math.abs(ratio.proteinG - 2500 * 0.3 / 4) < 1e-9);
  assert.ok(Math.abs(ratio.fatG - 2500 * 0.2 / 9) < 1e-9);
});

test('cycle §J.2: endo 2/0.8, ecto 3/1.1, P default 1.2, shares 50/35/15 and 15/35/50', () => {
  assert.strictEqual(F.DEFAULTS.cycleProteinPerKg, 1.2);
  assert.deepStrictEqual(F.cycleStandards('endo'), { carbPerKg: 2, fatPerKg: 0.8 });
  assert.deepStrictEqual(F.cycleStandards('ecto', 1.1), { carbPerKg: 3, fatPerKg: 1.1 });
  assert.strictEqual(F.DEFAULTS.ectoFatPerKg, 1.1);
  assert.deepStrictEqual([F.SPLIT.high.days, F.SPLIT.mid.days, F.SPLIT.low.days], [2, 3, 2]);
  assert.deepStrictEqual([F.SPLIT.high.carbShare, F.SPLIT.mid.carbShare, F.SPLIT.low.carbShare], [0.5, 0.35, 0.15]);
  assert.deepStrictEqual([F.SPLIT.high.fatShare, F.SPLIT.mid.fatShare, F.SPLIT.low.fatShare], [0.15, 0.35, 0.5]);
  assert.strictEqual(F.patternValid(F.DEFAULTS.weekPattern), true);
  assert.strictEqual(F.patternValid(['high', 'high', 'high', 'high', 'high', 'high', 'high']), false);
  assert.strictEqual(F.patternValid(['high', 'mid', 'low', 'mid', 'high', 'mid', 'zero']), false);
});

test('anchor W=90 endo P=1.0 is about 1960/1477/1872 and mid stays lower (DIET-Q-07)', () => {
  const { oral, proposal } = F.anchorTables();
  const h = oral.days.high, m = oral.days.mid, l = oral.days.low;
  assert.ok(Math.abs(h.carbsG - 315) < 1e-6);
  assert.ok(Math.abs(h.fatG - 37.8) < 1e-6);
  assert.ok(Math.abs(h.proteinG - 90) < 1e-6);
  assert.ok(Math.abs(m.carbsG - 147) < 1e-6 && Math.abs(m.fatG - 58.8) < 1e-6);
  assert.ok(Math.abs(l.carbsG - 94.5) < 1e-6 && Math.abs(l.fatG - 126) < 1e-6);
  assert.ok(Math.abs(h.kcal - 1960.2) < 1e-6);
  assert.ok(Math.abs(m.kcal - 1477.2) < 1e-6);
  assert.ok(Math.abs(l.kcal - 1872) < 1e-6);
  assert.ok(m.kcal < h.kcal && m.kcal < l.kcal, 'do not flatten kcal');
  assert.ok(Math.abs(proposal.days.high.proteinG - 108) < 1e-6);
  assert.ok(Math.abs(proposal.days.high.kcal - (1960.2 + 72)) < 1e-6);
  assert.ok(proposal.days.mid.kcal < proposal.days.high.kcal);
  ['high', 'mid', 'low'].forEach(t => {
    const d = oral.days[t];
    assert.ok(Math.abs(d.kcal - F.kcalOf(d.carbsG, d.proteinG, d.fatG)) < 1e-6);
  });
});

test('W=92 endo P=1.2 rounds to high 2077 / mid 1584 / low 1987; low above mid is the share formula', () => {
  const raw = F.cyclePlan({ weightKg: 92, bodyType: 'endo', proteinPerKg: 1.2 });
  const days = {};
  ['high', 'mid', 'low'].forEach(t => { days[t] = F.roundMacros(raw.days[t]); });
  assert.deepStrictEqual([days.high.kcal, days.mid.kcal, days.low.kcal], [2077, 1584, 1987]);
  assert.ok(days.mid.kcal < days.high.kcal && days.mid.kcal < days.low.kcal);
  ['high', 'mid', 'low'].forEach(t => {
    assert.strictEqual(days[t].kcal, Math.round(F.kcalOf(days[t].carbsG, days[t].proteinG, days[t].fatG)));
  });
  assert.deepStrictEqual(
    [days.high.carbsG, days.mid.carbsG, days.low.carbsG],
    [322, 150.3, 96.6],
  );
  assert.deepStrictEqual(
    [days.high.fatG, days.mid.fatG, days.low.fatG],
    [38.6, 60.1, 128.8],
  );
  assert.strictEqual(days.high.proteinG, 110.4);
});

test('oral food examples and kcal copy stay labeled, with no zero-carb day in the split', () => {
  assert.deepStrictEqual(F.EXAMPLES.map(e => [e.name, e.carbsPer100g, e.example]), [['米饭', 25, true], ['馒头', 50, true], ['南瓜', 4.4, true]]);
  assert.strictEqual(F.riceCarbs(100), 25);
  assert.ok(F.COPY.kcalNote.includes('蔬菜') && F.COPY.kcalNote.includes('不会'));
  assert.ok(!Object.prototype.hasOwnProperty.call(F.SPLIT, 'zero'));
  assert.ok(F.EXCLUSIONS.some(s => s.includes('0 碳日') && s.includes('不是基础版')));
  assert.strictEqual(F.DEFAULTS.carbFloorPct, 0.4);
  assert.strictEqual(F.DEFAULTS.noLogTipDays, 3);
  assert.strictEqual(F.DEFAULTS.strengthDeltaG, 15);
  const pumpkin = F.scaleFood(F.EXAMPLES[2], 'cooked', 250);
  assert.ok(Math.abs(pumpkin.carbsG - 11) < 1e-9);
});
