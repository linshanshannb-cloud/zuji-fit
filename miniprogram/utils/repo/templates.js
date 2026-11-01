// 训练模板：6 套内置精选 + 用户复制到本机的副本（fit_templates）。
// 精选不写存储。复制只增加「我的模板」；套用才写入力量训练。与饮食键无关。
const S = require('../storage');
const K = require('./keys');
const C = require('./core');
const V = require('./validate');
const { newId } = require('./ids');
const exRepo = require('./exercises');
const workouts = require('./workouts');
const PRESETS = require('../../data/preset-templates');

function readMine() { return S.getTyped(K.TEMPLATES, 'array', []); }
function writeMine(list) { S.set(K.TEMPLATES, list); }

function present(raw, kind) {
  const exercises = (raw.exerciseIds || []).map(id => {
    const ex = exRepo.get(id);
    const unknown = !ex || !!ex.unknown;
    return {
      id, name: unknown ? '未知动作' : ex.nameZh, unknown,
      part: unknown ? '' : exRepo.zhOf('bodyPart', ex.bodyPart),
      equipment: unknown ? '' : exRepo.zhOf('equipment', ex.equipment),
      equipmentValue: unknown ? '' : ex.equipment,
      bodyPart: unknown ? '' : ex.bodyPart,
    };
  });
  return {
    id: raw.id, title: raw.title || '', scene: raw.scene || '', focus: raw.focus || '', blurb: raw.blurb || '',
    kind, sourcePresetId: raw.sourcePresetId || '', bodyPart: raw.bodyPart || '',
    count: exercises.length, line: exercises.map(e => e.name).join('、'), exercises,
    createdAt: raw.createdAt || 0, updatedAt: raw.updatedAt || 0,
  };
}
function usableMine(x) { return !!(x && typeof x.id === 'string' && Array.isArray(x.exerciseIds) && x.exerciseIds.length); }
function assertKnown(ids) {
  if (!ids || !ids.length) C.raise('EMPTY_TEMPLATE', '模板里没有动作');
  ids.forEach(id => {
    const ex = exRepo.get(id);
    if (!ex || ex.unknown) C.raise('UNKNOWN_EXERCISE', '动作不存在，不能套用');
    if (ex.archived) C.raise('ARCHIVED_EXERCISE', '该动作已删除，不能再套用');
  });
}
function findRaw(id) {
  const preset = PRESETS.find(x => x.id === id);
  if (preset) return { raw: preset, kind: 'preset' };
  const mine = readMine().find(x => x && x.id === id);
  if (mine && usableMine(mine)) return { raw: mine, kind: 'mine' };
  return null;
}

function listPresets() { return PRESETS.map(p => present(p, 'preset')); }
function listMine() {
  return readMine().filter(usableMine).map(x => present(x, 'mine'))
    .sort((a, b) => (b.updatedAt - a.updatedAt) || (b.createdAt - a.createdAt));
}
function get(id) { const f = findRaw(id); return f ? present(f.raw, f.kind) : null; }

// 复制精选 → 我的模板。不改当天训练，也不改精选本身。
function copyPreset(id) {
  return C.guard(() => {
    C.writable();
    const p = PRESETS.find(x => x.id === id);
    if (!p) C.raise('NOT_FOUND', '模板不存在');
    assertKnown(p.exerciseIds);
    const t = C.now();
    const rec = {
      id: newId('t_', t), title: p.title, scene: p.scene, focus: p.focus, blurb: p.blurb,
      bodyPart: p.bodyPart || '', exerciseIds: p.exerciseIds.slice(), sourcePresetId: p.id, createdAt: t, updatedAt: t,
    };
    writeMine([rec].concat(readMine()));
    return C.ok(present(rec, 'mine'));
  });
}
function renameMine(id, title) {
  return C.guard(() => {
    C.writable();
    const titleText = C.check(V.validateText(title, V.LIMITS.workoutName));
    if (!titleText) C.raise('NAME_REQUIRED', '请输入模板名称');
    const list = readMine();
    if (!list.some(x => x && x.id === id)) C.raise('NOT_FOUND', '模板不存在');
    const now = C.now();
    const next = list.map(x => (x && x.id === id ? Object.assign({}, x, { title: titleText, updatedAt: now }) : x));
    writeMine(next);
    return C.ok(present(next.find(x => x.id === id), 'mine'));
  });
}
function removeMine(id) {
  return C.guard(() => {
    C.writable();
    const list = readMine();
    if (!list.some(x => x && x.id === id)) C.raise('NOT_FOUND', '模板不存在');
    writeMine(list.filter(x => !x || x.id !== id));
    return C.ok(true);
  });
}

// 套用到力量训练。
// - 传入 workoutId：把动作追加到这条训练（训练编辑页）。
// - 否则：为 date（默认今天）新建草稿并写入全部动作。已有草稿时返回 DRAFT_EXISTS，由页面决定继续或放弃。
// 任一动作不可用时整单失败，不写一半。
function apply({ id, date, workoutId } = {}) {
  return C.guard(() => {
    C.writable();
    const found = findRaw(id);
    if (!found) C.raise('NOT_FOUND', '模板不存在');
    const ids = found.raw.exerciseIds.slice();
    assertKnown(ids);
    if (workoutId) {
      const r = workouts.addExercises(workoutId, ids);
      if (!r.ok) return r;
      return C.ok({ mode: 'append', workoutId, added: r.data.length });
    }
    const day = date || C.today();
    C.check(V.validateDate(day, { today: C.today() }));
    const existing = workouts.getDraft();
    if (existing) return C.fail('DRAFT_EXISTS', '已有未完成的训练，继续还是放弃？', { data: existing });
    const created = workouts.createDraft({ date: day, name: found.raw.title, exerciseIds: ids });
    if (!created.ok) return created;
    return C.ok({ mode: 'create', workoutId: created.data.id, added: ids.length });
  });
}

module.exports = { listPresets, listMine, get, copyPreset, renameMine, removeMine, apply };
