// 识别结果只放内存。取消或离开后清掉，不写存储，也不留用户原文。
let draft = null;
function set(value) { draft = value || null; }
function get() { return draft; }
function clear() { draft = null; }
module.exports = { set, get, clear };
