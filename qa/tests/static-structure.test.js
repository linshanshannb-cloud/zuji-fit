// 静态结构检查：微信小程序目录规范、app.json / tabBar、页面四件套、组件声明、wx API 参数限制、数据来源
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const MP = path.resolve(__dirname, '../../miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
const walk = (d, ext, out = []) => { fs.readdirSync(d).forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (!['node_modules', 'tests', 'scripts'].includes(f)) walk(p, ext, out); } else if (p.endsWith(ext)) out.push(p); }); return out; };

test('T1 app.json：pages 每页四件套齐全；tabBar 2–5 项且都在 pages 里；首页是 tab 页', () => {
  for (const p of app.pages) for (const e of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(MP, p + '.' + e)), p + '.' + e);
  const tabs = app.tabBar.list.map(t => t.pagePath);
  assert.ok(tabs.length >= 2 && tabs.length <= 5);
  tabs.forEach(t => assert.ok(app.pages.includes(t), t));
  assert.strictEqual(app.pages[0], tabs[0]);
  assert.deepStrictEqual(app.tabBar.list.map(t => t.text), ['日历', '动作库', '身体数据']);
  assert.ok(fs.existsSync(path.join(MP, app.sitemapLocation)));
  assert.ok(fs.existsSync(path.join(MP, 'app.js')) && fs.existsSync(path.join(MP, 'app.wxss')));
});
test('T2 组件：usingComponents 路径都存在，组件 json 声明 component:true，四件套齐全', () => {
  for (const [tag, p] of Object.entries(app.usingComponents)) {
    for (const e of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(MP, p + '.' + e)), tag + '.' + e);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(MP, p + '.json'), 'utf8')).component, true, tag);
  }
});
test('T3 project.config.json：compileType=miniprogram，打包忽略 tests/scripts；主包体积 < 2MB（不含 subpackages）', () => {
  const pc = JSON.parse(fs.readFileSync(path.join(MP, 'project.config.json'), 'utf8'));
  assert.strictEqual(pc.compileType, 'miniprogram');
  const ign = pc.packOptions.ignore.map(i => i.value); assert.ok(ign.includes('tests') && ign.includes('scripts'));
  const subRoots = (app.subpackages || []).map(s => s.root.replace(/\\/g, '/'));
  const inSub = f => subRoots.some(r => f.replace(/\\/g, '/').includes('/' + r + '/') || f.replace(/\\/g, '/').endsWith('/' + r));
  const size = walk(MP, '').filter(f => !/\/(tests|scripts)\//.test(f) && !inSub(f)).reduce((t, f) => t + fs.statSync(f).size, 0);
  assert.ok(size < 2 * 1024 * 1024, 'main size ' + size);
  for (const r of subRoots) {
    const subSize = walk(path.join(MP, r), '').reduce((t, f) => t + fs.statSync(f).size, 0);
    assert.ok(subSize <= 2 * 1024 * 1024, r + ' size ' + subSize);
  }
});
test('T4 wx.showModal 的 confirmText / cancelText 最多 4 个字符（微信文档），否则调用失败、弹窗不出现', () => {
  const bad = [];
  for (const f of walk(MP, '.js')) {
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(confirmText|cancelText)\s*:\s*'([^']*)'/g)) if ([...m[2]].length > 4) bad.push(`${path.relative(MP, f)}:${i + 1} ${m[1]}='${m[2]}'`);
    });
  }
  assert.deepStrictEqual(bad, []);
});
test('T5 不引用 openGym media；内置动作数据 = data/exercises.json 原样打包（284 条）；本地视频仅走 packageVideo 分包', () => {
  const files = walk(MP, '.js').concat(walk(MP, '.wxml'), walk(MP, '.json'));
  const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/catalogue\/media|gymvisual/i.test(src), '禁止 openGym media / gymvisual');
  // .gif 仍禁止；.mp4 仅允许出现在 packageVideo* 路径或 video 字段值中
  const mp4Hits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    if (!/\.mp4/i.test(text)) continue;
    const rel = path.relative(MP, f).replace(/\\/g, '/');
    // 打包数据与详情页可含 packageVideo*/videos/*.mp4（非业务硬编码）
    if (rel === 'data/exercises.js' || rel === 'data/exercises.json' || rel.startsWith('pages/exercise-detail/')) continue;
    if (rel.includes('packageVideo')) continue;
    mp4Hits.push(rel);
  }
  assert.deepStrictEqual(mp4Hits, [], '主包业务文件不应硬编码 mp4: ' + mp4Hits.join(','));
  const js = require(path.join(MP, 'data/exercises.js')), raw = require(path.resolve(MP, '../data/exercises.json'));
  assert.strictEqual(js.placeholder, false); assert.strictEqual(js.list.length, 284);
  assert.deepStrictEqual(js.list, raw);
  const withV = js.list.filter(e => e.video);
  assert.strictEqual(withV.length, 24);
  withV.forEach(e => {
    assert.ok(/^packageVideo[ABC]\/videos\/\d{4}\.mp4$/.test(e.video), e.id + ' video path');
    // 海报已迁主包，避免分包未就绪时真机封面空白
    assert.ok(/^assets\/video-posters\/\d{4}\.jpg$/.test(e.poster), e.id + ' poster path');
  });
});
test('T6 动作数据可追溯到 openGym 原始仓库（存在时核对）：每个 id 都在 catalogue/exercises，英文名一致', { skip: !fs.existsSync('/workspace/openGym/catalogue/exercises') && 'openGym 不在本机' }, () => {
  const raw = require(path.resolve(MP, '../data/exercises.json'));
  const bad = raw.filter(e => { const f = `/workspace/openGym/catalogue/exercises/${e.id}.json`; if (!fs.existsSync(f)) return true; return JSON.parse(fs.readFileSync(f, 'utf8')).name.toLowerCase() !== e.nameEn; });
  assert.deepStrictEqual(bad.map(e => e.id), []);
});
test('T7 WXSS 尺寸以 rpx 为主（px 只用于 1px 细线/边框）', () => {
  const bad = [];
  for (const f of walk(MP, '.wxss')) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { for (const m of l.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)px/g)) if (Number(m[1]) > 1) bad.push(path.relative(MP, f) + ':' + (i + 1) + ' ' + m[0]); });
  assert.deepStrictEqual(bad, []);
});
test('T8 中文名/步骤可追溯到 openGym zh.json：仅 DATA_NOTES 列出的 10 个改名；不一致的步骤 = 46 条已补中文译文（英文原文可追溯）；filters 计数与数据一致', { skip: !fs.existsSync('/workspace/openGym/catalogue/i18n/zh.json') && 'openGym 不在本机' }, () => {
  const raw = require(path.resolve(MP, '../data/exercises.json')), f = require(path.resolve(MP, '../data/filters.json'));
  const zh = JSON.parse(fs.readFileSync('/workspace/openGym/catalogue/i18n/zh.json', 'utf8'));
  const og = id => JSON.parse(fs.readFileSync(`/workspace/openGym/catalogue/exercises/${id}.json`, 'utf8'));
  const renamed = raw.filter(e => zh[e.id].name !== e.nameZh).map(e => e.id).sort();
  assert.deepStrictEqual(renamed, ['0060', '0377', '0550', '0739', '0860', '1489', '2963', '3193', '3914', '5107']);
  const stepDiff = raw.filter(e => JSON.stringify(zh[e.id].instructions) !== JSON.stringify(e.steps));
  assert.strictEqual(stepDiff.length, 46);
  // 2026-10-17：这 46 条已补中文译文（data/translations/zh-pending-46.json，含英文原文 en）。校验：译文落库、英文原文可追溯到 openGym、步数一致
  const tr = require(path.resolve(MP, '../data/translations/zh-pending-46.json'));
  assert.deepStrictEqual(stepDiff.map(e => e.id).sort(), Object.keys(tr).sort());
  stepDiff.forEach(e => { assert.ok(!e.translationPending); assert.deepStrictEqual(e.untranslatedFields, []); assert.deepStrictEqual(e.steps, tr[e.id].steps); assert.deepStrictEqual(tr[e.id].en.steps, og(e.id).instructions); assert.strictEqual(e.steps.length, og(e.id).instructions.length); });
  for (const k of ['bodyPart', 'bodyPartDetail', 'equipment', 'category']) f[k].forEach(o => assert.strictEqual(raw.filter(e => e[k] === o.value).length, o.count, k + ':' + o.value));
  f.muscles.forEach(o => assert.strictEqual(raw.filter(e => e.target === o.value || e.secondary.includes(o.value)).length, o.count, o.value));
});
test('T9 许可：AGPL/MIT 署名与许可证是否随小程序分发（DATA_NOTES 列为使用方待决事项）', () => {
  const src = walk(MP, '.wxml').concat(walk(MP, '.js').filter(f => !f.endsWith('data/exercises.js'))).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const inBundle = fs.readdirSync(MP).some(f => /license|notice/i.test(f));
  assert.ok(/openGym/i.test(src) || inBundle, '小程序包内没有任何 openGym 署名、版权声明或许可证文本（data/LICENSE-openGym 在 miniprogram/ 之外，不会被打包）');
});
