const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Portion = require('../utils/diet-portion');
const Ai = require('../utils/diet-ai');
const P = require('../utils/diet-present');
const SD = require('../utils/share-day');
const S = require('../utils/storage');
const K = require('../utils/repo/keys');
const { fresh } = require('./helpers');

function food(extra) {
  return Object.assign({
    food: true, kcal: 100, carbsG: 10, proteinG: 2, fatG: 1,
  }, extra);
}
function stateOf(extra) {
  const row = Ai.assess(food(extra));
  assert.strictEqual(row.ok, true, row.message);
  return Portion.fromAssessed(row.data);
}
function nums(state) {
  return {
    kcal: state.shown.kcal, carbsG: state.shown.carbsG,
    proteinG: state.shown.proteinG, fatG: state.shown.fatG,
  };
}
function must(next) {
  assert.ok(next.state, next.error || 'no state');
  return next.state;
}

test('vague names get an editable default and an honest pending mark', () => {
  const banana = stateOf({ name: '香蕉', portion: '一份' });
  assert.strictEqual(Portion.display(banana.detail), '1根 · 中');
  assert.strictEqual(Portion.view(banana).portionStatus, '估计 · 份量待确认');
  assert.ok(Portion.view(banana).chips.some(c => c.label === '2根'));
  assert.ok(Portion.view(banana).chips.some(c => c.label === '大'));
  const beer = stateOf({ name: '啤酒', portion: '' });
  assert.strictEqual(Portion.display(beer.detail), '1罐');
  assert.ok(Portion.view(beer).chips.some(c => c.label === '330ml'));
  assert.ok(!String(Portion.display(beer.detail)).includes('g'));
  const chips = stateOf({ name: '薯片', portion: '1份' });
  assert.strictEqual(Portion.display(chips.detail), '1包');
  assert.ok(Portion.view(chips).chips.some(c => c.label === '净含量'));
  assert.strictEqual(chips.detail.amount, null);
  const noodle = stateOf({ name: '米粉', portion: '一份' });
  assert.strictEqual(Portion.display(noodle.detail), '1碗 · 中');
  assert.ok(Portion.view(noodle).chips.some(c => c.label === '一半'));
  ['番茄炒蛋', '牛肉面', '鸡蛋灌饼', '石锅拌饭'].forEach(name => {
    const one = Ai.assess(food({ name, portion: '一份' }));
    assert.strictEqual(one.items.length, 1, name);
    assert.strictEqual(one.data.name, name);
    assert.strictEqual(one.data.portion, '一份');
    assert.ok(!/份\s*份/.test(one.data.portion), name);
  });
});

test('explicit portions keep qty, unit and original text without stacking units', () => {
  const parsed = Portion.parseText('2根');
  assert.strictEqual(parsed.qty, 2);
  assert.strictEqual(parsed.unit, '根');
  assert.strictEqual(Portion.display(parsed), '2根');
  const can = Portion.parseText('1罐330ml');
  assert.strictEqual(can.qty, 1);
  assert.strictEqual(can.unit, '罐');
  assert.strictEqual(can.amount, 330);
  assert.strictEqual(can.amountUnit, 'ml');
  assert.strictEqual(Portion.display(can), '1罐330ml');
  const half = Portion.parseText('半包');
  assert.strictEqual(half.qty, 0.5);
  assert.strictEqual(half.unit, '包');
  assert.strictEqual(half.ratio, 1);
  const ate = Portion.parseText('一包吃了一半');
  assert.strictEqual(ate.qty, 1);
  assert.strictEqual(ate.unit, '包');
  assert.strictEqual(ate.ratio, 0.5);
  assert.strictEqual(Portion.display(Portion.parseText('1份')), '1份');
  assert.ok(!/份\s*份/.test(Portion.display(Portion.parseText('1份 份'))));
  const grams = Portion.resolveDetail({ name: '米饭', portion: '150g', portionKnown: true });
  assert.strictEqual(grams.unit, 'g');
  assert.strictEqual(grams.qty, 150);
  assert.notStrictEqual(grams.unit, 'ml');
});

test('banana, beer, chips and noodles scale from one baseline and do not drift', () => {
  let banana = stateOf({ name: '香蕉', portion: '1根', qty: 1, unit: '根', size: '中', portionKnown: true, kcal: 90, carbsG: 23, proteinG: 1.1, fatG: 0.3 });
  banana = must(Portion.applyChip(banana, 'q:2'));
  assert.strictEqual(banana.shown.kcal, 180);
  assert.strictEqual(banana.shown.carbsG, 46);
  banana = must(Portion.applyChip(banana, 'z:大'));
  assert.strictEqual(banana.shown.kcal, 225);
  banana = must(Portion.applyChip(banana, 'z:中'));
  banana = must(Portion.applyChip(banana, 'q:1'));
  assert.deepStrictEqual(nums(banana), { kcal: 90, carbsG: 23, proteinG: 1.1, fatG: 0.3 });

  let beer = stateOf({ name: '啤酒', portion: '1罐330ml', qty: 1, unit: '罐', amount: 330, amountUnit: 'ml', portionKnown: true, kcal: 140, carbsG: 12, proteinG: 1, fatG: 0 });
  assert.strictEqual(beer.shown.kcal, 140);
  assert.ok(Portion.view(beer).energyNote.includes('没有改写热量'));
  beer = must(Portion.applyChip(beer, 'm:500'));
  assert.strictEqual(beer.shown.kcal, 212);
  assert.strictEqual(beer.shown.carbsG, 18.2);
  assert.ok(Portion.view(beer).portionStatus.includes('ml 不是克'));
  beer = must(Portion.applyChip(beer, 'q:2'));
  assert.strictEqual(beer.shown.kcal, 424);
  beer = must(Portion.applyChip(beer, 'q:1'));
  beer = must(Portion.applyChip(beer, 'm:330'));
  assert.strictEqual(beer.shown.kcal, 140);
  assert.strictEqual(beer.shown.carbsG, 12);

  let chips = stateOf({ name: '薯片', portion: '1包', qty: 1, unit: '包', portionKnown: true, kcal: 540, carbsG: 50, proteinG: 7, fatG: 35 });
  const anchored = must(Portion.setAmountRaw(chips, '70'));
  assert.strictEqual(anchored.shown.kcal, 540);
  assert.ok(Portion.view(anchored).portionStatus.includes('净含量'));
  let half = must(Portion.applyChip(anchored, 'r:0.5'));
  assert.strictEqual(half.shown.kcal, 270);
  assert.strictEqual(half.shown.fatG, 17.5);
  let doubled = must(Portion.applyChip(half, 'q:2'));
  assert.deepStrictEqual(nums(doubled), nums(anchored));
  let back = must(Portion.applyChip(doubled, 'q:1'));
  back = must(Portion.applyChip(back, 'r:1'));
  assert.deepStrictEqual(nums(back), { kcal: 540, carbsG: 50, proteinG: 7, fatG: 35 });

  let noodle = stateOf({ name: '米粉', portion: '1碗', qty: 1, unit: '碗', size: '中', portionKnown: true, kcal: 300, carbsG: 60, proteinG: 8, fatG: 4 });
  noodle = must(Portion.applyChip(noodle, 'z:小'));
  assert.strictEqual(noodle.shown.kcal, 225);
  noodle = must(Portion.applyChip(noodle, 'r:0.5'));
  assert.strictEqual(noodle.shown.kcal, 113);
  noodle = must(Portion.applyChip(noodle, 'r:1'));
  noodle = must(Portion.applyChip(noodle, 'z:中'));
  assert.strictEqual(noodle.shown.kcal, 300);
  assert.strictEqual(noodle.shown.carbsG, 60);
});

test('empty, zero, decimal, extreme and unit changes stay finite and do not invent grams', () => {
  let rice = stateOf({ name: '米饭', portion: '100g', qty: 100, unit: 'g', portionKnown: true, kcal: 200, carbsG: 44, proteinG: 4, fatG: 0.5 });
  const empty = Portion.setQtyRaw(rice, '');
  assert.strictEqual(empty.state.shown.kcal, 200);
  const zero = must(Portion.setQtyRaw(rice, '0'));
  assert.strictEqual(zero.shown.kcal, 0);
  assert.strictEqual(zero.shown.carbsG, 0);
  const restored = must(Portion.setQtyRaw(zero, '100'));
  assert.deepStrictEqual(nums(restored), nums(rice));
  const decimal = must(Portion.setQtyRaw(rice, '150.5'));
  assert.strictEqual(decimal.shown.kcal, 301);
  const huge = Portion.setQtyRaw(rice, '5000');
  assert.ok(huge.error);
  assert.strictEqual(rice.shown.kcal, 200);
  const bad = Portion.setQtyRaw(rice, '-3');
  assert.ok(bad.error);
  const toMl = must(Portion.applyChip(rice, 'u:ml'));
  assert.strictEqual(toMl.shown.kcal, 200);
  assert.strictEqual(toMl.detail.qty, null);
  assert.ok(Portion.view(toMl).portionStatus.includes('不会把原来的数量当成克或毫升'));
  const ml = must(Portion.setQtyRaw(toMl, '330'));
  assert.strictEqual(ml.shown.kcal, 200);
  assert.strictEqual(ml.detail.unit, 'ml');
  const halfMl = must(Portion.setQtyRaw(ml, '165'));
  assert.strictEqual(halfMl.shown.kcal, 100);
  assert.notStrictEqual(halfMl.detail.unit, 'g');
});

test('package label wins, direct overrides stay consistent, and 4/4/9 does not rewrite alcohol', () => {
  let beer = stateOf({ name: '啤酒', portion: '1罐330ml', qty: 1, unit: '罐', amount: 330, amountUnit: 'ml', portionKnown: true, kcal: 140, carbsG: 12, proteinG: 1, fatG: 0 });
  const blocked = Portion.applyLabel(beer, { mode: '100g', kcal: '43', carbsG: '3.6', proteinG: '0.5', fatG: '0' });
  assert.ok(blocked.error.includes('毫升不能当成克'));
  assert.strictEqual(beer.shown.kcal, 140);
  let grams = stateOf({ name: '薯片', portion: '80g', qty: 80, unit: 'g', portionKnown: true, kcal: 400, carbsG: 40, proteinG: 6, fatG: 24 });
  grams = must(Portion.applyLabel(grams, { mode: '100g', kcal: '500', carbsG: '50', proteinG: '7', fatG: '30' }));
  assert.strictEqual(grams.baseline.source, 'label');
  assert.strictEqual(grams.shown.kcal, 400);
  grams = must(Portion.setQtyRaw(grams, '40'));
  assert.strictEqual(grams.shown.kcal, 200);
  assert.strictEqual(grams.shown.fatG, 12);
  assert.strictEqual(grams.detail.unit, 'g');
  let labeled = must(Portion.applyLabel(beer, { mode: 'pack', kcal: '150', carbsG: '12', proteinG: '1.2', fatG: '0' }));
  assert.strictEqual(labeled.baseline.source, 'label');
  assert.strictEqual(labeled.shown.kcal, 150);
  labeled = must(Portion.applyChip(labeled, 'q:2'));
  assert.strictEqual(labeled.shown.kcal, 300);
  assert.strictEqual(labeled.shown.proteinG, 2.4);
  labeled = must(Portion.editNutrient(labeled, 'kcal', '280'));
  assert.strictEqual(labeled.baseline.source, 'label');
  assert.strictEqual(labeled.baseline.override, 'nutrient');
  labeled = must(Portion.applyChip(labeled, 'q:1'));
  assert.strictEqual(labeled.shown.kcal, 140);
  const assessed = Ai.assess(food({ name: '啤酒', portion: '1罐', kcal: 500, carbsG: 0, proteinG: 0, fatG: 0 }));
  assert.strictEqual(assessed.data.kcal, 500);
  const wild = Ai.assess(food({ name: '米饭', kcal: 2000, carbsG: 86, proteinG: 20, fatG: 20 }));
  assert.strictEqual(wild.data.kcal, 604);
});

test('saved edits scale from the baseline, legacy rows are not re-estimated, and totals agree', () => {
  const { repo } = fresh();
  assert.strictEqual(repo.diet.commit({ mode: 'taper', refWeightKg: 80, energyMode: 'absolute_target', absoluteTarget: 2400, macroMode: 's4b' }).ok, true);
  assert.ok(repo.aerobic.create({ date: '2026-10-17', activityType: 'run', durationMin: 20, estimatedKcal: 180 }).ok);
  const saved = repo.diet.addAiEntries('2026-10-17', [
    { meal: 'lunch', name: '薯片', portion: '1包', qty: 1, unit: '包', portionKnown: true, kcal: 400, carbsG: 40, proteinG: 6, fatG: 24 },
    { meal: 'lunch', name: '啤酒', portion: '1罐330ml', qty: 1, unit: '罐', amount: 330, amountUnit: 'ml', portionKnown: true, kcal: 140, carbsG: 12, proteinG: 1, fatG: 0 },
  ]);
  assert.strictEqual(saved.ok, true, saved.message);
  const chips = saved.data.entries[0];
  const beer = saved.data.entries[1];
  let half = repo.diet.updateEntry('2026-10-17', chips.id, { portionMeta: { qty: 1, unit: '包', ratio: 0.5, explicit: true, touched: true } });
  assert.strictEqual(half.ok, true, half.message);
  assert.strictEqual(half.data.entry.kcal, 200);
  assert.strictEqual(half.data.entry.fatG, 12);
  let doubled = repo.diet.updateEntry('2026-10-17', chips.id, { portionMeta: { qty: 2, unit: '包', ratio: 0.5, explicit: true, touched: true } });
  assert.strictEqual(doubled.data.entry.kcal, 400);
  let back = repo.diet.updateEntry('2026-10-17', chips.id, { portionMeta: { qty: 1, unit: '包', ratio: 1, explicit: true, touched: true } });
  assert.strictEqual(back.data.entry.kcal, 400);
  assert.strictEqual(back.data.entry.carbsG, 40);
  assert.strictEqual(back.data.entry.proteinG, 6);
  assert.strictEqual(back.data.entry.fatG, 24);
  const alcohol = repo.diet.updateEntry('2026-10-17', beer.id, { carbsG: 10, proteinG: 1, fatG: 0 });
  assert.strictEqual(alcohol.data.entry.kcal, 140);
  const board = repo.diet.dayBoard('2026-10-17');
  assert.strictEqual(board.totals.kcal, 540);
  assert.strictEqual(board.meals[0].kcal, 540);
  assert.strictEqual(board.meals[0].estimateMark, '估算');
  assert.ok(board.meals[0].summary.includes('薯片') && board.meals[0].summary.includes('啤酒'));
  assert.strictEqual(repo.diet.intakeMarks('2026-10-17', '2026-10-17')['2026-10-17'], 540);
  assert.ok(board.entries.every(e => !/份\s*份/.test(e.portionText || '')));
  const share = SD.buildShareModel({
    date: '2026-10-17',
    train: [{ kind: 'aerobic', name: '跑步', minutes: 20, kcal: 180, createdAt: 1 }],
    diet: board.entries.map(e => ({ name: e.displayName, mealLabel: e.mealLabel, kcal: e.kcal, estimate: e.estimate, createdAt: 1 })),
  });
  assert.strictEqual(share.train.summary, '消耗 180 kcal · 20 分钟');
  assert.strictEqual(share.diet.summary, '摄入 540 kcal · 估算');
  assert.strictEqual(repo.aerobic.daySummaries('2026-10-17')[0].estimatedKcal, 180);
  S.set(K.DIET_LOGS, [{
    id: 'dl_old', date: '2026-10-16', entries: [{
      id: 'de_old', kind: 'nutrient', meal: 'snack', name: '香蕉',
      basis: null, qty: null, carbsG: 27, proteinG: 1.3, fatG: 0.4, kcal: 114,
      portion: '1份', source: 'ai-text', v: 2,
    }],
  }].concat(S.get(K.DIET_LOGS) || []));
  const legacy = repo.diet.dayBoard('2026-10-16');
  assert.strictEqual(legacy.totals.kcal, 114);
  assert.strictEqual(legacy.entries[0].portionNote, '原记录份量未细化');
  assert.strictEqual(legacy.entries[0].portionText, '1份');
  const again = repo.diet.dayBoard('2026-10-16');
  assert.strictEqual(again.totals.kcal, 114);
  const renamed = repo.diet.updateEntry('2026-10-16', 'de_old', { portionMeta: { qty: 2, unit: '根', explicit: true, touched: true } });
  assert.strictEqual(renamed.ok, true, renamed.message);
  assert.strictEqual(renamed.data.entry.kcal, 114);
  assert.strictEqual(renamed.data.entry.portion, '2根');
  assert.strictEqual(repo.diet.dayBoard('2026-10-16').totals.kcal, 114);
  assert.ok(Portion.noteFor(renamed.data.entry).includes('不会重算'));
});

test('old, broken and skipped model payloads still parse, and the prompt matches the function', () => {
  const old = Ai.assess({ food: true, name: '豆浆', portion: '一杯', kcal: 80, carbsG: 8, proteinG: 6, fatG: 3 });
  assert.strictEqual(old.ok, true, old.message);
  assert.strictEqual(old.data.portion, '一杯');
  assert.ok(old.data.nutri && old.data.nutri.source === 'ai');
  const messy = Ai.assess({
    food: true, name: '香蕉', portion: '一份', qty: 'lots', unit: '公斤', amount: -1, amountUnit: 'lb', ratio: 4, portionKnown: 'false',
    kcal: 90, carbsG: 23, proteinG: 1, fatG: 0.3,
  });
  assert.strictEqual(messy.ok, true, messy.message);
  assert.strictEqual(messy.data.portion, '1根 · 中');
  assert.strictEqual(messy.data.portionMeta.pending, true);
  const skipped = stateOf({ name: '香蕉', portion: '' });
  const after = must(Portion.applyChip(skipped, 'skip'));
  assert.strictEqual(after.shown.kcal, skipped.shown.kcal);
  assert.strictEqual(Portion.view(after).clarify, false);
  assert.strictEqual(Portion.view(after).portionStatus, '估计 · 份量待确认');
  const prompt = require('../pages/diet-ai/prompt').SYSTEM;
  const fn = fs.readFileSync(path.join(__dirname, '../cloudfunctions/diet-recognize/index.js'), 'utf8');
  assert.ok(fn.includes(prompt));
  assert.ok(prompt.includes('portionKnown') && prompt.includes('不要把 ml 当成 g') && prompt.includes('不要写置信度'));
  assert.ok(prompt.includes('番茄炒蛋') && prompt.includes('鸡蛋灌饼'));
  const page = fs.readFileSync(path.join(__dirname, '../pages/diet-ai/result/result.wxml'), 'utf8');
  const meal = fs.readFileSync(path.join(__dirname, '../pages/diet-extra/diet-meal/diet-meal.wxml'), 'utf8');
  assert.ok(page.includes('先按估计记') && page.includes('包装上有营养表') && page.includes('删除'));
  assert.ok(meal.includes('包装上有营养表') && meal.includes('portionNote'));
  const calendar = fs.readFileSync(path.join(__dirname, '../pages/calendar/calendar.js'), 'utf8');
  assert.ok(!calendar.includes("portion + ' 份'"));
});
