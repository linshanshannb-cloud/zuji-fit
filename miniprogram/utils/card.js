// 动作库卡片数据：封面只用主包图片（视频海报 > 自制线稿），没有图就由 WXML 渲染 CSS 占位符。
const abs = p => (!p || typeof p !== 'string' ? '' : p.indexOf('://') > 0 || p[0] === '/' ? p : '/' + p);
function cardOf(e, zhOf, groupZh) {
  const img = abs(e.poster) || abs(e.illustration);
  return {
    id: e.id, nameZh: e.nameZh, pending: !!e.translationPending, custom: !!e.custom,
    img, hasVideo: !!e.video, initial: String(e.nameZh || '').slice(0, 1),
    part: groupZh || '', equip: zhOf ? zhOf('equipment', e.equipment) : '',
  };
}
module.exports = { cardOf, abs };
