// 优先走小程序基础库的 wx.cloud.extend.AI，没有再交给云函数 diet-recognize。不写密钥。
const Ai = require('../../../utils/diet-ai');
const { SYSTEM, MODELS } = require('../prompt');

function errText(e) {
  if (!e) return '';
  return String(e.errMsg || e.message || e.code || e);
}
function isModelMissing(e) {
  return /未启用|未开通|未找到模型|model.?not|ModelNot|invalid model|模型不存在|无可用模型|not exist|ModelNotEnabled/i.test(errText(e));
}
function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}
function failInfo(err) {
  const code = err && err.code;
  if (code === 'EMPTY') return { title: '先写一句话', message: '比如：下午吃了一块巧克力。' };
  if (code === 'LONG') return { title: '这句话有点长', message: '缩到 200 字以内再试。' };
  if (code === 'AI_UNAVAILABLE') return { title: '文字识别还不可用', message: '请先在云开发控制台开通大模型。也可以改成手动录入。' };
  return { title: '这次没有识别成功', message: '可以再试一次，或改成手动录入。' };
}
function deltaFrom(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const choice = data && data.choices && data.choices[0];
    const delta = choice && (choice.delta || choice.message);
    return (delta && delta.content) || '';
  } catch (e) { return ''; }
}
async function readStream(res) {
  const textStream = res && res.textStream;
  const eventStream = res && res.eventStream;
  const stream = textStream || eventStream;
  if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') return '';
  let out = '';
  for await (const chunk of stream) {
    if (chunk == null) continue;
    if (typeof chunk === 'string') {
      if (chunk === '[DONE]') break;
      out += textStream ? chunk : deltaFrom(chunk);
    } else if (chunk.data) {
      if (chunk.data === '[DONE]') break;
      out += deltaFrom(chunk.data);
    }
  }
  return out;
}
async function oneModel(provider, model, messages) {
  if (typeof provider.generateText === 'function') {
    const res = await provider.generateText({ model, messages });
    return Ai.extractContent(res);
  }
  if (typeof provider.streamText === 'function') {
    const res = await provider.streamText({ data: { model, messages } });
    return readStream(res);
  }
  throw fail('AI_UNAVAILABLE');
}
async function runModels(api, text) {
  const ai = api && api.cloud && api.cloud.extend && api.cloud.extend.AI;
  if (!ai || typeof ai.createModel !== 'function') throw fail('AI_UNAVAILABLE');
  const provider = ai.createModel('cloudbase');
  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }];
  let last = fail('AI_UNAVAILABLE');
  for (let i = 0; i < MODELS.length; i++) {
    try {
      const content = await oneModel(provider, MODELS[i], messages);
      if (content && String(content).trim()) return String(content);
      last = fail('AI_FAIL');
    } catch (e) {
      last = e;
      if (!isModelMissing(e) && e.code !== 'AI_UNAVAILABLE') break;
    }
  }
  throw last && last.code ? last : fail('AI_FAIL');
}
function callFunction(api, text) {
  return new Promise((resolve, reject) => {
    if (!api || !api.cloud || typeof api.cloud.callFunction !== 'function') {
      reject(fail('AI_UNAVAILABLE'));
      return;
    }
    let settled = false;
    const ok = res => { if (settled) return; settled = true; resolve(res); };
    const bad = err => { if (settled) return; settled = true; reject(err); };
    let ret;
    try {
      ret = api.cloud.callFunction({
        name: 'diet-recognize',
        data: { text },
        success: ok,
        fail: bad,
      });
    } catch (e) { bad(e); return; }
    if (ret && typeof ret.then === 'function') ret.then(ok, bad);
  });
}
async function runFunction(api, text) {
  const res = await callFunction(api, text);
  const body = res && (res.result || res);
  if (body && body.ok && body.content) return String(body.content);
  throw fail('AI_UNAVAILABLE');
}
async function recognize(text, deps) {
  const api = (deps && deps.wx) || (typeof wx !== 'undefined' ? wx : null);
  const trimmed = String(text || '').trim();
  if (!trimmed) throw fail('EMPTY');
  if (trimmed.length > 200) throw fail('LONG');
  try {
    return await runModels(api, trimmed);
  } catch (e) {
    try {
      return await runFunction(api, trimmed);
    } catch (e2) {
      if (e && e.code === 'AI_UNAVAILABLE') throw e;
      if (e2 && e2.code === 'AI_UNAVAILABLE' && (!e || !e.code)) throw e2;
      if (e && e.code) throw e;
      throw fail('AI_FAIL');
    }
  }
}

module.exports = { recognize, failInfo, isModelMissing };
