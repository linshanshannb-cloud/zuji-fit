const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { fresh } = require('./helpers');
const K = require('../utils/repo/keys');
const S = require('../utils/storage');
const builtin = require('../utils/exercises').builtin;
const byId = {};
builtin.forEach(e => { byId[e.id] = e; });

const TITLES = ['居家全身自重', '健身房 · 胸', '健身房 · 肩', '健身房 · 背', '健身房 · 腿', '健身房 · 手臂'];
const GYM_PART = { '健身房 · 胸': 'chest', '健身房 · 肩': 'shoulders', '健身房 · 背': 'back', '健身房 · 腿': 'legs', '健身房 · 手臂': 'arms' };

test('6 套精选各 4 个动作，居家全自重，健身房按部位', () => {
  const { repo } = fresh(); repo.init();
  const list = repo.templates.listPresets();
  assert.deepStrictEqual(list.map(t => t.title), TITLES);
  assert.deepStrictEqual(list.map(t => t.kind), ['preset', 'preset', 'preset', 'preset', 'preset', 'preset']);
  list.forEach(t => {
    assert.strictEqual(t.count, 4, t.title);
    assert.strictEqual(new Set(t.exercises.map(e => e.id)).size, 4, t.title);
    t.exercises.forEach(e => {
      assert.ok(byId[e.id], e.id);
      assert.strictEqual(e.unknown, false);
      assert.strictEqual(e.name, byId[e.id].nameZh);
    });
  });
  assert.ok(list[0].exercises.every(e => e.equipmentValue === 'body_weight'), '居家套必须全是自重');
  list.slice(1).forEach(t => {
    assert.ok(t.exercises.every(e => e.bodyPart === GYM_PART[t.title]), t.title);
  });
  assert.strictEqual(repo.templates.listMine().length, 0);
  assert.strictEqual(repo.templates.get('preset_gym_chest').exercises[0].name, '杠铃卧推');
});

test('复制进本机，不改精选；改名、删除只动 fit_templates', () => {
  const { repo, be } = fresh(); repo.init();
  const copied = repo.templates.copyPreset('preset_home_full');
  assert.ok(copied.ok);
  assert.strictEqual(copied.data.kind, 'mine');
  assert.strictEqual(copied.data.sourcePresetId, 'preset_home_full');
  assert.deepStrictEqual(copied.data.exercises.map(e => e.id), ['0662', '3948', '0499', '0463']);
  assert.strictEqual(repo.templates.listPresets().length, 6);
  assert.strictEqual(be.data[K.TEMPLATES].length, 1);
  assert.strictEqual(be.data[K.WORKOUTS], undefined, '复制不写训练');
  const again = repo.templates.copyPreset('preset_home_full');
  assert.ok(again.ok && again.data.id !== copied.data.id);
  assert.strictEqual(repo.templates.renameMine(copied.data.id, '  在家练  ').data.title, '在家练');
  assert.strictEqual(repo.templates.renameMine(copied.data.id, '').code, 'NAME_REQUIRED');
  assert.strictEqual(repo.templates.renameMine(copied.data.id, '名'.repeat(31)).code, 'TEXT_TOO_LONG');
  assert.strictEqual(repo.templates.renameMine('preset_home_full', '不行').code, 'NOT_FOUND');
  assert.ok(repo.templates.removeMine(copied.data.id).ok);
  assert.strictEqual(repo.templates.get(copied.data.id), null);
  assert.strictEqual(repo.templates.get('preset_home_full').kind, 'preset');
  assert.strictEqual(repo.templates.listMine().length, 1);
  assert.strictEqual(repo.templates.copyPreset('nope').code, 'NOT_FOUND');
});

test('套用到指定日期会新建力量草稿；已有草稿不覆盖；坏动作整单失败', () => {
  const { repo, be } = fresh(); repo.init();
  const r = repo.templates.apply({ id: 'preset_gym_chest', date: '2026-10-16' });
  assert.deepStrictEqual([r.ok, r.data.mode, r.data.added], [true, 'create', 4]);
  const w = repo.workouts.getWorkout(r.data.workoutId);
  assert.strictEqual(w.name, '健身房 · 胸');
  assert.strictEqual(w.date, '2026-10-16');
  assert.strictEqual(w.status, 'draft');
  assert.deepStrictEqual(w.exercises.map(e => e.exerciseId), ['0025', '0314', '0308', '1270']);
  assert.ok(w.exercises.every(e => e.sets.length === 1 && e.sets[0].done === false && e.sets[0].reps == null));
  const blocked = repo.templates.apply({ id: 'preset_gym_back', date: '2026-10-16' });
  assert.strictEqual(blocked.code, 'DRAFT_EXISTS');
  assert.strictEqual(repo.workouts.listWorkouts({ status: 'draft' }).length, 1);
  assert.strictEqual(repo.templates.apply({ id: 'preset_gym_legs', date: '2026-10-18' }).code, 'FUTURE_DATE');
  assert.strictEqual(be.data[K.DIET_PLAN], undefined);
  assert.strictEqual(be.data[K.DIET_LOGS], undefined);
  assert.strictEqual(be.data[K.DIET_FOODS], undefined);
  repo.workouts.discardDraft();
  be.data[K.TEMPLATES] = [{ id: 't_bad', title: '坏模板', scene: '', focus: '', blurb: '', exerciseIds: ['0025', 'no-such'], sourcePresetId: '', createdAt: 1, updatedAt: 1 }];
  const bad = repo.templates.apply({ id: 't_bad', date: '2026-10-16' });
  assert.strictEqual(bad.code, 'UNKNOWN_EXERCISE');
  assert.strictEqual(repo.workouts.getDraft(), null, '未知动作不能留下半套训练');
});

test('从当前训练套用是追加；未落库的草稿会因此写入', () => {
  const { repo } = fresh(); repo.init();
  const pending = repo.workouts.createDraft({ date: '2026-10-17' }).data;
  assert.strictEqual(pending.persisted, false);
  const appended = repo.templates.apply({ id: 'preset_gym_arms', workoutId: pending.id });
  assert.deepStrictEqual([appended.ok, appended.data.mode, appended.data.added], [true, 'append', 4]);
  const w = repo.workouts.getWorkout(pending.id);
  assert.strictEqual(w.exercises.length, 4);
  assert.strictEqual(w.name, '', '追加不改训练名称');
  assert.strictEqual(repo.workouts.getPending(), null);
  const more = repo.templates.apply({ id: 'preset_home_full', workoutId: pending.id });
  assert.ok(more.ok);
  assert.strictEqual(repo.workouts.getWorkout(pending.id).exercises.length, 8);
});

test('损坏的 fit_templates 不会被当成空列表覆盖', () => {
  const { repo, be } = fresh({ [K.TEMPLATES]: { bad: true } }); repo.init();
  assert.deepStrictEqual(repo.templates.listMine(), []);
  assert.strictEqual(repo.templates.copyPreset('preset_home_full').code, 'DATA_CORRUPT');
  assert.deepStrictEqual(be.data[K.TEMPLATES], { bad: true });
});

test('只读不能复制或套用；饮食 Tab 与模板页同时留在 app.json', () => {
  const { repo } = fresh(); repo.init();
  S.setReadOnly(true);
  assert.strictEqual(repo.templates.copyPreset('preset_home_full').code, 'READ_ONLY');
  assert.strictEqual(repo.templates.apply({ id: 'preset_home_full', date: '2026-10-17' }).code, 'READ_ONLY');
  S.setReadOnly(false);
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8'));
  assert.ok(app.pages.includes('pages/templates/templates'));
  assert.ok(app.pages.includes('pages/template-detail/template-detail'));
  assert.ok(app.pages.includes('pages/diet/diet'));
  assert.deepStrictEqual(app.tabBar.list.map(t => t.text), ['日历', '动作库', '饮食', '身体数据']);
});
