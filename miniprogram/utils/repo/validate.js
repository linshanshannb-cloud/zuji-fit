// Validation & normalization per DATA_MODEL.md. Pure.
const D = require('../date');
const LIMITS = { setWeightMax: 999.9, repsMax: 999, bodyWeightMax: 700, bodyFatMax: 100, waistMax: 300,
  workoutName: 30, workoutNote: 500, weNote: 200, bodyNote: 200, customName: 30, customDesc: 500 };
const round1 = x => Math.round(x * 10) / 10;
const isBlank = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
// Only real numbers or plain decimal strings ("62", "62.5", " .5 ", "-1" for range errors). Rejects booleans, arrays,
// hex, exponent and full-width digits (PRODUCT_SPEC 3.3 "只接受数字和一个小数点").
const DEC = /^-?(\d+(\.\d*)?|\.\d+)$/;
const num = v => {
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim(); return s && DEC.test(s) ? Number(s) : NaN;
};
const ok = value => ({ ok: true, value });
const bad = (code, message) => ({ ok: false, code, message });

// Set weight: null or 0..999.9 (1dp). Blank -> null.
function validateSetWeight(v) {
  if (isBlank(v)) return ok(null);
  const n = num(v);
  if (!isFinite(n)) return bad('INVALID_WEIGHT', '重量必须是数字');
  if (n < 0 || n > LIMITS.setWeightMax) return bad('INVALID_WEIGHT', '重量需在 0–999.9 kg');
  return ok(round1(n));
}
// Reps: null or integer 0..999.
function validateReps(v) {
  if (isBlank(v)) return ok(null);
  const n = num(v);
  if (!isFinite(n) || Math.floor(n) !== n) return bad('INVALID_REPS', '次数必须是整数');
  if (n < 0 || n > LIMITS.repsMax) return bad('INVALID_REPS', '次数需在 0–999');
  return ok(n);
}
// Body metrics: invalid/blank/<=0/out of range -> null (doc §7 rule 2: never error, store null).
const bodyMetric = max => v => { const n = num(v); return isFinite(n) && n > 0 && n <= max ? round1(n) : null; };
const normalizeBodyWeight = bodyMetric(LIMITS.bodyWeightMax);
const normalizeBodyFat = bodyMetric(LIMITS.bodyFatMax);
const normalizeWaist = bodyMetric(LIMITS.waistMax);
// Strict variants for UI hints (tell user why a value will be dropped).
const strict = (norm, code, label, max, unit) => v => {
  if (isBlank(v)) return ok(null);
  const r = norm(v); return r === null ? bad(code, `请输入 0–${max}${unit} 之间的数值`) : ok(r);
};
const validateBodyWeight = v => (isBlank(v) ? bad('WEIGHT_REQUIRED', '请填写体重') : strict(normalizeBodyWeight, 'INVALID_BODY_WEIGHT', '体重', 700, ' kg')(v));
const validateBodyWeightOptional = strict(normalizeBodyWeight, 'INVALID_BODY_WEIGHT', '体重', 700, ' kg');
const validateBodyFat = strict(normalizeBodyFat, 'INVALID_BODY_FAT', '体脂', 100, '');
const validateWaist = strict(normalizeWaist, 'INVALID_WAIST', '腰围', 300, ' cm');

function validateDate(s, { notFuture = true, today = D.today() } = {}) {
  if (typeof s !== 'string' || !D.isValid(s)) return bad('INVALID_DATE', '日期格式不正确');
  if (notFuture && s > today) return bad('FUTURE_DATE', '日期不能晚于今天');
  return ok(s);
}
function validateText(v, max, code = 'TEXT_TOO_LONG') {
  const s = isBlank(v) ? '' : String(v).trim();
  return s.length > max ? bad(code, `不能超过 ${max} 字`) : ok(s);
}
module.exports = { LIMITS, round1, isBlank, validateSetWeight, validateReps, normalizeBodyWeight, normalizeBodyFat, normalizeWaist,
  validateBodyWeight, validateBodyWeightOptional, validateBodyFat, validateWaist, validateDate, validateText };
