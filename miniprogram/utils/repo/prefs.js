// UI preferences (fit_ui_prefs). Not part of the schema; failures are swallowed (prefs are best-effort).
const S = require('../storage');
const KEY = 'fit_ui_prefs';
function all() { return S.getTyped(KEY, 'object', {}); }
const get = (k, dflt) => (k in all() ? all()[k] : dflt);
function set(k, v) { if (S.isReadOnly()) return false; try { S.set(KEY, Object.assign(all(), { [k]: v })); return true; } catch (e) { return false; } }
module.exports = { KEY, get, set };
