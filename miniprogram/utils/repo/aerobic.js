// 有氧会话独立实体（PRD Q03）：本地数组 fit_aerobics，不占用力量 draft。
const S = require('../storage');
const K = require('./keys');
const V = require('./validate');
const C = require('./core');
const { newId } = require('./ids');
const T = require('../aerobic-types');

const KEY = K.AEROBICS;
const all = () => S.getTyped(KEY, 'array', []);
const sortByDate = list => list.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt));

function list({ status = 'completed', from = '', to = '' } = {}) {
  return all().filter(a => a && (!status || a.status === status) && (!from || a.date >= from) && (!to || a.date <= to))
    .map(a => Object.assign({}, a));
}
const get = id => { const a = all().find(x => x.id === id); return a ? Object.assign({}, a) : null; };
const onDate = date => list({ from: date, to: date });
function completedDates(from, to) {
  const m = {};
  list({ from, to }).forEach(a => { m[a.date] = (m[a.date] || 0) + 1; });
  return m;
}

function validatePayload(input, { requireName = true } = {}) {
  const date = C.check(V.validateDate(input.date, { today: C.today() }));
  const activityType = String(input.activityType || '').trim();
  if (!T.BY_KEY[activityType]) C.raise('INVALID_TYPE', '请选择有氧类型');
  let activityName = '';
  if (activityType === 'custom') {
    activityName = C.check(V.validateText(input.activityName, T.NAME_MAX, 'NAME_TOO_LONG'));
    if (requireName && !activityName) C.raise('NAME_REQUIRED', '请填写自定义名称');
  } else {
    activityName = T.BY_KEY[activityType].name;
  }
  const durRaw = String(input.durationMin == null ? '' : input.durationMin).trim();
  const durationMin = Number(durRaw);
  if (!/^\d+$/.test(durRaw) || !Number.isInteger(durationMin)) C.raise('INVALID_DURATION', '时长必须是正整数分钟');
  if (durationMin < T.DUR_MIN || durationMin > T.DUR_MAX) C.raise('INVALID_DURATION', `时长需在 ${T.DUR_MIN}–${T.DUR_MAX} 分钟`);
  const kcalRaw = String(input.estimatedKcal == null ? '' : input.estimatedKcal).trim();
  const estimatedKcal = Number(kcalRaw);
  if (!/^\d+$/.test(kcalRaw) || !Number.isInteger(estimatedKcal)) C.raise('INVALID_KCAL', '热量必须是正整数');
  if (estimatedKcal < T.KCAL_MIN || estimatedKcal > T.KCAL_MAX) C.raise('INVALID_KCAL', `热量需在 ${T.KCAL_MIN}–${T.KCAL_MAX} kcal`);
  const kcalSource = input.kcalSource === 'user_override' ? 'user_override' : 'reference';
  const note = C.check(V.validateText(input.note, V.LIMITS.workoutNote));
  return { date, activityType, activityName, durationMin, estimatedKcal, kcalSource, note };
}

function create(input = {}) {
  return C.guard(() => {
    C.writable();
    const fields = validatePayload(input);
    const t = C.now();
    const rec = Object.assign({
      id: newId('a_', t), status: 'completed', createdAt: t, updatedAt: t,
    }, fields);
    S.set(KEY, sortByDate(all().concat([rec])));
    return C.ok(rec);
  });
}

function update(id, input = {}) {
  return C.guard(() => {
    C.writable();
    const list0 = all();
    const old = list0.find(x => x.id === id);
    if (!old) C.raise('NOT_FOUND', '有氧记录不存在');
    const fields = validatePayload(Object.assign({}, old, input));
    const rec = Object.assign({}, old, fields, { updatedAt: C.now(), status: 'completed' });
    S.set(KEY, sortByDate(list0.filter(x => x.id !== id).concat([rec])));
    return C.ok(rec);
  });
}

function remove(id) {
  return C.guard(() => {
    C.writable();
    const list0 = all();
    if (!list0.some(x => x.id === id)) C.raise('NOT_FOUND', '有氧记录不存在');
    S.set(KEY, list0.filter(x => x.id !== id));
    return C.ok(true);
  });
}

// 日历卡片摘要
function daySummaries(date) {
  return onDate(date).map(a => ({
    id: a.id,
    kind: 'aerobic',
    title: a.activityName,
    durationMin: a.durationMin,
    estimatedKcal: a.estimatedKcal,
    kcalSource: a.kcalSource,
    createdAt: a.createdAt,
    activityType: a.activityType,
  }));
}

module.exports = {
  KEY, list, get, onDate, completedDates, create, update, remove, daySummaries,
  estimateKcal: T.estimateKcal, types: T.TYPES, refNote: T.REF_NOTE,
};
