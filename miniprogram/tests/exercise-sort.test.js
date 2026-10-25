// 动作库同部位媒体排序：有图有视频 → 有图 → 无图有视频 → 无图无视频；缺图垫底。
const test = require('node:test');
const assert = require('node:assert');
const SORT = require('../utils/exercise-sort');
const M = require('../utils/muscle');
const data = require('../data/exercises.js').list;

test('mediaTier: image+video < image < video-only < neither', () => {
  assert.strictEqual(SORT.mediaTier({ poster: '/a.jpg', video: 'cloud://x' }), 0);
  assert.strictEqual(SORT.mediaTier({ illustration: 'assets/x.png' }), 1);
  assert.strictEqual(SORT.mediaTier({ video: 'cloud://x' }), 2);
  assert.strictEqual(SORT.mediaTier({ id: 'z' }), 3);
  assert.ok(SORT.hasImage({ poster: '/a.jpg' }));
  assert.ok(SORT.hasImage({ illustration: '/b.png' }));
  assert.ok(!SORT.hasImage({}));
  assert.ok(SORT.hasVideo({ video: 'cloud://x' }));
  assert.ok(!SORT.hasVideo({}));
});

test('compareByMedia: within same group, rich media first; custom before builtin at same tier', () => {
  const a = { id: 'z', poster: '/p.jpg', video: 'cloud://v' };
  const b = { id: 'a', illustration: '/i.png' };
  const c = { id: 'm', video: 'cloud://v' };
  const d = { id: 'b' };
  const customBare = { id: 'c_1', custom: true };
  const sorted = SORT.sortByMedia([d, customBare, c, b, a]);
  assert.deepStrictEqual(sorted.map(e => e.id), ['z', 'a', 'm', 'c_1', 'b']);
});

test('compareCustomTab: media first, then updatedAt desc', () => {
  const list = [
    { id: 'c_old', custom: true, updatedAt: 1, poster: '/p.jpg', video: 'cloud://v' },
    { id: 'c_new', custom: true, updatedAt: 9, poster: '/p.jpg', video: 'cloud://v' },
    { id: 'c_bare', custom: true, updatedAt: 99 },
  ];
  const sorted = list.slice().sort(SORT.compareCustomTab);
  assert.deepStrictEqual(sorted.map(e => e.id), ['c_new', 'c_old', 'c_bare']);
});

test('built-in chest: all with image appear before any without image', () => {
  const chest = data.filter(e => M.groupOf(e) === 'chest');
  const sorted = SORT.sortByMedia(chest);
  let seenNoImg = false;
  for (const e of sorted) {
    if (!SORT.hasImage(e)) seenNoImg = true;
    else assert.ok(!seenNoImg, 'image exercise after a no-image one: ' + e.id);
  }
  const tiers = sorted.map(SORT.mediaTier);
  for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] >= tiers[i - 1], 'tier non-decreasing');
});
