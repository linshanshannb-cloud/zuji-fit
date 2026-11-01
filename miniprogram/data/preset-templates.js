// 组迹 1.0.2 精选训练模板。每套固定 4 个动作。
// id 对应内置动作库；中文名由动作库现查，不在这里再写一份，避免两处名称漂移。
// 居家套全部是自重。健身房五套按胸 / 肩 / 背 / 腿 / 手臂各选馆内常见动作。
module.exports = [
  {
    id: 'preset_home_full',
    title: '居家全身自重',
    scene: '居家',
    focus: '全身',
    blurb: '不用去健身房。推、蹲、拉和核心各一个动作，在家就能练完。',
    exerciseIds: ['0662', '3948', '0499', '0463'],
  },
  {
    id: 'preset_gym_chest',
    title: '健身房 · 胸',
    scene: '健身房',
    focus: '胸',
    bodyPart: 'chest',
    blurb: '杠铃卧推打底，上斜卧推、飞鸟和夹胸把胸部补全。',
    exerciseIds: ['0025', '0314', '0308', '1270'],
  },
  {
    id: 'preset_gym_shoulders',
    title: '健身房 · 肩',
    scene: '健身房',
    focus: '肩',
    bodyPart: 'shoulders',
    blurb: '推举加上前束、侧束和后束，覆盖整个肩部。',
    exerciseIds: ['1162', '0310', '0334', '0378'],
  },
  {
    id: 'preset_gym_back',
    title: '健身房 · 背',
    scene: '健身房',
    focus: '背',
    bodyPart: 'back',
    blurb: '下拉、杠铃划船、坐姿划船和直臂下拉，练宽度也练厚度。',
    exerciseIds: ['0150', '0027', '0861', '0238'],
  },
  {
    id: 'preset_gym_legs',
    title: '健身房 · 腿',
    scene: '健身房',
    focus: '腿',
    bodyPart: 'legs',
    blurb: '深蹲、罗马尼亚硬拉、腿举和腿弯举，前后侧都照顾到。',
    exerciseIds: ['0043', '0085', '0739', '0586'],
  },
  {
    id: 'preset_gym_arms',
    title: '健身房 · 手臂',
    scene: '健身房',
    focus: '手臂',
    bodyPart: 'arms',
    blurb: '弯举和臂屈伸各两个，二头、三头一起练。',
    exerciseIds: ['0031', '0313', '0201', '0351'],
  },
];
