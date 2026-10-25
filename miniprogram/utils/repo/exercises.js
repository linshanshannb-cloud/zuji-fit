// Exercise repository: built-in (bundled) + custom (fit_custom_exercises). Custom first (§3.2).
const S = require('../storage');
const K = require('./keys');
const V = require('./validate');
const C = require('./core');
const E = require('../exercises');
const { newId } = require('./ids');
const CATEGORY_ZH = { strength: '力量', calisthenics: '自重训练', isometric: '等长训练' };
const bodyPartValues = () => E.bodyParts.map(o => o.value);
const equipmentValues = () => E.equipments.map(o => o.value);

// Read with heal: missing `custom` -> true (updatedAt untouched). Heal is in-memory; persisted by healCustom() at launch.
function rawCustom() { return S.getTyped(K.CUSTOM, 'array', []); }
function listCustom({ includeArchived = false } = {}) {
  return rawCustom().map(c => (c.custom === true ? c : Object.assign({}, c, { custom: true }))).filter(c => includeArchived || !c.archived);
}
function healCustom() {
  const raw = rawCustom();
  if (raw.some(c => c.custom !== true)) S.set(K.CUSTOM, raw.map(c => Object.assign({}, c, { custom: true })));
}
function all() { return listCustom().concat(E.builtin); }
// Never throws for unknown ids (§1 引用完整性): returns placeholder.
function get(id) {
  if (E.byId[id]) return E.byId[id];
  const c = listCustom({ includeArchived: true }).find(x => x.id === id);
  return c || E.unknownExercise(id);
}
const filter = (q) => E.filter(all(), q);

function buildCustom(input, base) {
  const nameZh = C.check(V.validateText(input.nameZh, V.LIMITS.customName));
  if (!nameZh) C.raise('NAME_REQUIRED', '请输入动作名称');
  if (!bodyPartValues().includes(input.bodyPart)) C.raise('INVALID_BODY_PART', '请选择部位');
  const equipment = input.equipment || 'body_weight';
  if (!equipmentValues().includes(equipment)) C.raise('INVALID_EQUIPMENT', '器械无效');
  const category = input.category || 'strength';
  if (!CATEGORY_ZH[category]) C.raise('INVALID_CATEGORY', '类别无效');
  const arr = v => (Array.isArray(v) ? v.map(String) : []);
  const muscles = E.muscles.map(o => o.value), details = E.bodyPartDetails.map(o => o.value);
  if (input.bodyPartDetail && !details.includes(input.bodyPartDetail)) C.raise('INVALID_BODY_PART_DETAIL', '细分部位无效');
  if (input.target && !muscles.includes(input.target)) C.raise('INVALID_MUSCLE', '目标肌群无效');
  if (arr(input.secondary).some(m => !muscles.includes(m))) C.raise('INVALID_MUSCLE', '次要肌群无效');
  return Object.assign({}, base, {
    nameZh, nameEn: String(input.nameEn || '').trim(), bodyPart: input.bodyPart, bodyPartDetail: String(input.bodyPartDetail || ''),
    target: String(input.target || ''), secondary: arr(input.secondary), equipment, category, categoryZh: CATEGORY_ZH[category],
    description: C.check(V.validateText(input.description, V.LIMITS.customDesc)), steps: arr(input.steps),
    translationPending: !!input.translationPending, untranslatedFields: arr(input.untranslatedFields) });
}
function addCustom(input = {}) {
  return C.guard(() => {
    C.writable();
    const t = C.now();
    const rec = buildCustom(input, { id: newId('c_', t), custom: true, archived: false, createdAt: t, updatedAt: t });
    const list = listCustom({ includeArchived: true });
    const duplicateName = list.concat(E.builtin).some(x => x.nameZh === rec.nameZh);
    S.set(K.CUSTOM, [rec].concat(list));
    return C.ok(rec, duplicateName ? { warning: 'DUPLICATE_NAME' } : undefined);
  });
}
function updateCustom(id, patch = {}) {
  return C.guard(() => {
    C.writable();
    const list = listCustom({ includeArchived: true }), old = list.find(c => c.id === id);
    if (!old) C.raise('NOT_FOUND', '动作不存在');
    const rec = buildCustom(Object.assign({}, old, patch), Object.assign({}, old, { updatedAt: C.now() }));
    S.set(K.CUSTOM, list.map(c => (c.id === id ? rec : c)));
    return C.ok(rec);
  });
}
// referencedIds: map of exerciseId -> true (from workouts repo; injected to avoid circular import).
function deleteCustom(id, referencedIds) {
  return C.guard(() => {
    C.writable();
    const list = listCustom({ includeArchived: true });
    if (!list.some(c => c.id === id)) C.raise('NOT_FOUND', '动作不存在');
    if (referencedIds && referencedIds[id]) {
      S.set(K.CUSTOM, list.map(c => (c.id === id ? Object.assign({}, c, { archived: true, updatedAt: C.now() }) : c)));
      return C.ok({ archived: true });
    }
    S.set(K.CUSTOM, list.filter(c => c.id !== id));
    return C.ok({ deleted: true });
  });
}
module.exports = { all, get, filter, listCustom, healCustom, addCustom, updateCustom, deleteCustom,
  bodyParts: E.bodyParts, equipments: E.equipments, targets: E.targets, display: E.display, zhOf: E.zhOf, muscleZh: E.muscleZh };
