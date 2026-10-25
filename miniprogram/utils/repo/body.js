const S = require('../storage');
const K = require('./keys');
const V = require('./validate');
const C = require('./core');
const D = require('../date');
const { newId } = require('./ids');
const METRICS = { weightKg: V.normalizeBodyWeight, bodyFatPct: V.normalizeBodyFat, waistCm: V.normalizeWaist };
const FIELDS = Object.keys(METRICS);
const sortByDate = l => l.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

function listBody() { return S.getTyped(K.BODY, 'array', []); } // corrupt -> [] for display, writes to fit_body refused
const getBodyByDate = date => listBody().find(r => r.date === date) || null;
const getBody = id => listBody().find(r => r.id === id) || null;
function bodyDates(from, to) { const m = {}; listBody().forEach(r => { if ((!from || r.date >= from) && (!to || r.date <= to)) m[r.date] = true; }); return m; }

// Strict parse of one metric: blank -> undefined ("not provided"), invalid -> error (never silently nulls old data).
const STRICT = { weightKg: V.validateBodyWeightOptional, bodyFatPct: V.validateBodyFat, waistCm: V.validateWaist };
function parseMetric(f, v) { return V.isBlank(v) ? undefined : C.check(STRICT[f](v)); }

// Save for a date (§7 saveBody): new record or merge. weightKg required on the resulting record (lead decision §9#1).
function saveBody(input = {}) {
  return C.guard(() => {
    C.writable();
    const date = C.check(V.validateDate(input.date || C.today(), { today: C.today() }));
    const note = C.check(V.validateText(input.note, V.LIMITS.bodyNote));
    const t = C.now(), list = listBody(), old = list.find(r => r.date === date);
    const incoming = {}; FIELDS.forEach(f => { incoming[f] = parseMetric(f, input[f]); });
    const rec = old ? Object.assign({}, old) : { id: newId('b_', t), date, weightKg: null, bodyFatPct: null, waistCm: null, note: '', extra: null, createdAt: t };
    FIELDS.forEach(f => { if (incoming[f] !== undefined) rec[f] = incoming[f]; });
    if (note) rec.note = note;
    if (rec.weightKg == null) C.raise('WEIGHT_REQUIRED', '请填写体重');
    rec.updatedAt = t;
    S.set(K.BODY, sortByDate(list.filter(r => r.date !== date).concat([rec])));
    return C.ok(rec, old ? { merged: true } : undefined);
  });
}
// Explicit edit (§7 updateBody): fields present replace; blank clears optional fields; weight stays required.
function updateBody(id, patch = {}) {
  return C.guard(() => {
    C.writable();
    const list = listBody(), old = list.find(r => r.id === id);
    if (!old) C.raise('NOT_FOUND', '记录不存在');
    const rec = Object.assign({}, old);
    if ('date' in patch) {
      rec.date = C.check(V.validateDate(patch.date, { today: C.today() }));
      if (list.some(r => r.date === rec.date && r.id !== id)) C.raise('DATE_CONFLICT', '该日期已有记录');
    }
    // weightKg in patch must be valid (cannot be cleared); absent -> kept (v0 records may keep null).
    if ('weightKg' in patch && V.isBlank(patch.weightKg)) C.raise('WEIGHT_REQUIRED', '请填写体重');
    FIELDS.forEach(f => { if (f in patch) { const v = parseMetric(f, patch[f]); rec[f] = v === undefined ? null : v; } });
    if ('note' in patch) rec.note = C.check(V.validateText(patch.note, V.LIMITS.bodyNote));
    rec.updatedAt = C.now();
    S.set(K.BODY, sortByDate(list.filter(r => r.id !== id).concat([rec])));
    return C.ok(rec);
  });
}
function deleteBody(id) {
  return C.guard(() => {
    C.writable();
    const list = listBody();
    if (!list.some(r => r.id === id)) C.raise('NOT_FOUND', '记录不存在');
    S.set(K.BODY, list.filter(r => r.id !== id));
    return C.ok(true);
  });
}
// Range series for charts. range: 30 | 90 | 'all'. Only real non-null points; no interpolation/fill.
function bodySeries(field, range = 30) {
  if (!METRICS[field]) throw new Error('unknown field ' + field);
  const to = C.today();
  const all = listBody().filter(r => r[field] != null && r.date <= to);
  let from;
  if (range === 'all') from = all.length ? all[0].date : to;
  else { const n = Number(range); const d = D.parse(to); d.setDate(d.getDate() - (n - 1)); from = D.fmt(d); }
  const points = all.filter(r => r.date >= from).map(r => ({ date: r.date, value: r[field] }));
  return { field, range, from, to, points };
}
// Current value (latest point in range) and delta vs the previous non-null record (may be outside range).
function bodyStats(field, range = 30) {
  const series = bodySeries(field, range);
  const all = listBody().filter(r => r[field] != null && r.date <= series.to);
  const cur = series.points[series.points.length - 1] || null;
  let prev = null;
  if (cur) { const i = all.findIndex(r => r.date === cur.date); if (i > 0) prev = { date: all[i - 1].date, value: all[i - 1][field] }; }
  return { series, current: cur, previous: prev, delta: cur && prev ? V.round1(cur.value - prev.value) : null, totalRecords: listBody().length, fieldTotal: all.length };
}
// List rows for the chart's metric — same source as the chart (bodySeries), newest first, with delta vs previous record.
function bodyRows(field, range = 30) {
  const series = bodySeries(field, range);
  const all = listBody().filter(r => r[field] != null && r.date <= series.to);
  return series.points.slice().reverse().map(p => {
    const i = all.findIndex(r => r.date === p.date), r = all[i];
    return { id: r.id, date: p.date, value: p.value, delta: i > 0 ? V.round1(p.value - all[i - 1][field]) : null };
  });
}
module.exports = { bodyRows, bodyStats, FIELDS, listBody, getBody, getBodyByDate, bodyDates, saveBody, updateBody, deleteBody, bodySeries };
