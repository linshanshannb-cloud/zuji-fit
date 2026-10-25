// 一级菜单：按肌肉部位分组。映射自 bodyPart（+ legs 下 target=glutes 归「臀」）。
const GROUPS = [
  { key: 'chest', zh: '胸' },
  { key: 'back', zh: '背' },
  { key: 'shoulders', zh: '肩' },
  { key: 'arms', zh: '手臂' },
  { key: 'legs', zh: '腿' },
  { key: 'glutes', zh: '臀' },
  { key: 'core', zh: '核心/腹' },
  { key: 'other', zh: '全身/其他' },
];
const KNOWN = { chest: 1, back: 1, shoulders: 1, arms: 1, legs: 1, core: 1 };
function groupOf(ex) {
  if (!ex || ex.unknown) return 'other';
  const bp = ex.bodyPart;
  if (ex.target === 'glutes' && (bp === 'legs' || !bp)) return 'glutes';
  return KNOWN[bp] ? bp : 'other';
}
/** 返回 [{key, zh, count}]，含「全部」，隐藏 0 个的分组（全部除外） */
function tabs(list) {
  const counts = {};
  (list || []).forEach(e => { const g = groupOf(e); counts[g] = (counts[g] || 0) + 1; });
  return [{ key: '', zh: '全部', count: (list || []).length }]
    .concat(GROUPS.map(g => ({ key: g.key, zh: g.zh, count: counts[g.key] || 0 })).filter(g => g.count > 0));
}
const zhOf = k => (GROUPS.find(g => g.key === k) || { zh: '全部' }).zh;
module.exports = { GROUPS, groupOf, tabs, zhOf };
