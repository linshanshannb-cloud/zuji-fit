// 计时结束提示：短促三声（assets/audio/timer-end.mp3，约 3.5KB）+ 长振动。
// 基础库 ≥2.3.0 起 InnerAudioContext.obeyMuteSwitch 已被忽略，需 wx.setInnerAudioOption（仅 iOS 静音键）。
// 仍写属性以兼容更老基础库。开关在本地偏好 timerSound（默认开）。失败一律吞掉，不影响计时。
const prefs = require('./repo/prefs');
const SRC = '/assets/audio/timer-end.mp3';
let optionSet = false;
function enabled() {
  try { return prefs.get('timerSound', true) !== false; } catch (e) { return true; }
}
function setEnabled(on) { try { return prefs.set('timerSound', !!on); } catch (e) { return false; } }
function applyOption() {
  if (optionSet || typeof wx === 'undefined' || typeof wx.setInnerAudioOption !== 'function') return;
  try { wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); optionSet = true; } catch (e) { /* noop */ }
}
// Plays once. A fresh context per play, destroyed on end/error/stop, with a 4s fallback. Never throws.
function play() {
  try {
    if (typeof wx === 'undefined' || typeof wx.createInnerAudioContext !== 'function') return false;
    applyOption();
    const a = wx.createInnerAudioContext();
    a.obeyMuteSwitch = false;
    a.volume = 1;
    let freed = false;
    const free = () => { if (freed) return; freed = true; try { a.destroy(); } catch (e) { /* noop */ } };
    try { a.onEnded(free); } catch (e) { /* noop */ }
    try { a.onError(free); } catch (e) { /* noop */ }
    try { if (a.onStop) a.onStop(free); } catch (e) { /* noop */ }
    const timer = setTimeout(free, 4000);
    if (timer && typeof timer.unref === 'function') timer.unref();
    a.src = SRC;
    a.play();
    return true;
  } catch (e) { return false; }
}
function vibrate() { try { if (typeof wx !== 'undefined' && wx.vibrateLong) wx.vibrateLong(); } catch (e) { /* noop */ } }
// Countdown finished: sound (if enabled) + vibration. Muting keeps the vibration.
function alertDone() { try { if (enabled()) play(); } catch (e) { /* noop */ } vibrate(); }
module.exports = { SRC, enabled, setEnabled, play, vibrate, alertDone };
