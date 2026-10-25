// 有氧类型清单 + 每小时参考 kcal（PRD §3.2 / §3.3；示例数据，非医学标准）
const REF_NOTE = '按参考体重约 70 kg 估算，非个体实测';
const TYPES = [
  { key: 'treadmill_incline', name: '跑步机爬坡', perHour: 500 },
  { key: 'stair_climber', name: '爬楼机', perHour: 550 },
  { key: 'elliptical', name: '椭圆仪', perHour: 450 },
  { key: 'run', name: '跑步', perHour: 600 },
  { key: 'cycle', name: '骑行', perHour: 500 },
  { key: 'row', name: '划船', perHour: 520 },
  { key: 'walk', name: '步行', perHour: 250 },
  { key: 'swim', name: '游泳', perHour: 550 },
  { key: 'jump_rope', name: '跳绳', perHour: 650 },
  { key: 'custom', name: '自定义', perHour: 400 },
];
const BY_KEY = {};
TYPES.forEach(t => { BY_KEY[t.key] = t; });

const DUR_MIN = 1, DUR_MAX = 600;
const KCAL_MIN = 1, KCAL_MAX = 5000;
const NAME_MAX = 20;
const CELL_MAX_TAGS = 4;
const CELL_MAX_PARTS = 3;

function perHourOf(activityType) {
  const t = BY_KEY[activityType];
  return t ? t.perHour : BY_KEY.custom.perHour;
}
function nameOf(activityType, activityName) {
  if (activityType === 'custom') return (activityName || '').trim() || '自定义';
  const t = BY_KEY[activityType];
  return t ? t.name : (activityName || '有氧');
}
function estimateKcal(activityType, durationMin) {
  const d = Number(durationMin);
  if (!isFinite(d) || d <= 0) return 0;
  return Math.round(perHourOf(activityType) * d / 60);
}

module.exports = {
  REF_NOTE, TYPES, BY_KEY, DUR_MIN, DUR_MAX, KCAL_MIN, KCAL_MAX, NAME_MAX,
  CELL_MAX_TAGS, CELL_MAX_PARTS, perHourOf, nameOf, estimateKcal,
};
