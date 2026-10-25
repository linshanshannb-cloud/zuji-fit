const test = require('node:test');
const assert = require('node:assert');
const P = require('../utils/custom-part');
const { fresh } = require('./helpers');

test('custom-part maps 臀 to legs+glutes and reverse', () => {
  assert.strictEqual(P.PARTS.length, 7);
  assert.deepStrictEqual(P.payloadOf('glutes'), { key: 'glutes', zh: '臀', bodyPart: 'legs', target: 'glutes' });
  assert.strictEqual(P.partKeyOf({ bodyPart: 'legs', target: 'glutes' }), 'glutes');
  assert.strictEqual(P.partKeyOf({ bodyPart: 'legs', target: 'quads' }), 'legs');
  assert.strictEqual(P.partKeyOf({ bodyPart: 'chest' }), 'chest');
  assert.strictEqual(P.payloadOf('core').bodyPart, 'core');
});

test('custom exercise via UI payload lands in library and picker filter', () => {
  const { repo } = fresh();
  repo.init();
  const part = P.payloadOf('glutes');
  const r = repo.exercises.addCustom({
    nameZh: '臀桥自定', bodyPart: part.bodyPart, target: part.target, equipment: 'body_weight',
  });
  assert.ok(r.ok);
  assert.ok(repo.exercises.all().some(e => e.id === r.data.id && e.custom));
  const M = require('../utils/muscle');
  assert.strictEqual(M.groupOf(r.data), 'glutes');
  const filtered = repo.exercises.filter({ q: '臀桥自定' });
  assert.strictEqual(filtered[0].id, r.data.id);
  // unreferenced -> hard delete
  assert.deepStrictEqual(repo.deleteCustomExercise(r.data.id).data, { deleted: true });
});

test('cardOf exposes custom flag', () => {
  const CARD = require('../utils/card');
  const c = CARD.cardOf({ id: 'c_1', nameZh: '测', custom: true, equipment: 'band' }, () => '弹力带', '背');
  assert.strictEqual(c.custom, true);
  assert.strictEqual(CARD.cardOf({ id: '0025', nameZh: '卧推' }, () => '', '胸').custom, false);
});
