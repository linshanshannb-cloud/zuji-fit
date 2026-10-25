// Low-level storage wrapper. The ONLY module that touches wx.*Storage. Backend is injectable for tests.
// Backend shape: { get(key), set(key, value), remove(key), keys() -> string[] }
//
// Safety rules (PRODUCT_SPEC §7.2, REVIEW M7):
// - Reads never throw. A key whose read throws is marked UNREADABLE; a key holding the wrong shape is marked CORRUPT.
// - Writes to an unreadable/corrupt key are refused (DATA_CORRUPT), so damaged data is never treated as empty and overwritten.
// - The raw value of a corrupt key is copied once to `fit_corrupt_<key>_<ts>` (best effort) and the original is left untouched.
class StorageError extends Error {
  constructor(code, message, cause) { super(message); this.name = 'StorageError'; this.code = code; this.cause = cause; }
}
const wxBackend = () => ({
  get: k => { const v = wx.getStorageSync(k); return v === '' ? undefined : v; }, // wx returns '' for missing keys
  set: (k, v) => wx.setStorageSync(k, v),
  remove: k => wx.removeStorageSync(k),
  keys: () => wx.getStorageInfoSync().keys || [],
});
let backend = typeof wx !== 'undefined' ? wxBackend() : null;
let readOnly = false;
let health = { corrupt: {}, unreadable: {} };

function setBackend(b) { backend = b; resetHealth(); }
function setReadOnly(v) { readOnly = !!v; }
function isReadOnly() { return readOnly; }
function need() { if (!backend) throw new StorageError('NO_BACKEND', '存储不可用'); return backend; }
function isQuota(e) { return /exceed|quota|limit|storage.*full|空间/i.test(String((e && (e.errMsg || e.message)) || e)); }

// Raw read. Returns `fallback` for missing keys and on read errors (key gets marked unreadable).
function get(key, fallback) {
  try { const v = need().get(key); return v === undefined || v === null ? fallback : v; }
  catch (e) { health.unreadable[key] = String((e && (e.errMsg || e.message)) || e); return fallback; }
}
// Typed read: shape 'array' | 'object'. Wrong shape -> marked corrupt (+ backup), returns fallback. Never throws.
function getTyped(key, shape, fallback) {
  const v = get(key, undefined);
  if (v === undefined) return fallback;
  const okShape = shape === 'array' ? Array.isArray(v) : v !== null && typeof v === 'object' && !Array.isArray(v);
  if (okShape) return v;
  markCorrupt(key, v);
  return fallback;
}
function markCorrupt(key, raw) {
  if (health.corrupt[key]) return;
  health.corrupt[key] = Array.isArray(raw) ? 'array' : typeof raw;
  if (readOnly || !backend) return;
  try { need().set('fit_corrupt_' + key + '_' + Date.now(), raw); } catch (e) { /* backup is best effort; original stays untouched anyway */ }
}
function blocked(key) { return health.corrupt[key] || health.unreadable[key]; }
function set(key, value) {
  if (readOnly) throw new StorageError('READ_ONLY', '当前为只读模式，请更新小程序');
  if (blocked(key)) throw new StorageError('DATA_CORRUPT', '数据读取异常，已暂停保存以保护原数据');
  try { need().set(key, value); }
  catch (e) {
    if (e instanceof StorageError) throw e;
    throw new StorageError(isQuota(e) ? 'QUOTA_EXCEEDED' : 'WRITE_FAILED', isQuota(e) ? '存储空间不足，请清理后重试' : '保存失败，请重试', e);
  }
}
function remove(key) {
  if (readOnly) throw new StorageError('READ_ONLY', '当前为只读模式，请更新小程序');
  if (blocked(key)) throw new StorageError('DATA_CORRUPT', '数据读取异常，已暂停保存以保护原数据');
  try { need().remove(key); } catch (e) { throw new StorageError('WRITE_FAILED', '删除失败，请重试', e); }
}
function keys() { try { return need().keys(); } catch (e) { return null; } } // null = unknown (do not clean up)
function getHealth() {
  const corruptKeys = Object.keys(health.corrupt), unreadableKeys = Object.keys(health.unreadable);
  return { ok: !corruptKeys.length && !unreadableKeys.length, corruptKeys, unreadableKeys };
}
function resetHealth() { health = { corrupt: {}, unreadable: {} }; }

// In-memory backend for tests / previews. opts.failOn(key, value) -> truthy to throw on set.
function memoryBackend(initial = {}, opts = {}) {
  const m = JSON.parse(JSON.stringify(initial));
  return {
    data: m,
    get: k => (k in m ? JSON.parse(JSON.stringify(m[k])) : undefined),
    set: (k, v) => { const err = opts.failOn && opts.failOn(k, v); if (err) throw (err === true ? new Error('setStorageSync:fail exceed storage max size') : err); m[k] = JSON.parse(JSON.stringify(v)); },
    remove: k => { delete m[k]; },
    keys: () => Object.keys(m),
  };
}
module.exports = { StorageError, setBackend, setReadOnly, isReadOnly, get, getTyped, markCorrupt, set, remove, keys, getHealth, resetHealth, memoryBackend, wxBackend };
