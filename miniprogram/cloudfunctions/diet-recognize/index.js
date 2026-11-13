// 小程序基础库没有 wx.cloud.extend.AI 时的中转。不接收密钥，不把用户原文写入日志或数据库。
// SYSTEM 必须与 miniprogram/pages/diet-ai/prompt.js 保持一致。
const SYSTEM = '你是饮食记录助手。用户用一句话描述吃了什么。只输出一个 JSON 对象，不要 Markdown，不要解释。food 为布尔，这句话是否在描述食物或饮料，闲聊、运动、情绪或空话为 false。name 为食物名，不超过 12 个字，多种食物合并成一条并用简短总称。portion 为份量描述，不超过 20 字，没有则空字符串。kcal 为这一份的估算热量，整数。carbsG、proteinG、fatG 为克，可有一位小数。fiberG、sugarG 为克，不确定则 null。saltMg 为盐或钠的毫克数，不确定则 null。tips 为一句温和具体的点评，不超过 80 字，不要医疗建议，不要承诺减肥。food 为 false 时数字用 0，name、portion、tips 用空字符串。不要复述用户原文，不要输出数组。';
const MODELS = ['hy3', 'deepseek-v4.1-flash'];

function loadSdk() {
  const name = '@cloudbase/' + 'node-sdk';
  return require(name);
}
function extract(res, depth) {
  if (!res || (depth || 0) > 2) return '';
  if (typeof res === 'string') return res;
  if (typeof res.text === 'string' && res.text.trim()) return res.text;
  const choice = res.choices && res.choices[0];
  const msg = choice && (choice.message || choice.delta);
  if (msg && msg.content) return String(msg.content);
  if (res.data && res.data !== res) {
    const inner = extract(res.data, (depth || 0) + 1);
    if (inner) return inner;
  }
  return '';
}
function missing(err) {
  const s = String((err && (err.message || err.code)) || err || '');
  return /未启用|未开通|ModelNot|model.?not|invalid model|不存在/i.test(s);
}

exports.main = async (event) => {
  const text = event && typeof event.text === 'string' ? event.text.trim() : '';
  if (!text) return { ok: false, code: 'EMPTY' };
  if (text.length > 500) return { ok: false, code: 'LONG' };
  let sdk;
  try { sdk = loadSdk(); } catch (e) { return { ok: false, code: 'AI_UNAVAILABLE' }; }
  const app = sdk.init({ env: sdk.SYMBOL_CURRENT_ENV });
  const provider = app.ai().createModel('cloudbase');
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }];
  let last = 'AI_UNAVAILABLE';
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const res = await provider.generateText({ model: MODELS[i], messages });
      const content = extract(res);
      if (content && content.trim()) return { ok: true, content, model: MODELS[i] };
      last = 'AI_FAIL';
    } catch (e) {
      last = missing(e) ? 'AI_UNAVAILABLE' : 'AI_FAIL';
      if (!missing(e)) break;
    }
  }
  return { ok: false, code: last };
};
