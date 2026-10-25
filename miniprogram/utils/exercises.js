// Built-in exercise catalogue (read-only, bundled) + pure search/filter helpers.
const data = require('../data/exercises.js');
const builtin = data.list;
const filters = data.filters || {};
const byId = {}; builtin.forEach(e => { byId[e.id] = e; });
const opts = k => (filters[k] || []).map(o => ({ value: o.value, zh: o.zh, en: o.en, count: o.count }));
const zhOf = (k, v) => { const o = (filters[k] || []).find(x => x.value === v); return o ? o.zh : v; };
// muscles.json (optional, from data teammate): accept {value:{zh}} | {value:"zh"} | [{value,zh}]
function muscleZh(v) {
  const m = data.muscles;
  if (m) {
    if (Array.isArray(m)) { const o = m.find(x => x.value === v || x.id === v); if (o && o.zh) return o.zh; }
    else if (m[v]) return typeof m[v] === 'string' ? m[v] : m[v].zh || v;
  }
  const t = (filters.muscles || []).concat(filters.target || [], filters.secondary || []).find(x => x.value === v);
  return t ? t.zh : v;
}
function search(list, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return list;
  return list.filter(e => (e.nameZh || '').toLowerCase().includes(s) || (e.nameEn || '').toLowerCase().includes(s));
}
// {q, bodyPart, equipment, target} — target matches primary target; set includeSecondary to also match secondary.
function filter(list, { q = '', bodyPart = '', equipment = '', target = '', includeSecondary = false } = {}) {
  return search(list, q).filter(e => (!bodyPart || e.bodyPart === bodyPart) && (!equipment || e.equipment === equipment) &&
    (!target || e.target === target || (includeSecondary && (e.secondary || []).includes(target))));
}
const unknownExercise = id => ({ id, unknown: true, nameZh: '未知动作', nameEn: '', bodyPart: '', equipment: '', target: '', secondary: [], steps: [], description: '' });
// Display-ready copy (Chinese labels), used by pages.
function display(e) {
  return Object.assign({}, e, { bodyPartZh: zhOf('bodyPart', e.bodyPart), equipmentZh: zhOf('equipment', e.equipment),
    targetZh: e.target ? muscleZh(e.target) : '', secondaryZh: (e.secondary || []).map(muscleZh) });
}
module.exports = { builtin, byId, filters, source: data.source, placeholder: data.placeholder,
  bodyParts: opts('bodyPart'), equipments: opts('equipment'), bodyPartDetails: opts('bodyPartDetail'),
  muscles: opts('muscles').length ? opts('muscles') : opts('target').concat(opts('secondary')),
  // target-muscle filter options: muscles that actually occur as a primary target
  targets: (opts('muscles').length ? opts('muscles') : opts('target')).filter(o => builtin.some(e => e.target === o.value)),
  zhOf, muscleZh, search, filter, unknownExercise, display };
