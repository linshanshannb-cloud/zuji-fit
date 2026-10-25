const repo = require('../utils/repo');
const S = require('../utils/storage');
// Fixed clock: 2026-10-17 10:00 local
const BASE = new Date(2026, 9, 17, 10, 0, 0).getTime();
function fresh(initial = {}, opts = {}) {
  let t = BASE;
  repo._setClock(() => (t += 1000));
  const be = S.memoryBackend(initial, opts);
  repo._setBackend(be);
  S.setReadOnly(false);
  return { repo, be, setTime: v => { t = v; } };
}
module.exports = { fresh, BASE, repo };
