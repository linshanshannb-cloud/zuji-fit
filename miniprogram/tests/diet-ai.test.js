const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Ai = require('../utils/diet-ai');
const P = require('../utils/diet-present');
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

test('several foods in one reply collapse into a single entry', () => {
  const r = Ai.assess([
    { food: true, name: '鸡蛋', kcal: 70, carbsG: 1, proteinG: 6, fatG: 5 },
    { food: true, name: '牛奶', kcal: 80, carbsG: 5, proteinG: 4, fatG: 4 },
  ]);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.data.name, '鸡蛋、牛奶');
  assert.strictEqual(r.data.kcal, 150);
  assert.strictEqual(r.data.proteinG, 10);
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
  assert.ok(!/api[_-]?key|secret\s*[:=]|sk-/i.test(fn));
});

test('calendar compact kcal stays short', () => {
  assert.strictEqual(P.compactKcal(614), '614');
  assert.strictEqual(P.compactKcal(1200), '1.2k');
  assert.strictEqual(P.compactKcal(10000), '10k');
  assert.strictEqual(P.mealAt('19:00'), 'dinner');
  assert.strictEqual(P.mealAt('08:30'), 'breakfast');
});
