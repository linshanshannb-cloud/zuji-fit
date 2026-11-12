// 文字识别结果的解析与校验。不读存储、不调模型、不保留用户原文。
const Fml = require('./diet-formula');

const LIMITS = {
  name: 30,
  portion: 20,
  tips: 160,
  note: 40,
  kcal: 8000,
  carbsG: 1500,
  proteinG: 800,
  fatG: 500,
  fiberG: 200,
  sugarG: 500,
  saltMg: 20000,
};

function numOrNull(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/,/g, '').replace(/\s+/g, '');
  s = s.replace(/(kcal|千卡|毫克|克|mg|g)$/i, '');
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
function fail(code, title, message) {
  return { ok: false, code, title, message };
}
function parseModelText(text) {
  if (text == null) return null;
  let s = String(text).replace(/^\uFEFF/, '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try { return JSON.parse(s); } catch (e) { /* 模型常在 JSON 前后加一句说明 */ }
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  const a = s.indexOf('[');
  const b = s.lastIndexOf(']');
  const start = i >= 0 && (a < 0 || i <= a) ? i : a;
  const end = start === i ? j : b;
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch (e2) { return null; }
  }
  return null;
}
function extractContent(res, depth) {
  if (!res || (depth || 0) > 2) return '';
  if (typeof res === 'string') return res;
  if (typeof res.text === 'string' && res.text.trim()) return res.text;
  const choice = res.choices && res.choices[0];
  const msg = choice && (choice.message || choice.delta);
  if (msg && msg.content) return String(msg.content);
  if (typeof res.content === 'string' && res.content.trim()) return res.content;
  if (res.data && res.data !== res) {
    const inner = extractContent(res.data, (depth || 0) + 1);
    if (inner) return inner;
  }
  if (res.result && res.result !== res) {
    const inner = extractContent(res.result, (depth || 0) + 1);
    if (inner) return inner;
  }
  return '';
}
function clip(s, max) {
  const t = String(s || '').trim();
  return t.length > max ? t.slice(0, max) : t;
}
function mergeList(list) {
  const rows = (list || []).filter(x => x && typeof x === 'object');
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const foods = rows.filter(r => r.food !== false && r.food !== 'false');
  const use = foods.length ? foods : rows;
  const sumKey = (key, alt) => use.reduce((t, r) => t + (numOrNull(r[key] != null ? r[key] : r[alt]) || 0), 0);
  const names = use.map(r => String(r.name || '').trim()).filter(Boolean);
  return {
    food: foods.length > 0,
    name: names.slice(0, 2).join('、'),
    portion: use.map(r => String(r.portion || '').trim()).filter(Boolean).slice(0, 2).join('、'),
    kcal: sumKey('kcal', 'calories'),
    carbsG: sumKey('carbsG'),
    proteinG: sumKey('proteinG'),
    fatG: sumKey('fatG'),
    fiberG: sumKey('fiberG'),
    sugarG: sumKey('sugarG'),
    saltMg: sumKey('saltMg', 'saltG'),
    tips: clip(use.map(r => r.tips).filter(Boolean)[0] || '', LIMITS.tips),
  };
}
function unwrap(raw) {
  if (Array.isArray(raw)) return mergeList(raw);
  if (!raw || typeof raw !== 'object') return null;
  if (raw.name == null && raw.food == null) {
    if (Array.isArray(raw.foods)) return mergeList(raw.foods);
    if (Array.isArray(raw.items)) return mergeList(raw.items);
    if (raw.data && typeof raw.data === 'object') return unwrap(raw.data);
    if (raw.result && typeof raw.result === 'object') return unwrap(raw.result);
  }
  return raw;
}
function looksLikeRefusal(name) {
  return /^(无法识别|不知道|不是食物|无法判断|不能识别)/.test(name);
}
function optField(raw, key, alt, max, asInt) {
  let n = numOrNull(raw[key]);
  if (n == null && alt && raw[alt] != null) {
    const a = numOrNull(raw[alt]);
    if (a != null) n = key === 'saltMg' && alt === 'saltG' ? a * 1000 : a;
  }
  if (n == null) return null;
  if (n < 0 || n > max) return null;
  return asInt ? Math.round(n) : Fml.round1(n);
}
function coreFrom(raw) {
  const name = clip(raw.name, LIMITS.name);
  const carbsG = numOrNull(raw.carbsG);
  const proteinG = numOrNull(raw.proteinG);
  const fatG = numOrNull(raw.fatG);
  let kcal = numOrNull(raw.kcal != null ? raw.kcal : raw.calories);
  return { name, carbsG, proteinG, fatG, kcal };
}
function inRange(n, max) {
  return n != null && n >= 0 && n <= max;
}
// 模型原文。热量和碳蛋脂差太多时，改用 4/4/9 重算，避免把离谱热量写进今日。
function assess(raw) {
  const row = unwrap(raw);
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return fail('PARSE', '没读懂这次结果', '可以再试一次，或改成手动录入。');
  }
  const food = !(row.food === false || row.food === 'false' || row.ok === false);
  const core = coreFrom(row);
  if (!food || !core.name || looksLikeRefusal(core.name)) {
    return fail('NOT_FOOD', '这句不太像吃的', '换种说法试试，或改成手动录入。');
  }
  if (!inRange(core.carbsG, LIMITS.carbsG) || !inRange(core.proteinG, LIMITS.proteinG) || !inRange(core.fatG, LIMITS.fatG)) {
    return fail('RANGE', '数字看起来不太对', '估算超出了一顿饭的常理。可以换种说法，或改成手动录入。');
  }
  const carbsG = Fml.round1(core.carbsG);
  const proteinG = Fml.round1(core.proteinG);
  const fatG = Fml.round1(core.fatG);
  const computed = Math.round(Fml.kcalOf(carbsG, proteinG, fatG));
  let kcal = core.kcal == null ? computed : Math.round(core.kcal);
  if (!inRange(kcal, LIMITS.kcal) || Math.abs(kcal - computed) > Math.max(300, computed * 0.4)) kcal = computed;
  let tips = clip(row.tips, LIMITS.tips);
  if (!tips) tips = '这是估算，保存前可以对一下数字。';
  return {
    ok: true,
    data: {
      name: core.name,
      portion: clip(row.portion, LIMITS.portion),
      kcal,
      carbsG,
      proteinG,
      fatG,
      fiberG: optField(row, 'fiberG', null, LIMITS.fiberG, false),
      sugarG: optField(row, 'sugarG', null, LIMITS.sugarG, false),
      saltMg: optField(row, 'saltMg', 'saltG', LIMITS.saltMg, true),
      tips,
    },
  };
}
function must(v, label, max, asInt) {
  const n = numOrNull(v == null ? '' : String(v));
  if (v == null || String(v).trim() === '') return fail('VALIDATION', '数字还没填好', '请填写' + label);
  if (n == null || n < 0 || n > max) return fail('VALIDATION', '数字看起来不太对', label + '需要在 0–' + max);
  return { ok: true, value: asInt ? Math.round(n) : Fml.round1(n) };
}
function optional(v, label, max, asInt) {
  if (v == null || String(v).trim() === '') return { ok: true, value: null };
  const n = numOrNull(String(v));
  if (n == null || n < 0 || n > max) return fail('VALIDATION', '数字看起来不太对', label + '需要在 0–' + max);
  return { ok: true, value: asInt ? Math.round(n) : Fml.round1(n) };
}
// 结果页确认时用。允许热量和碳蛋脂不完全相等，因为人可以改每一个数。
function acceptEntry(input) {
  input = input || {};
  const name = clip(input.name, LIMITS.name + 1);
  if (!name) return fail('VALIDATION', '还没有食物名', '请填写食物名称');
  if (name.length > LIMITS.name) return fail('VALIDATION', '食物名有点长', '食物名称最多 30 字');
  const carbs = must(input.carbsG, '碳水', LIMITS.carbsG, false);
  if (!carbs.ok) return carbs;
  const protein = must(input.proteinG, '蛋白质', LIMITS.proteinG, false);
  if (!protein.ok) return protein;
  const fat = must(input.fatG, '脂肪', LIMITS.fatG, false);
  if (!fat.ok) return fat;
  const kcal = must(input.kcal, '热量', LIMITS.kcal, true);
  if (!kcal.ok) return kcal;
  const fiber = optional(input.fiberG, '纤维', LIMITS.fiberG, false);
  if (!fiber.ok) return fiber;
  const sugar = optional(input.sugarG, '糖', LIMITS.sugarG, false);
  if (!sugar.ok) return sugar;
  const salt = optional(input.saltMg, '盐', LIMITS.saltMg, true);
  if (!salt.ok) return salt;
  const note = String(input.note || '').trim();
  if (note.length > LIMITS.note) return fail('VALIDATION', '备注有点长', '备注最多 40 字');
  const eatenAt = input.eatenAt == null || input.eatenAt === '' ? null : String(input.eatenAt);
  if (eatenAt && !/^([01]\d|2[0-3]):[0-5]\d$/.test(eatenAt)) return fail('VALIDATION', '时间不对', '时间要像 17:47 这样');
  return {
    ok: true,
    data: {
      name,
      portion: clip(input.portion, LIMITS.portion),
      kcal: kcal.value,
      carbsG: carbs.value,
      proteinG: protein.value,
      fatG: fat.value,
      fiberG: fiber.value,
      sugarG: sugar.value,
      saltMg: salt.value,
      tips: clip(input.tips, LIMITS.tips),
      note,
      eatenAt,
    },
  };
}

module.exports = { LIMITS, numOrNull, parseModelText, extractContent, assess, acceptEntry };
