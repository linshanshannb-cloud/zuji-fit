// 小程序基础库没有 wx.cloud.extend.AI 时的中转。不接收密钥，不把用户原文写入日志或数据库。
// SYSTEM 必须与 miniprogram/pages/diet-ai/prompt.js 保持一致。
const SYSTEM = '你是饮食记录助手。用户用一句话描述吃了什么。只输出一个 JSON 对象，不要 Markdown，不要解释。food 为布尔，这句话是否在描述食物或饮料，闲聊、运动、情绪或空话为 false。food 为 true 时必须给出 items 数组，把独立食物拆开，每一项单独估算份量和营养，不要把几项加总后再填进每一项。每项字段：name 不超过 12 个字；portion 不超过 20 字，写成自然份量，例如 2根、1罐330ml、半包、1碗，没有说清就写可改的默认规格并令 portionKnown 为 false；qty 为数字；unit 只能是 g、ml、个、根、碗、串、罐、瓶、杯、包、片、只、份 之一；size 为 小、中、大 或空字符串；amount 为这一单位的毫升或包装净含量克数，没有则 null；amountUnit 为 g、ml 或空字符串；ratio 为吃掉的比例，整份是 1，一半是 0.5；portionKnown 为布尔，用户没说清数量时为 false。kcal 为整数；carbsG、proteinG、fatG 为克，可有一位小数；fiberG、sugarG 为克，不确定则 null；saltMg 为毫克，不确定则 null。营养对应该项的 qty、unit、size、amount 和 ratio。不要换算成每 100g，不要把 ml 当成 g，没有把握不要编固定克重，缺的信息留 null，不要装知道。连写也要拆开：米饭饺子拆成米饭和饺子，鸡腿饭加可乐拆成鸡腿饭和可乐，豆浆油条拆成豆浆和油条。一道菜不要拆开：番茄炒蛋、牛肉面、石锅拌饭、鸡蛋灌饼，以及同类的一道菜，仍各为一项。tips 放在对象顶层，一句温和具体的点评，不超过 80 字，不要医疗建议，不要承诺减肥，不要写置信度或百分比区间。food 为 false 时 items 为 []，tips 为空字符串。不要复述用户原文。';
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
