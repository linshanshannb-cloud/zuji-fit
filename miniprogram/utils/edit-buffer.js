// In-memory queue of edits that failed to reach storage. Survives page unload (module stays loaded)
// so leaving the editor and coming back can still show and retry every failed change, not just the last one.
const buckets = new Map();

function list(id) { return (buckets.get(id) || []).slice(); }
function has(id) { return !!(buckets.get(id) && buckets.get(id).length); }
function upsert(id, op) {
  if (!id || !op || !op.key) return;
  const arr = buckets.get(id) || [];
  const i = arr.findIndex(x => x.key === op.key);
  if (i >= 0) arr[i] = op; else arr.push(op);
  buckets.set(id, arr);
}
function forget(id, key) {
  const arr = (buckets.get(id) || []).filter(x => x.key !== key);
  if (arr.length) buckets.set(id, arr); else buckets.delete(id);
}
function clear(id) { buckets.delete(id); }
function apply(id, cards) {
  list(id).forEach(op => { if (typeof op.apply === 'function') op.apply(cards); });
  return cards;
}
function resetAll() { buckets.clear(); }
module.exports = { list, has, upsert, forget, clear, apply, resetAll };
