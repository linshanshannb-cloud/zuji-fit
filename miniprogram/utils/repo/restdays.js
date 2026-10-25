// 0.4.3：休息日（fit_rest_days = { 'YYYY-MM-DD': markedAt }）。独立键，不改动训练/身体数据与 schema；旧用户无此键即视为空。
const S = require('../storage');
const C = require('./core');
const V = require('./validate');
const KEY = 'fit_rest_days';
const all = () => S.getTyped(KEY, 'object', {});
const isRest = date => Object.prototype.hasOwnProperty.call(all(), date);
function list(from = '', to = '') { const m = {}; Object.keys(all()).forEach(d => { if ((!from || d >= from) && (!to || d <= to)) m[d] = true; }); return m; }
function mark(date) {
  return C.guard(() => {
    C.writable(); const d = C.check(V.validateDate(date, { today: C.today() }));
    const m = all(); if (!m[d]) { m[d] = C.now(); S.set(KEY, m); }
    return C.ok(d);
  });
}
function unmark(date) {
  return C.guard(() => {
    C.writable(); const m = all();
    if (m[date] !== undefined) { delete m[date]; S.set(KEY, m); }
    return C.ok(date);
  });
}
module.exports = { KEY, isRest, list, mark, unmark };
