const test = require('node:test'); const assert = require('node:assert');
const { fresh } = require('./helpers');
const E = require('../utils/exercises');
const V = require('../utils/repo/validate');

test('catalogue loaded from data/exercises.json with new fields', () => {
  assert.strictEqual(E.builtin.length, 284); assert.strictEqual(E.placeholder, false);
  const e = E.byId['0025'];
  for (const k of ['id', 'nameZh', 'nameEn', 'bodyPart', 'bodyPartDetail', 'target', 'secondary', 'equipment', 'category', 'categoryZh', 'description', 'steps', 'translationPending', 'untranslatedFields']) assert.ok(k in e, k);
  assert.strictEqual(typeof e.target, 'string');
  assert.deepStrictEqual(E.bodyParts.map(o => o.value), ['chest', 'back', 'shoulders', 'legs', 'arms', 'core']);
  assert.ok(E.equipments.some(o => o.value === 'body_weight'));
});
test('search zh/en, filter bodyPart/equipment/target', () => {
  assert.ok(E.search(E.builtin, '卧推').some(e => e.id === '0025'));
  assert.ok(E.search(E.builtin, 'BENCH PRESS').some(e => e.id === '0025'));
  assert.strictEqual(E.search(E.builtin, '').length, 284);
  const r = E.filter(E.builtin, { bodyPart: 'chest', equipment: 'barbell', target: E.byId['0025'].target });
  assert.ok(r.length > 0 && r.every(e => e.bodyPart === 'chest' && e.equipment === 'barbell' && e.target === 'chest'));
  const sec = E.filter(E.builtin, { target: 'triceps', includeSecondary: true });
  assert.ok(sec.length >= E.filter(E.builtin, { target: 'triceps' }).length && sec.length > 0);
  assert.strictEqual(E.display(E.byId['0025']).bodyPartZh, '胸');
  assert.strictEqual(E.muscleZh('chest'), '胸肌'); assert.ok(E.targets.length > 0 && E.targets.every(o => E.builtin.some(e => e.target === o.value)));
});
test('custom exercises: add/validate, listed first, heal, archive when referenced', () => {
  const { repo, be } = fresh({ fit_custom_exercises: [{ id: 'c_old', nameZh: '老动作', bodyPart: 'back', updatedAt: 5 }] });
  repo.init();
  assert.strictEqual(be.data.fit_custom_exercises[0].custom, true); assert.strictEqual(be.data.fit_custom_exercises[0].updatedAt, 5);
  assert.strictEqual(repo.exercises.addCustom({ nameZh: ' ' , bodyPart: 'back' }).code, 'NAME_REQUIRED');
  assert.strictEqual(repo.exercises.addCustom({ nameZh: 'x', bodyPart: 'neck' }).code, 'INVALID_BODY_PART');
  assert.strictEqual(repo.exercises.addCustom({ nameZh: 'x', bodyPart: 'back', equipment: 'rock' }).code, 'INVALID_EQUIPMENT');
  const c = repo.exercises.addCustom({ nameZh: '弹力带划船', bodyPart: 'back', equipment: 'band' });
  assert.ok(c.ok); assert.match(c.data.id, /^c_/); assert.strictEqual(c.data.categoryZh, '力量');
  assert.strictEqual(repo.exercises.addCustom({ nameZh: '杠铃卧推', bodyPart: 'chest' }).warning, 'DUPLICATE_NAME');
  assert.strictEqual(repo.exercises.all()[0].custom, true);
  assert.strictEqual(repo.exercises.filter({ q: '弹力带划船' })[0].id, c.data.id);
  for (const [inp, code] of [[{ bodyPartDetail: 'nose' }, 'INVALID_BODY_PART_DETAIL'], [{ target: 'wings' }, 'INVALID_MUSCLE'], [{ secondary: ['chest', 'wings'] }, 'INVALID_MUSCLE']])
    assert.strictEqual(repo.exercises.addCustom(Object.assign({ nameZh: 'y', bodyPart: 'back' }, inp)).code, code);
  assert.ok(repo.exercises.addCustom({ nameZh: 'z', bodyPart: 'chest', bodyPartDetail: 'chest', target: 'chest', secondary: ['delts'] }).ok);
  const w = repo.workouts.createDraft({ exerciseIds: [c.data.id] }).data;
  assert.deepStrictEqual(repo.deleteCustomExercise(c.data.id).data, { archived: true });
  assert.ok(!repo.exercises.all().some(e => e.id === c.data.id), 'hidden from library');
  assert.strictEqual(repo.workouts.getWorkout(w.id).exercises[0].displayName, '弹力带划船', 'history still resolves');
  assert.deepStrictEqual(repo.deleteCustomExercise('c_old').data, { deleted: true });
  assert.strictEqual(repo.workouts.addExercise(w.id, c.data.id).code, 'ARCHIVED_EXERCISE');
});
test('validators', () => {
  assert.deepStrictEqual(V.validateSetWeight(''), { ok: true, value: null });
  assert.strictEqual(V.validateSetWeight('999.9').value, 999.9); assert.strictEqual(V.validateSetWeight(0).value, 0);
  assert.strictEqual(V.validateReps('12').value, 12); assert.strictEqual(V.validateReps(null).value, null);
  assert.strictEqual(V.validateBodyWeight('0').ok, false); assert.strictEqual(V.validateBodyWeight('').code, 'WEIGHT_REQUIRED'); assert.strictEqual(V.validateBodyWeightOptional('').value, null); assert.strictEqual(V.validateBodyWeight('700').value, 700);
  assert.strictEqual(V.validateBodyFat('100.1').ok, false); assert.strictEqual(V.validateWaist('300').value, 300);
  assert.strictEqual(V.normalizeBodyFat(150), null); assert.strictEqual(V.normalizeWaist('81.55'), 81.6);
  assert.strictEqual(V.validateDate('2026-10-17', { today: '2026-10-16' }).code, 'FUTURE_DATE');
  for (const bad of [true, false, [], [5], '0x1A', '1e2', '５０', {}, NaN, Infinity]) assert.strictEqual(V.validateSetWeight(bad).ok, false, JSON.stringify(bad));
  for (const bad of [true, [3], '0x3', '1e1']) assert.strictEqual(V.validateReps(bad).ok, false, JSON.stringify(bad));
  assert.strictEqual(V.validateSetWeight(' 62.55 ').value, 62.6); assert.strictEqual(V.validateSetWeight('.5').value, 0.5);
  assert.strictEqual(V.validateBodyWeight('70abc').code, 'INVALID_BODY_WEIGHT');
});
