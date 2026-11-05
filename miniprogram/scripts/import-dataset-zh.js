#!/usr/bin/env node
// Merge Devillmy/exercises-dataset-zh into data/exercises.json + data/filters.json.
// Existing catalogue ids keep their name, classification, steps, cloud video, poster and illustration.
// New ids come from the dataset (Chinese name + Chinese steps). Does not download media bytes.
//
// Usage:
//   node scripts/import-dataset-zh.js \
//     --exercises /path/to/exercises.json \
//     --names /path/to/name_zh.json
// Then: node scripts/build-data.js
//
// Pinned source: https://github.com/Devillmy/exercises-dataset-zh
// commit c335dbc6c9f21d70e585ebffec2481496c059b92 (2026-08-30)
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '../..');
const dataDir = path.join(repo, 'data');
const runtimeJs = path.join(repo, 'miniprogram/data/exercises.js');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const srcPath = arg('--exercises', '/tmp/exercises-dataset-zh/exercises.json');
const namesPath = arg('--names', '/tmp/exercises-dataset-zh/name_zh.json');

const BODY = {
  chest: ['chest', 'chest'],
  back: ['back', 'back'],
  shoulders: ['shoulders', 'shoulders'],
  'upper arms': ['arms', 'upper_arms'],
  'lower arms': ['arms', 'lower_arms'],
  'upper legs': ['legs', 'upper_legs'],
  'lower legs': ['legs', 'lower_legs'],
  waist: ['core', 'waist'],
  cardio: ['core', 'cardio'],
  neck: ['core', 'neck'],
};
const MUSCLE = {
  pectorals: 'chest', chest: 'chest', 'upper chest': 'chest',
  shoulders: 'delts', delts: 'delts', deltoids: 'delts', 'rear deltoids': 'rear_delts',
  'rotator cuff': 'rotator_cuff', lats: 'lats', 'latissimus dorsi': 'lats',
  traps: 'traps', trapezius: 'traps', 'upper back': 'upper_back', back: 'upper_back',
  rhomboids: 'rhomboids', 'lower back': 'lower_back', spine: 'lower_back',
  biceps: 'biceps', triceps: 'triceps', brachialis: 'brachialis',
  forearms: 'forearms', 'grip muscles': 'forearms',
  abs: 'abs', abdominals: 'abs', 'lower abs': 'abs', obliques: 'obliques', core: 'core',
  'serratus anterior': 'serratus', 'hip flexors': 'hip_flexors', glutes: 'glutes',
  quads: 'quads', quadriceps: 'quads', hamstrings: 'hamstrings',
  adductors: 'adductors', abductors: 'abductors', groin: 'adductors', 'inner thighs': 'adductors',
  calves: 'calves', soleus: 'soleus', ankles: 'ankles', 'ankle stabilizers': 'ankles',
  shins: 'shins', feet: 'feet', 'cardiovascular system': 'cardio',
  'levator scapulae': 'levator_scapulae', sternocleidomastoid: 'sternocleidomastoid',
  wrists: 'wrists', 'wrist extensors': 'wrists', 'wrist flexors': 'wrists', hands: 'hands',
};
const MUSCLE_LABEL = {
  serratus: ['serratus anterior', '前锯肌'],
  shins: ['shins', '胫骨前肌'],
  feet: ['feet', '足部'],
  cardio: ['cardio', '心肺'],
  levator_scapulae: ['levator scapulae', '肩胛提肌'],
  sternocleidomastoid: ['sternocleidomastoid', '胸锁乳突肌'],
  wrists: ['wrists', '手腕'],
  hands: ['hands', '手部'],
};
const EQUIP_ZH = {
  band: '弹力带', barbell: '杠铃', body_weight: '自重', cable: '绳索', dumbbell: '哑铃',
  ez_barbell: '曲杆杠铃', kettlebell: '壶铃', leverage_machine: '固定器械',
  sled_machine: '45°腿举机', smith_machine: '史密斯机', trap_bar: '六角杠',
  weighted: '负重', wheel_roller: '健腹轮', stability_ball: '稳定球', medicine_ball: '药球',
  resistance_band: '阻力带', bosu_ball: '波速球', olympic_barbell: '奥林匹克杠铃',
  assisted: '助力', rope: '跳绳', roller: '泡沫轴', hammer: '锤', tire: '轮胎',
  upper_body_ergometer: '上肢功率车', skierg_machine: '滑雪机', stationary_bike: '固定单车',
  elliptical_machine: '椭圆机', stepmill_machine: '台阶机',
};
const DETAIL_ZH = {
  back: ['back', '背部'], chest: ['chest', '胸部'], lower_arms: ['lower arms', '前臂'],
  lower_legs: ['lower legs', '小腿'], shoulders: ['shoulders', '肩部'],
  upper_arms: ['upper arms', '上臂'], upper_legs: ['upper legs', '大腿'],
  waist: ['waist', '腰腹'], cardio: ['cardio', '有氧'], neck: ['neck', '颈部'],
};
const CATEGORY_LABEL = {
  strength: ['strength', '力量'],
  calisthenics: ['calisthenics', '自重训练'],
  isometric: ['isometric', '等长训练'],
  cardio: ['cardio', '有氧'],
  stretching: ['stretching', '拉伸'],
};
const PART_ORDER = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core'];
const PART_ZH = { chest: '胸', back: '背', shoulders: '肩', legs: '腿', arms: '手臂', core: '核心' };
const DETAIL_ORDER = ['chest', 'back', 'shoulders', 'upper_arms', 'lower_arms', 'upper_legs', 'lower_legs', 'waist', 'cardio', 'neck'];

function normalizeZh(s) {
  return String(s || '')
    .replace(/([^\u0000-\u007f])[ \t]+(?=[^\u0000-\u007f])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
function normalizeEn(s) {
  return String(s || '').replace(/в°/g, '°').replace(/\s+/g, ' ').trim().toLowerCase();
}
function equipKey(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function muscleKey(s) {
  const k = MUSCLE[String(s || '').trim().toLowerCase()];
  if (!k) throw new Error('unmapped muscle: ' + s);
  return k;
}
function categoryOf(src) {
  const name = String(src.name || '').toLowerCase();
  if (src.body_part === 'cardio') return 'cardio';
  if (src.body_part === 'neck' || /\bstretch(?:es|ing)?\b/.test(name)) return 'stretching';
  if (/\b(plank|hold)\b/.test(name)) return 'isometric';
  if (src.equipment === 'body weight') return 'calisthenics';
  return 'strength';
}
function loadPreserve() {
  const js = require(runtimeJs);
  const fromJs = Array.isArray(js.list) ? js.list : [];
  const jsHasText = fromJs.some(e => e.steps && e.steps.length);
  const jsonPath = path.join(dataDir, 'exercises.json');
  let fromJson = [];
  if (fs.existsSync(jsonPath)) fromJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const jsonReady = fromJson.length > 1000 && fromJson.some(e => e.id === '0025' && String(e.video || '').startsWith('cloud://') && e.steps && e.steps.length);
  if (jsonReady) return fromJson;
  if (jsHasText) return fromJs;
  throw new Error('cannot find a preserved catalogue with steps and the 0025 cloud video');
}

const dataset = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
const nameZhByEn = JSON.parse(fs.readFileSync(namesPath, 'utf8'));
const bySrc = new Map(dataset.map(e => [e.id, e]));
if (bySrc.size !== dataset.length) throw new Error('duplicate ids in dataset');
const preserved = loadPreserve();
const oldById = new Map(preserved.map(e => [e.id, e]));

const out = [];
const seen = new Set();
for (const old of preserved) {
  const src = bySrc.get(old.id);
  const rec = Object.assign({}, old);
  if (src) {
    if (src.image !== `images/${src.id}-${src.media_id}.jpg` || src.gif_url !== `videos/${src.id}-${src.media_id}.gif`) {
      throw new Error('media path mismatch ' + src.id);
    }
    rec.mediaId = src.media_id;
  }
  out.push(rec);
  seen.add(old.id);
}

let added = 0;
const missingName = [];
for (const src of dataset) {
  if (seen.has(src.id)) continue;
  if (src.image !== `images/${src.id}-${src.media_id}.jpg` || src.gif_url !== `videos/${src.id}-${src.media_id}.gif`) {
    throw new Error('media path mismatch ' + src.id);
  }
  const bp = BODY[src.body_part];
  if (!bp) throw new Error('unmapped body_part ' + src.body_part + ' ' + src.id);
  const rawName = nameZhByEn[src.name];
  if (!rawName) missingName.push(src.id + ' ' + src.name);
  const nameZh = rawName ? normalizeZh(rawName) : normalizeEn(src.name);
  const target = muscleKey(src.target);
  const secondary = [];
  for (const m of src.secondary_muscles || []) {
    const k = muscleKey(m);
    if (k !== target && !secondary.includes(k)) secondary.push(k);
  }
  const category = categoryOf(src);
  const steps = (src.instruction_steps && src.instruction_steps.zh) || [];
  if (!steps.length) throw new Error('missing zh steps ' + src.id);
  out.push({
    id: src.id,
    nameZh,
    nameEn: normalizeEn(src.name),
    bodyPart: bp[0],
    bodyPartDetail: bp[1],
    target,
    secondary,
    equipment: equipKey(src.equipment),
    category,
    categoryZh: CATEGORY_LABEL[category][1],
    description: String((src.instructions && src.instructions.en) || '').replace(/\s+/g, ' ').trim(),
    steps,
    translationPending: !rawName,
    untranslatedFields: rawName ? ['description'] : ['nameZh', 'description'],
    mediaId: src.media_id,
  });
  added++;
}
if (missingName.length) console.warn('missing name_zh', missingName.length);

out.sort((a, b) => (Number(a.id) - Number(b.id)) || (a.id < b.id ? -1 : 1));
const idSet = new Set();
for (const e of out) {
  if (idSet.has(e.id)) throw new Error('duplicate ' + e.id);
  idSet.add(e.id);
  if (!PART_ORDER.includes(e.bodyPart)) throw new Error('bad bodyPart ' + e.id);
}

const oldFilters = JSON.parse(fs.readFileSync(path.join(dataDir, 'filters.json'), 'utf8'));
function prior(group, value) {
  return (oldFilters[group] || []).find(o => o.value === value) || null;
}
function countOf(pred) { return out.filter(pred).length; }
function ordered(values, prefer) {
  const set = new Set(values);
  const head = prefer.filter(v => set.has(v));
  const rest = [...set].filter(v => !head.includes(v)).sort();
  return head.concat(rest);
}

const bodyPart = PART_ORDER.map(value => {
  const details = ordered(out.filter(e => e.bodyPart === value).map(e => e.bodyPartDetail), DETAIL_ORDER);
  const hit = prior('bodyPart', value);
  return { value, en: hit ? hit.en : value, zh: hit ? hit.zh : PART_ZH[value], count: countOf(e => e.bodyPart === value), details };
});
const bodyPartDetail = ordered(out.map(e => e.bodyPartDetail), DETAIL_ORDER).map(value => {
  const hit = prior('bodyPartDetail', value);
  const fb = DETAIL_ZH[value] || [value.replace(/_/g, ' '), value];
  return { value, en: hit ? hit.en : fb[0], zh: hit ? hit.zh : fb[1], count: countOf(e => e.bodyPartDetail === value) };
});
const equipment = ordered(out.map(e => e.equipment), (oldFilters.equipment || []).map(o => o.value)).map(value => {
  const hit = prior('equipment', value);
  return {
    value,
    en: hit ? hit.en : value.replace(/_/g, ' '),
    zh: hit ? hit.zh : (EQUIP_ZH[value] || value),
    count: countOf(e => e.equipment === value),
  };
});
const category = ordered(out.map(e => e.category), Object.keys(CATEGORY_LABEL)).map(value => {
  const hit = prior('category', value);
  const fb = CATEGORY_LABEL[value] || [value, value];
  return { value, en: hit ? hit.en : fb[0], zh: hit ? hit.zh : fb[1], count: countOf(e => e.category === value) };
});
const muscleValues = new Set();
out.forEach(e => { muscleValues.add(e.target); (e.secondary || []).forEach(m => muscleValues.add(m)); });
const muscles = ordered([...muscleValues], (oldFilters.muscles || []).map(o => o.value)).map(value => {
  const hit = prior('muscles', value);
  const fb = MUSCLE_LABEL[value] || [value.replace(/_/g, ' '), value];
  return {
    value,
    en: hit ? hit.en : fb[0],
    zh: hit ? hit.zh : fb[1],
    count: countOf(e => e.target === value || (e.secondary || []).includes(value)),
  };
});
const filters = {
  _note: 'value 为 exercises.json 中使用的稳定英文枚举值；zh/en 为显示名。计数由 scripts/import-dataset-zh.js 按当前动作库生成。',
  bodyPart, bodyPartDetail, equipment, category, muscles,
};

fs.writeFileSync(path.join(dataDir, 'exercises.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(dataDir, 'filters.json'), JSON.stringify(filters, null, 2) + '\n');

const samplePath = path.join(dataDir, 'exercises.sample.json');
if (fs.existsSync(samplePath)) {
  const sampleIds = JSON.parse(fs.readFileSync(samplePath, 'utf8')).map(e => e.id);
  const byId = new Map(out.map(e => [e.id, e]));
  const sample = sampleIds.map(id => byId.get(id)).filter(Boolean);
  fs.writeFileSync(samplePath, JSON.stringify(sample, null, 2) + '\n');
}

const bench = out.find(e => e.id === '0025');
const stats = {
  total: out.length,
  dataset: dataset.length,
  preserved: preserved.length,
  added,
  missingName: missingName.length,
  withVideo: out.filter(e => e.video).length,
  withPoster: out.filter(e => e.poster).length,
  withIllustration: out.filter(e => e.illustration).length,
  withMediaId: out.filter(e => e.mediaId).length,
  bodyPart: Object.fromEntries(bodyPart.map(o => [o.value, o.count])),
  id0025: { nameZh: bench.nameZh, nameEn: bench.nameEn, video: bench.video, poster: bench.poster, steps: (bench.steps || []).length },
};
console.log(JSON.stringify(stats, null, 2));
