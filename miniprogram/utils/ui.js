// Thin UI helpers shared by pages (no business logic).
const repo = require('./repo/index');
const T = require('./tokens');
let fails = 0;
const roMsg = () => (repo.status() && repo.status().message) || '数据暂不可编辑，请更新小程序或重新进入';
const QUOTA_MODAL = '手机存储空间不足，无法保存。请清理微信缓存后重试';
const WRITE_MODAL = '保存失败，请重试。已填写的内容还在，不会被清掉';
// Show a repo result. Returns true when ok.
// Only QUOTA_EXCEEDED talks about storage space. A plain WRITE_FAILED must not.
// Two consecutive storage failures escalate to a modal; the copy follows the latest code.
function handle(r, { silent = false } = {}) {
  if (r && r.ok) { fails = 0; return true; }
  const code = r && r.code;
  if (code === 'QUOTA_EXCEEDED' || code === 'WRITE_FAILED') {
    fails++;
    const quota = code === 'QUOTA_EXCEEDED';
    if (!silent) {
      if (fails >= 2) wx.showModal({ title: '无法保存', content: quota ? QUOTA_MODAL : WRITE_MODAL, showCancel: false });
      else wx.showToast({ title: quota ? '保存失败：存储空间不足' : '保存失败，请重试', icon: 'none' });
    }
    return false;
  }
  if (code === 'READ_ONLY') { wx.showToast({ title: roMsg(), icon: 'none' }); return false; }
  if (code === 'DATA_CORRUPT') { wx.showToast({ title: '数据读取异常，已暂停保存以保护原数据', icon: 'none' }); return false; }
  if (!silent) wx.showToast({ title: (r && r.message) || '操作失败', icon: 'none' });
  return false;
}
// Guard write entry points in read-only mode (§7.3).
function canWrite() { if (repo.isReadOnly()) { wx.showToast({ title: roMsg(), icon: 'none' }); return false; } return true; }
// Red confirm dialog (DESIGN §4.9). cb(true) only when confirmed.
function confirmDelete({ title, content, confirmText = '删除' }, cb) {
  wx.showModal({ title, content, confirmText, confirmColor: T.DANGER, success: m => { if (m.confirm) cb(); } });
}
function _resetFails() { fails = 0; }
module.exports = { handle, canWrite, confirmDelete, _resetFails };
