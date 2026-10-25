// UI 部位选项 ↔ 存储字段。臀不在 bodyPart 枚举里，用 legs + target=glutes（与 muscle.groupOf 一致）。
const PARTS = [
  { key: 'chest', zh: '胸', bodyPart: 'chest', target: '' },
  { key: 'back', zh: '背', bodyPart: 'back', target: '' },
  { key: 'shoulders', zh: '肩', bodyPart: 'shoulders', target: '' },
  { key: 'arms', zh: '手臂', bodyPart: 'arms', target: '' },
  { key: 'legs', zh: '腿', bodyPart: 'legs', target: '' },
  { key: 'glutes', zh: '臀', bodyPart: 'legs', target: 'glutes' },
  { key: 'core', zh: '核心', bodyPart: 'core', target: '' },
];

function partKeyOf(ex) {
  if (!ex) return 'chest';
  if (ex.target === 'glutes' && (ex.bodyPart === 'legs' || !ex.bodyPart)) return 'glutes';
  const hit = PARTS.find(p => p.bodyPart === ex.bodyPart && p.key !== 'glutes');
  return hit ? hit.key : 'chest';
}

function payloadOf(key) {
  return PARTS.find(p => p.key === key) || PARTS[0];
}

module.exports = { PARTS, partKeyOf, payloadOf };
