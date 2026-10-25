// 组间歇：时长偏好（本地 prefs）+ 纯计时逻辑（按时间戳计算，切后台回来自动校准）。
const MIN = 15, MAX = 600, DEFAULT = 90;
const clamp = s => { const n = Number(s); if (!isFinite(n)) return DEFAULT; return Math.max(MIN, Math.min(MAX, Math.round(n / 5) * 5)); };
function prefsApi(prefs) {
  return {
    getDefault() { const v = prefs.get('restDefault', DEFAULT); return clamp(v); },
    setDefault(s) { return prefs.set('restDefault', clamp(s)); },
    getFor(exerciseId) { const m = prefs.get('restByExercise', {}) || {}; return m[exerciseId] ? clamp(m[exerciseId]) : this.getDefault(); },
    getOverride(exerciseId) { const m = prefs.get('restByExercise', {}) || {}; return m[exerciseId] ? clamp(m[exerciseId]) : 0; },
    setFor(exerciseId, s) { const m = Object.assign({}, prefs.get('restByExercise', {}) || {}); if (s) m[exerciseId] = clamp(s); else delete m[exerciseId]; return prefs.set('restByExercise', m); },
    overrides() { return Object.assign({}, prefs.get('restByExercise', {}) || {}); },
  };
}
/** 计时器状态：{ endAt, total }；remaining 向上取整秒 */
function start(secs, now) { const s = Math.max(1, Math.round(secs)); return { endAt: now + s * 1000, total: s }; }
function remaining(t, now) { return t ? Math.max(0, Math.ceil((t.endAt - now) / 1000)) : 0; }
function adjust(t, delta, now) {
  if (!t) return t;
  const left = Math.max(0, remaining(t, now) + delta);
  return { endAt: now + left * 1000, total: Math.max(t.total + delta, left, 1) };
}
const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
module.exports = { MIN, MAX, DEFAULT, clamp, prefsApi, start, remaining, adjust, fmt };
