const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Ai = require('../utils/diet-ai');
const P = require('../utils/diet-present');
const JS = require('../utils/journal-stickers');
const { fresh } = require('./helpers');

const BOWL = {
  food: true, name: '石锅拌饭', portion: '一份', kcal: 614,
  carbsG: 86, proteinG: 20, fatG: 20, fiberG: 5, sugarG: 8, saltMg: 1082,
  tips: '酱少放一勺会轻一点。',
};

test('parse fenced JSON and ignore the sentence around it', () => {
  const raw = Ai.parseModelText('好的\n```json\n' + JSON.stringify(BOWL) + '\n```\n以上是估算');
  const r = Ai.assess(raw);
  assert.strictEqual(r.ok, true, r.message);
  assert.strictEqual(r.data.name, '石锅拌饭');
  assert.strictEqual(r.data.kcal, 614);
  assert.strictEqual(r.data.saltMg, 1082);
  assert.strictEqual(r.data.fiberG, 5);
});

test('not food, unreadable text, and out-of-range numbers do not become a record', () => {
  assert.strictEqual(Ai.assess({ food: false, name: '闲聊' }).code, 'NOT_FOOD');
  assert.strictEqual(Ai.assess(Ai.parseModelText('今天心情不错')).code, 'PARSE');
  assert.strictEqual(Ai.assess({ food: true, name: '米饭', carbsG: 9000, proteinG: 1, fatG: 1, kcal: 100 }).code, 'RANGE');
  assert.strictEqual(Ai.assess({ food: true, name: '无法识别' }).code, 'NOT_FOOD');
});

test('kcal far from the macros is recomputed; a small gap is kept; saltG converts', () => {
  const wild = Ai.assess({ food: true, name: '米饭', carbsG: 86, proteinG: 20, fatG: 20, kcal: 2000 });
  assert.strictEqual(wild.ok, true);
  assert.strictEqual(wild.data.kcal, 604);
  const close = Ai.assess(BOWL);
  assert.strictEqual(close.data.kcal, 614);
  const salt = Ai.assess({ food: true, name: '汤', carbsG: 1, proteinG: 1, fatG: 1, kcal: 17, saltG: 1.5 });
  assert.strictEqual(salt.data.saltMg, 1500);
});

test('items split independent foods and keep each estimate', () => {
  const r = Ai.assess({
    food: true,
    tips: '两样分开记。',
    items: [
      { name: '米饭', portion: '一碗', kcal: 200, carbsG: 45, proteinG: 4, fatG: 0.5 },
      { name: '饺子', portion: '6个', kcal: 250, carbsG: 30, proteinG: 12, fatG: 8 },
    ],
  });
  assert.strictEqual(r.ok, true, r.message);
  assert.strictEqual(r.items.length, 2);
  assert.strictEqual(r.data.name, '米饭');
  assert.strictEqual(r.items[0].kcal, 200);
  assert.strictEqual(r.items[1].name, '饺子');
  assert.strictEqual(r.items[1].kcal, 250);
  assert.strictEqual(r.items[1].proteinG, 12);
  assert.strictEqual(r.items[0].tips, '两样分开记。');
  assert.ok(JS.foodSticker(r.items[0].name).endsWith('/rice.png'));
  assert.ok(JS.foodSticker(r.items[1].name).endsWith('/dumplings.png'));
  assert.ok(JS.foodSticker('没听过的小食').endsWith('/bowl.png'));
  const listed = Ai.assess([
    { food: true, name: '鸡蛋', kcal: 70, carbsG: 1, proteinG: 6, fatG: 5 },
    { food: true, name: '牛奶', kcal: 80, carbsG: 5, proteinG: 4, fatG: 4 },
  ]);
  assert.deepStrictEqual(listed.items.map(x => x.name), ['鸡蛋', '牛奶']);
  assert.strictEqual(listed.items[0].kcal + listed.items[1].kcal, 150);
});

test('a single object stays one record, including compound dish names', () => {
  ['番茄炒蛋', '牛肉面', '石锅拌饭', '鸡蛋灌饼', '米饭饺子'].forEach(name => {
    const r = Ai.assess({ food: true, name, portion: '一份', kcal: 400, carbsG: 40, proteinG: 15, fatG: 12 });
    assert.strictEqual(r.ok, true, name);
    assert.strictEqual(r.items.length, 1, name);
    assert.strictEqual(r.data.name, name);
  });
});

test('a broken items list falls back to the single object', () => {
  const parent = {
    food: true, name: '米饭饺子', portion: '一餐', kcal: 450, carbsG: 70, proteinG: 14, fatG: 10,
    items: [{ name: '' }, 'nope', null],
  };
  const bad = Ai.assess(parent);
  assert.strictEqual(bad.ok, true, bad.message);
  assert.strictEqual(bad.items.length, 1);
  assert.strictEqual(bad.data.name, '米饭饺子');
  assert.strictEqual(bad.data.kcal, 450);
  const notArray = Ai.assess({ food: true, name: '牛肉面', kcal: 500, carbsG: 60, proteinG: 20, fatG: 15, items: '牛肉、面' });
  assert.strictEqual(notArray.items.length, 1);
  assert.strictEqual(notArray.data.name, '牛肉面');
  const empty = Ai.assess({ food: true, name: '豆浆', portion: '一杯', kcal: 80, carbsG: 8, proteinG: 6, fatG: 3, items: [] });
  assert.strictEqual(empty.items.length, 1);
  assert.strictEqual(empty.data.name, '豆浆');
  const chat = Ai.assess({ food: false, items: [{ name: '米饭', kcal: 200, carbsG: 45, proteinG: 4, fatG: 1 }] });
  assert.strictEqual(chat.ok, false);
  assert.strictEqual(chat.code, 'NOT_FOOD');
  const kept = Ai.assess({
    food: true, name: '米饭饺子', kcal: 450, carbsG: 70, proteinG: 14, fatG: 10,
    items: [
      { name: '米饭', kcal: 200, carbsG: 45, proteinG: 4, fatG: 1 },
      { name: '', kcal: 1 },
    ],
  });
  assert.strictEqual(kept.items.length, 1);
  assert.strictEqual(kept.data.name, '米饭');
});

test('confirmed numbers can disagree with 4/4/9, and blank optional fields stay empty', () => {
  const r = Ai.acceptEntry({ name: '石锅拌饭', kcal: '500', carbsG: '80', proteinG: '20', fatG: '20', fiberG: '', sugarG: '', saltMg: '1082', eatenAt: '19:00', note: '少酱' });
  assert.strictEqual(r.ok, true, r.message);
  assert.strictEqual(r.kcal || r.data.kcal, 500);
  assert.strictEqual(r.data.carbsG, 80);
  assert.strictEqual(r.data.fiberG, null);
  assert.strictEqual(r.data.note, '少酱');
  assert.strictEqual(Ai.acceptEntry({ name: '', kcal: 1, carbsG: 1, proteinG: 1, fatG: 1 }).ok, false);
  assert.strictEqual(Ai.acceptEntry({ name: '汤', kcal: 9000, carbsG: 1, proteinG: 1, fatG: 1 }).ok, false);
});

test('AI entry updates today remain, old rows keep derived kcal, and the utterance is not stored', () => {
  const { repo } = fresh();
  assert.strictEqual(repo.diet.commit({ mode: 'taper', refWeightKg: 80, energyMode: 'absolute_target', absoluteTarget: 2400, macroMode: 's4b' }).ok, true);
  const saved = repo.diet.addAiEntry('2026-10-17', {
    meal: 'dinner', name: '石锅拌饭', portion: '一份', kcal: 614, carbsG: 86, proteinG: 20, fatG: 20,
    fiberG: 5, sugarG: 8, saltMg: 1082, tips: '酱少放一勺。', note: '', eatenAt: '19:00',
  });
  assert.strictEqual(saved.ok, true, saved.message);
  const entry = saved.data.entries[0];
  assert.strictEqual(entry.kind, 'nutrient');
  assert.strictEqual(entry.source, 'ai-text');
  assert.strictEqual(entry.kcal, 614);
  assert.ok(!JSON.stringify(entry).includes('晚饭'));
  const board = repo.diet.dayBoard('2026-10-17');
  assert.strictEqual(board.intake.kcalLine, '614 / 2400 kcal');
  assert.strictEqual(board.intake.remain, '剩余 1786 kcal');
  assert.strictEqual(board.intake.rows[0].gap, '还差 259g');
  assert.ok(board.intake.rows.every(row => !String(row.gap).includes('-')));
  assert.strictEqual(board.meals[0].summary, '石锅拌饭 一份');
  assert.strictEqual(repo.diet.intakeMarks('2026-10-17', '2026-10-17')['2026-10-17'], 614);
  const edited = repo.diet.updateEntry('2026-10-17', entry.id, { carbsG: 80, proteinG: 20, fatG: 20 });
  assert.strictEqual(edited.ok, true, edited.message);
  assert.strictEqual(edited.data.entry.kcal, 580);
  const migrated = P.migrateEntry(saved.data.entries[0]);
  assert.strictEqual(migrated.name, '石锅拌饭');
  assert.strictEqual(migrated.kcal, 614);
  assert.strictEqual(migrated.source, 'ai-text');
  const older = fresh();
  assert.strictEqual(older.repo.diet.commit({ mode: 'taper', refWeightKg: 80, energyMode: 'absolute_target', absoluteTarget: 2400, macroMode: 's4b' }).ok, true);
  const plain = older.repo.diet.addNutrient('2026-10-17', { carbsG: 10, proteinG: 20, fatG: 5, meal: 'lunch' });
  assert.strictEqual(older.repo.diet.dayBoard('2026-10-17').intake.kcalLine, '165 / 2400 kcal');
  const moved = older.repo.diet.updateEntry('2026-10-17', plain.data.entries[0].id, { carbsG: 11, proteinG: 20, fatG: 5 });
  assert.strictEqual(moved.data.entry.kcal, undefined);
  assert.strictEqual(older.repo.diet.dayBoard('2026-10-17').totals.kcal, 169);
  const batch = fresh();
  assert.strictEqual(batch.repo.diet.commit({ mode: 'taper', refWeightKg: 80, energyMode: 'absolute_target', absoluteTarget: 2400, macroMode: 's4b' }).ok, true);
  const two = batch.repo.diet.addAiEntries('2026-10-17', [
    { meal: 'lunch', name: '米饭', portion: '一碗', kcal: 200, carbsG: 45, proteinG: 4, fatG: 1, eatenAt: '12:30' },
    { meal: 'lunch', name: '饺子', portion: '6个', kcal: 250, carbsG: 30, proteinG: 12, fatG: 8, eatenAt: '12:30' },
  ]);
  assert.strictEqual(two.ok, true, two.message);
  assert.strictEqual(two.data.entries.length, 2);
  assert.ok(two.data.entries.every(e => e.meal === 'lunch' && e.source === 'ai-text' && e.kind === 'nutrient'));
  assert.deepStrictEqual(two.data.entries.map(e => e.name), ['米饭', '饺子']);
  const splitBoard = batch.repo.diet.dayBoard('2026-10-17');
  assert.strictEqual(splitBoard.totals.kcal, 450);
  assert.strictEqual(splitBoard.intake.kcalLine, '450 / 2400 kcal');
  assert.strictEqual(splitBoard.intake.remain, '剩余 1950 kcal');
  assert.strictEqual(splitBoard.meals.length, 1);
  assert.ok(splitBoard.meals[0].summary.includes('米饭') && splitBoard.meals[0].summary.includes('饺子'));
  const before = batch.repo.diet.getLog('2026-10-17').entries.length;
  const rejected = batch.repo.diet.addAiEntries('2026-10-17', [
    { meal: 'lunch', name: '可乐', kcal: 140, carbsG: 35, proteinG: 0, fatG: 0 },
    { meal: 'lunch', name: '', kcal: 1, carbsG: 1, proteinG: 1, fatG: 1 },
  ]);
  assert.strictEqual(rejected.ok, false);
  assert.strictEqual(batch.repo.diet.getLog('2026-10-17').entries.length, before);
});

test('client falls back across models, then the cloud function, without a key', async () => {
  const call = require('../pages/diet-ai/input/call');
  const seen = [];
  const content = await call.recognize('一个鸡蛋', { wx: { cloud: { extend: { AI: { createModel: () => ({ generateText({ model }) {
    seen.push(model);
    if (model === 'hy3') return Promise.reject(new Error('model not enabled'));
    return Promise.resolve({ choices: [{ message: { content: '{"food":true,"name":"鸡蛋"}' } }] });
  } }) } } } } });
  assert.deepStrictEqual(seen, ['hy3', 'deepseek-v4.1-flash']);
  assert.ok(content.includes('鸡蛋'));
  let payload = null;
  const viaFn = await call.recognize('一个鸡蛋', { wx: { cloud: { callFunction(o) {
    payload = o.data;
    o.success({ result: { ok: true, content: '{"food":true}' } });
  } } } });
  assert.strictEqual(payload.text, '一个鸡蛋');
  assert.strictEqual(viaFn, '{"food":true}');
  const prompt = require('../pages/diet-ai/prompt').SYSTEM;
  const fn = fs.readFileSync(path.join(__dirname, '../cloudfunctions/diet-recognize/index.js'), 'utf8');
  assert.ok(fn.includes(prompt));
  assert.ok(prompt.includes('items') && prompt.includes('米饭饺子') && prompt.includes('鸡腿饭加可乐') && prompt.includes('豆浆油条'));
  assert.ok(prompt.includes('番茄炒蛋') && prompt.includes('牛肉面') && prompt.includes('石锅拌饭') && prompt.includes('鸡蛋灌饼'));
  assert.ok(!prompt.includes('多种食物合并') && !prompt.includes('不要输出数组'));
  assert.ok(!/api[_-]?key|secret\s*[:=]|sk-/i.test(fn));
  const page = fs.readFileSync(path.join(__dirname, '../pages/diet-ai/result/result.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/diet-ai/result/result.wxml'), 'utf8');
  assert.ok(page.includes('addAiEntries'));
  assert.ok(wxml.includes('wx:for="{{items}}"') && wxml.includes('删除'));
});

test('calendar compact kcal stays short', () => {
  assert.strictEqual(P.compactKcal(614), '614');
  assert.strictEqual(P.compactKcal(1200), '1.2k');
  assert.strictEqual(P.compactKcal(10000), '10k');
  assert.strictEqual(P.mealAt('19:00'), 'dinner');
  assert.strictEqual(P.mealAt('08:30'), 'breakfast');
});
