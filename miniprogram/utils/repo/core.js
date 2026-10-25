// Shared repo plumbing: clock, result envelopes, error mapping.
const S = require('../storage');
const D = require('../date');
let clock = () => Date.now();
const setClock = fn => { clock = fn || (() => Date.now()); };
const now = () => clock();
const today = () => D.fmt(new Date(now()));
const ok = (data, extra) => Object.assign({ ok: true, data }, extra || {});
const fail = (code, message, extra) => Object.assign({ ok: false, code, message }, extra || {});
// Run a mutation; map StorageError & validation results into {ok:false}.
function guard(fn) {
  try { return fn(); }
  catch (e) {
    if (e instanceof S.StorageError) return fail(e.code, e.message);
    if (e && e.repoCode) return fail(e.repoCode, e.message);
    throw e; // programming error: surface it
  }
}
function raise(code, message) { const e = new Error(message); e.repoCode = code; throw e; }
function check(r) { if (!r.ok) raise(r.code, r.message); return r.value; }
function writable() { if (S.isReadOnly()) raise('READ_ONLY', '当前为只读模式，请更新小程序'); }
module.exports = { setClock, now, today, ok, fail, guard, raise, check, writable };
