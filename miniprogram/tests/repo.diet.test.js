const test = require('node:test');
const assert = require('node:assert');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const S = require('../utils/storage');

const TAPER = { mode: 'taper', refWeightKg: 80, energyMode: 'absolute_target', absoluteTarget: 2400, macroMode: 's4b' };

function stageCarbs(repo, date) { return repo.diet.dayTarget(date).carbsG; }

test('empty diet storage is an empty state, not zeros', () => {
  const { repo, be } = fresh();
  assert.strictEqual(repo.diet.problem(), null);
  assert.strictEqual(repo.diet.getPlan(), null);
  assert.strictEqual(repo.diet.dayTarget('2026-10-17'), null);
  const intake = repo.diet.presentIntake('2026-10-17');
  assert.strictEqual(intake.recorded, false);
  assert.strictEqual(intake.text, '未记录');
  assert.strictEqual(repo.diet.intakeSummary('2026-10-11', '2026-10-17').avg, null);
  assert.strictEqual(be.data[K.DIET_PLAN], undefined);
});

test('AC-01 taper defaults lock reference weight and ignore a later body-weight row (R1)', () => {
  const { repo, setTime } = fresh();
  repo.body.saveBody({ date: '2026-10-17', weightKg: 80 });
  const r = repo.diet.commit(TAPER);
  assert.strictEqual(r.ok, true, r.message);
  const stage = r.data.stage;
  assert.strictEqual(stage.params.macroMode, 's4b');
  assert.strictEqual(stage.params.fatPct, 0.225);
  assert.strictEqual(stage.params.proteinPerKg, 1.5);
  assert.strictEqual(stage.params.observeDays, 7);
  assert.deepStrictEqual([stage.carbsG, stage.proteinG, stage.fatG, stage.kcal], [345, 120, 60, 2400]);
  assert.strictEqual(stage.refWeightKg, 80);
  setTime(new Date(2026, 9, 18, 10, 0, 0).getTime());
  assert.strictEqual(repo.body.saveBody({ date: '2026-10-18', weightKg: 78 }).ok, true);
  const target = repo.diet.dayTarget('2026-10-18');
  assert.strictEqual(target.refWeightKg, 80);
  assert.strictEqual(target.proteinG, 120);
  assert.strictEqual(target.carbsG, 345);
  const draft = repo.diet.suggestion('stuck');
  assert.strictEqual(draft.ok, true);
  assert.strictEqual(draft.data.carbsG, 330);
  assert.strictEqual(repo.diet.dayTarget('2026-10-18').carbsG, 345, 'suggestion must not write');
});

test('R2 a confirmed stage does not rewrite the previous date', () => {
  const { repo, setTime } = fresh();
  assert.strictEqual(repo.diet.commit(TAPER).ok, true);
  assert.strictEqual(stageCarbs(repo, '2026-10-17'), 345);
  setTime(new Date(2026, 9, 18, 10, 0, 0).getTime());
  const next = repo.diet.commit(Object.assign({}, TAPER, { confirmExisting: true, reason: 'adjust', carbsG: 300, proteinG: 120, fatG: 60 }));
  assert.strictEqual(next.ok, true, next.message);
  assert.strictEqual(repo.diet.dayTarget('2026-10-17').carbsG, 345);
  assert.strictEqual(repo.diet.dayTarget('2026-10-18').carbsG, 300);
  assert.strictEqual(repo.diet.dayTarget('2026-10-17').stageId !== repo.diet.dayTarget('2026-10-18').stageId, true);
  assert.strictEqual(repo.diet.stages().length, 2);
  const switched = repo.diet.commit({
    mode: 'cycle', refWeightKg: 80, bodyType: 'endo', proteinPerKg: 1.2, confirmExisting: true, reason: 'switch',
  });
  assert.strictEqual(switched.ok, true, switched.message);
  assert.strictEqual(repo.diet.dayTarget('2026-10-17').mode, 'taper');
  assert.strictEqual(repo.diet.dayTarget('2026-10-18').mode, 'cycle');
  assert.ok(repo.diet.stages().some(s => s.mode === 'taper' && s.carbsG === 345));
});

test('AC-02 cycle days each expose kcal and the week is 2/3/2', () => {
  const { repo } = fresh();
  const r = repo.diet.commit({ mode: 'cycle', refWeightKg: 90, bodyType: 'endo', proteinPerKg: 1 });
  assert.strictEqual(r.ok, true, r.message);
  assert.strictEqual(r.data.stage.params.carbPerKg, 2);
  assert.strictEqual(r.data.stage.params.fatPerKg, 0.8);
  const mon = repo.diet.dayTarget('2026-10-19'); // Monday, default pattern high
  const tue = repo.diet.dayTarget('2026-10-20');
  const wed = repo.diet.dayTarget('2026-10-21');
  assert.deepStrictEqual([mon.dayType, tue.dayType, wed.dayType], ['high', 'mid', 'low']);
  assert.deepStrictEqual([mon.kcal, tue.kcal, wed.kcal], [1960, 1477, 1872]);
  assert.ok(mon.carbsG && mon.proteinG && mon.fatG);
  assert.ok(tue.kcal < mon.kcal && tue.kcal < wed.kcal);
  const ecto = repo.diet.preview({ mode: 'cycle', refWeightKg: 70, bodyType: 'ecto' });
  assert.strictEqual(ecto.ok, true);
  assert.strictEqual(ecto.data.params.carbPerKg, 3);
  assert.strictEqual(ecto.data.params.fatPerKg, 1.1);
  assert.strictEqual(ecto.data.params.proteinPerKg, 1.2);
  assert.strictEqual(repo.diet.getPlan().mode, 'cycle', 'preview must not replace the saved plan');
  const bad = repo.diet.commit({ mode: 'cycle', refWeightKg: 90, bodyType: 'endo', weekPattern: ['low', 'low', 'low', 'low', 'low', 'low', 'low'], confirmExisting: true });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(repo.diet.dayTarget('2026-10-19').kcal, 1960);
});

test('R3 unlogged days stay out of the denominator; clearing deletes the log', () => {
  const { repo, be } = fresh();
  const days = ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17'];
  days.forEach(d => { if (d !== '2026-10-12' && d !== '2026-10-14') assert.strictEqual(repo.diet.saveQuick(d, { carbsG: 10, proteinG: 20, fatG: 5 }).ok, true); });
  assert.strictEqual(repo.diet.presentIntake('2026-10-12').text, '未记录');
  const sum = repo.diet.intakeSummary('2026-10-11', '2026-10-17');
  assert.deepStrictEqual([sum.span, sum.logged, sum.unlogged], [7, 5, 2]);
  assert.strictEqual(sum.avg.carbsG, 10);
  const zeros = repo.diet.saveQuick('2026-10-12', { carbsG: 0, proteinG: 0, fatG: 0 });
  assert.strictEqual(zeros.ok, true);
  assert.strictEqual(repo.diet.presentIntake('2026-10-12').recorded, true);
  assert.strictEqual(repo.diet.intakeSummary('2026-10-11', '2026-10-17').logged, 6);
  assert.strictEqual(repo.diet.clearLog('2026-10-12').ok, true);
  assert.strictEqual(repo.diet.getLog('2026-10-12'), null);
  assert.ok(!(be.data[K.DIET_LOGS] || []).some(l => l.date === '2026-10-12'));
  assert.strictEqual(repo.diet.intakeSummary('2026-10-11', '2026-10-17').logged, 5);
  const food = repo.diet.addFood('2026-10-12', { foodId: 'ex-rice', basis: 'cooked', qty: 200 });
  assert.strictEqual(food.ok, true, food.message);
  assert.strictEqual(food.data.entries[0].carbsG, 50);
  assert.strictEqual(food.data.entries[0].basis, 'cooked');
  const quick = repo.diet.saveQuick('2026-10-12', { carbsG: 1, proteinG: 2, fatG: 3 });
  assert.strictEqual(quick.data.entries.length, 1);
  assert.strictEqual(quick.data.entries[0].kind, 'quick');
  assert.strictEqual(repo.diet.removeEntry('2026-10-12', quick.data.entries[0].id).data, null);
  assert.strictEqual(repo.diet.presentIntake('2026-10-12').text, '未记录');
});

test('R6 basis is required; oral examples cannot pretend to be per serving; custom foods keep one basis', () => {
  const { repo } = fresh();
  const missing = repo.diet.addFood('2026-10-17', { foodId: 'ex-rice', qty: 100 });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.code, 'BASIS_REQUIRED');
  assert.strictEqual(repo.diet.getLog('2026-10-17'), null);
  const serving = repo.diet.addFood('2026-10-17', { foodId: 'ex-mantou', basis: 'perServing', qty: 1 });
  assert.strictEqual(serving.ok, false);
  const custom = repo.diet.saveCustomFood({ name: '鸡胸', basis: 'perServing', carbsG: 0, proteinG: 30, fatG: 3 });
  assert.strictEqual(custom.ok, true, custom.message);
  const mix = repo.diet.addFood('2026-10-17', { foodId: custom.data.id, basis: 'raw', qty: 100 });
  assert.strictEqual(mix.ok, false);
  const ok = repo.diet.addFood('2026-10-17', { foodId: custom.data.id, basis: 'perServing', qty: 2 });
  assert.strictEqual(ok.ok, true, ok.message);
  assert.strictEqual(ok.data.entries[0].proteinG, 60);
  assert.strictEqual(ok.data.entries[0].basis, 'perServing');
  const unnamed = repo.diet.saveCustomFood({ name: '', basis: 'raw', carbsG: 1, proteinG: 1, fatG: 1 });
  assert.strictEqual(unnamed.ok, false);
});

test('floor stops at 40% of the taper anchor, prefs do not move targets, corrupt plan is not overwritten', () => {
  const { repo, be } = fresh();
  assert.strictEqual(repo.diet.commit(TAPER).ok, true);
  const info = repo.diet.floorInfo();
  assert.strictEqual(info.anchorG, 345);
  assert.strictEqual(info.floorG, 138);
  assert.strictEqual(info.atFloor, false);
  const before = repo.diet.dayTarget('2026-10-17').kcal;
  assert.strictEqual(repo.diet.updatePrefs({ showBlogMap: true, carbFloorG: 340 }).ok, true);
  assert.strictEqual(repo.diet.getPlan().showBlogMap, true);
  assert.strictEqual(repo.diet.floorInfo().floorG, 340);
  assert.strictEqual(repo.diet.dayTarget('2026-10-17').kcal, before);
  const low = repo.diet.suggestion('stuck');
  assert.strictEqual(low.data.carbsG, 340);
  assert.ok(low.data.floorNote);
  assert.strictEqual(repo.diet.dayTarget('2026-10-17').carbsG, 345);
  S.setReadOnly(true);
  assert.strictEqual(repo.diet.commit(Object.assign({}, TAPER, { confirmExisting: true })).code, 'READ_ONLY');
  S.setReadOnly(false);
  const broken = fresh({ [K.DIET_PLAN]: 'not-an-object' });
  assert.ok(broken.repo.diet.problem());
  assert.strictEqual(broken.repo.diet.getPlan(), null);
  const refused = broken.repo.diet.commit(TAPER);
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(broken.be.data[K.DIET_PLAN], 'not-an-object');
});

test('taper TDEE path uses Mifflin-St Jeor times the chosen activity factor, then minus 20%', () => {
  const { repo } = fresh();
  const r = repo.diet.commit({
    mode: 'taper', refWeightKg: 80, sex: 'male', age: 25, heightCm: 180, activity: 'moderate', energyMode: 'tdee_pct',
  });
  assert.strictEqual(r.ok, true, r.message);
  const p = r.data.stage.params;
  assert.strictEqual(p.bmr, 1805);
  assert.strictEqual(p.tdee, 1805 * 1.55);
  assert.ok(Math.abs(p.targetKcal - 1805 * 1.55 * 0.8) < 1e-6);
  assert.strictEqual(p.deficitPct, 20);
  assert.strictEqual(r.data.stage.proteinG, 120);
  const bad = repo.diet.commit({ mode: 'nope', refWeightKg: 80, confirmExisting: true });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(repo.diet.getPlan().mode, 'taper');
});

test('three days without a log is a streak, and a log breaks it', () => {
  const { repo, setTime } = fresh();
  assert.strictEqual(repo.diet.commit(TAPER).ok, true);
  assert.strictEqual(repo.diet.noLogStreak('2026-10-17', repo.diet.planStart()), 1);
  setTime(new Date(2026, 9, 19, 10, 0, 0).getTime());
  assert.strictEqual(repo.diet.noLogStreak('2026-10-19', '2026-10-17'), 3);
  assert.strictEqual(repo.diet.saveQuick('2026-10-18', { carbsG: 1, proteinG: 1, fatG: 1 }).ok, true);
  assert.strictEqual(repo.diet.noLogStreak('2026-10-19', '2026-10-17'), 1);
});
