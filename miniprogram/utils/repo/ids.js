let seq = 0;
// prefix + Date.now base36 + random base36 (plus a counter to avoid same-ms collisions)
const newId = (prefix, now = Date.now()) => prefix + now.toString(36) + (seq++ % 1296).toString(36) + Math.random().toString(36).slice(2, 7);
module.exports = { newId };
