// Launch: version check, v0->v1 migration, read-only guard, corruption guard, orphan cleanup, header self-heal (§8, §9).
const S = require('../storage');
const K = require('./keys');
const C = require('./core');
const { migrate_0_to_1, MIGRATIONS } = require('./migrate');
let state = { mode: 'uninitialized', schemaVersion: null, migrated: false, error: null };

function getMeta() { return S.get(K.META, undefined); }
const FRIENDLY = { QUOTA_EXCEEDED: '存储空间不足', WRITE_FAILED: '写入失败', DATA_CORRUPT: '数据读取异常' };
function withHealth(st) {
  [K.WORKOUTS, K.BODY, K.CUSTOM].forEach(k => S.getTyped(k, 'array', null)); // probe main keys so damage is reported at launch
  const h = S.getHealth();
  if (st.mode === 'normal' && !h.ok) return Object.assign({}, st, { mode: 'corrupt', health: h, message: '部分数据读取异常，已暂停对这部分数据的保存（原数据已保留）' });
  return Object.assign({}, st, { health: h });
}
function init() {
  S.setReadOnly(false); S.resetHealth();
  let freshUser = false;
  try {
    const t = C.now();
    const meta = getMeta();
    const metaUnreadable = S.getHealth().unreadableKeys.includes(K.META);
    if (metaUnreadable) throw Object.assign(new Error('读取版本信息失败'), { code: 'READ_FAILED' });
    if (meta !== undefined && !(meta && typeof meta === 'object' && typeof meta.schemaVersion === 'number')) {
      // fit_meta exists but is garbage: never overwrite it (we can't tell which format the data is in) -> read-only.
      S.markCorrupt(K.META, meta);
      S.setReadOnly(true);
      return (state = withHealth({ mode: 'readonly', schemaVersion: null, migrated: false, error: null, message: '版本信息损坏，当前为只读模式，原数据已保留' }));
    }
    if (meta === undefined) {
      const lw = S.get(K.LEGACY_WORKOUTS, undefined), lb = S.get(K.LEGACY_BODY, undefined);
      if (!S.getHealth().ok) throw Object.assign(new Error('读取旧版数据失败'), { code: 'READ_FAILED' }); // don't decide "new user" on a failed read
      if (lw !== undefined || lb !== undefined) {
        const r = migrate_0_to_1({ workouts: lw, body: lb }, t);
        // Idempotent: overwrite new keys wholesale; meta written LAST as the success marker. Legacy keys kept (§9.1.6).
        Object.keys(r.details).forEach(id => S.set(K.workoutDetail(id), r.details[id]));
        S.set(K.WORKOUTS, r.workouts);
        S.set(K.BODY, r.body);
        cleanOrphans(r.workouts);
        S.set(K.META, r.meta);
        state = { mode: 'normal', schemaVersion: K.SCHEMA_VERSION, migrated: true, migratedFrom: 0, error: null };
      } else {
        freshUser = true;
        S.set(K.META, { schemaVersion: K.SCHEMA_VERSION, createdAt: t, migratedAt: null, migratedFrom: null });
        state = { mode: 'normal', schemaVersion: K.SCHEMA_VERSION, migrated: false, error: null };
      }
      require('./exercises').healCustom();
      return (state = withHealth(state));
    }
    if (meta.schemaVersion > K.SCHEMA_VERSION) {
      S.setReadOnly(true);
      return (state = withHealth({ mode: 'readonly', schemaVersion: meta.schemaVersion, migrated: false, error: null, message: '数据来自更新的版本，请更新小程序后再编辑' }));
    }
    let v = meta.schemaVersion, from = v;
    while (v < K.SCHEMA_VERSION) {
      if (!MIGRATIONS[v]) throw new Error('missing migration ' + v);
      MIGRATIONS[v](); v++;
    }
    if (from < K.SCHEMA_VERSION) S.set(K.META, Object.assign({}, meta, { schemaVersion: v, migratedAt: t, migratedFrom: from }));
    // Housekeeping is best effort: a failure here must not lock the session.
    try { cleanOrphans(); } catch (e) { /* retry next launch */ }
    try { require('./workouts').healHeaders(); } catch (e) { /* retry next launch */ }
    try { require('./exercises').healCustom(); } catch (e) { /* retry next launch */ }
    return (state = withHealth({ mode: 'normal', schemaVersion: v, migrated: from < v, error: null }));
  } catch (e) {
    // Migration failed: meta not written, next launch retries; block writes this session to avoid mixing formats.
    // A brand-new user (no data at all) has nothing to protect, so the session stays writable (QA S7).
    if (!freshUser) S.setReadOnly(true);
    const code = e.code || 'INIT_FAILED';
    return (state = withHealth({ mode: 'error', schemaVersion: null, migrated: false, readOnly: !freshUser,
      error: { code, message: (FRIENDLY[code] || '数据初始化失败') + (freshUser ? '，请稍后重试' : '，本次为只读，下次启动会重试') } }));
  }
}
// Remove fit_workout_* keys that no header references. Skipped entirely when headers or the key list are not trustworthy.
function cleanOrphans(workouts) {
  const list = workouts || S.getTyped(K.WORKOUTS, 'array', null);
  const h = S.getHealth();
  if (!list || h.corruptKeys.includes(K.WORKOUTS) || h.unreadableKeys.includes(K.WORKOUTS)) return;
  const all = S.keys(); if (!all) return;
  const ids = {}; list.forEach(w => { if (w && w.id) ids[w.id] = true; });
  all.forEach(k => {
    if (k.indexOf(K.DETAIL_PREFIX) === 0 && !ids[k.slice(K.DETAIL_PREFIX.length)]) { try { S.remove(k); } catch (e) { /* ignore */ } }
  });
}
const status = () => state;
// "重新加载": clear read-health flags and re-run the launch checks.
function reload() { return init(); }
module.exports = { init, status, getMeta, cleanOrphans, reload };
