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
  assert.deepStrictEqual(app.tabBar.list.map(t => t.text), ['日历', '动作库', '饮食', '身体数据']);
  assert.ok(fs.existsSync(path.join(MP, app.sitemapLocation)));
  assert.ok(fs.existsSync(path.join(MP, 'app.js')) && fs.existsSync(path.join(MP, 'app.wxss')));
});
test('T2 组件：usingComponents 路径都存在，组件 json 声明 component:true，四件套齐全', () => {
  for (const [tag, p] of Object.entries(app.usingComponents)) {
    for (const e of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(MP, p + '.' + e)), tag + '.' + e);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(MP, p + '.json'), 'utf8')).component, true, tag);
  }
});
function packIgnored(rel, rules) {
  const norm = rel.replace(/\\/g, '/');
  return rules.some(rule => {
    const v = String(rule.value || '').replace(/\\/g, '/');
    if (rule.type === 'folder') return norm === v || norm.startsWith(v + '/');
    if (rule.type === 'file') return norm === v;
    if (rule.type === 'suffix') return norm.endsWith(v);
    if (rule.type === 'prefix') return norm.startsWith(v) || norm.split('/').some(seg => seg.startsWith(v));
    if (rule.type === 'regexp') return new RegExp(v).test(norm);
    return false;
  });
}
test('T3 project.config.json：compileType=miniprogram，打包忽略 tests/scripts；主包体积 < 2MB（不含 subpackages）', () => {
  const pc = JSON.parse(fs.readFileSync(path.join(MP, 'project.config.json'), 'utf8'));
  assert.strictEqual(pc.compileType, 'miniprogram');
  const rules = pc.packOptions.ignore;
  const ign = rules.map(i => i.value); assert.ok(ign.includes('tests') && ign.includes('scripts'));
  const subRoots = (app.subpackages || []).map(s => s.root.replace(/\\/g, '/').replace(/\/$/, ''));
  const inSub = rel => subRoots.some(r => rel === r || rel.startsWith(r + '/'));
  let size = 0;
  for (const abs of walk(MP, '')) {
    const rel = path.relative(MP, abs).replace(/\\/g, '/');
    if (packIgnored(rel, rules) || inSub(rel)) continue;
    size += fs.statSync(abs).size;
  }
  assert.ok(size < 2 * 1024 * 1024, 'main size ' + size);
  assert.ok(size <= 1900 * 1024, 'main size above 1900KB target ' + size);
  for (const s of app.subpackages || []) {
    const root = s.root.replace(/\\/g, '/').replace(/\/$/, '');
    for (const page of s.pages) {
      const full = root + '/' + page;
      for (const e of ['js', 'json', 'wxml', 'wxss']) assert.ok(fs.existsSync(path.join(MP, full + '.' + e)), full + '.' + e);
    }
    const subSize = walk(path.join(MP, root), '').reduce((t, f) => t + fs.statSync(f).size, 0);
    assert.ok(subSize <= 2 * 1024 * 1024, root + ' size ' + subSize);
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
test('T5 动作库全量打包：主包只有索引，步骤在详情分包；云视频保留；不把 GIF 打进包', () => {
  const files = walk(MP, '.js').concat(walk(MP, '.wxml'), walk(MP, '.json'));
  const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
  assert.ok(!/catalogue\/media/i.test(src), '禁止 openGym catalogue/media 路径');
  const gifFiles = walk(MP, '.gif');
  assert.deepStrictEqual(gifFiles, [], '数据集 GIF 不进安装包');
  const js = require(path.join(MP, 'data/exercises.js'));
  const raw = require(path.resolve(MP, '../data/exercises.json'));
  const text = require(path.join(MP, 'pages/exercise-detail/exercise-text.js'));
  assert.strictEqual(js.placeholder, false);
  assert.ok(js.list.length >= 1324);
  assert.strictEqual(js.list.length, raw.length);
  assert.strictEqual(js.generatedFrom.packed, true);
  const bench = js.list.find(e => e.id === '0025');
  assert.strictEqual(bench.nameZh, '杠铃卧推');
  assert.ok(/^cloud:\/\/.+\/anim\/0025\.mp4$/.test(bench.video));
  assert.strictEqual(bench.steps.length, 0, '主包索引不带步骤正文');
  assert.strictEqual(text['0025'].s.length, raw.find(e => e.id === '0025').steps.length);
  assert.ok(text['0001'] && text['0001'].s.length > 0 && text['0001'].m);
  const withV = js.list.filter(e => e.video);
  assert.strictEqual(withV.length, raw.filter(e => e.video).length);
  assert.ok(withV.length >= 200);
  withV.forEach(e => {
    assert.ok(e.video === 'cloud://cloud1-d8gn4xfqredd566d1.636c-cloud1-d8gn4xfqredd566d1-1511089058/anim/' + e.id + '.mp4', e.id);
  });
  js.list.filter(e => e.poster).forEach(e => {
    assert.strictEqual(e.poster, '/assets/video-posters/' + e.id + '.jpg');
    assert.ok(fs.existsSync(path.join(MP, e.poster.replace(/^\//, ''))), e.poster);
  });
  for (const part of ['chest', 'back', 'shoulders', 'legs', 'arms', 'core']) {
    assert.ok(js.list.some(e => e.bodyPart === part), part);
  }
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
test('T8 filters 计数与 exercises.json 一致，六大部位都有条目', () => {
  const raw = require(path.resolve(MP, '../data/exercises.json')), f = require(path.resolve(MP, '../data/filters.json'));
  assert.ok(raw.length >= 1324);
  for (const k of ['bodyPart', 'bodyPartDetail', 'equipment', 'category']) f[k].forEach(o => assert.strictEqual(raw.filter(e => e[k] === o.value).length, o.count, k + ':' + o.value));
  f.muscles.forEach(o => assert.strictEqual(raw.filter(e => e.target === o.value || e.secondary.includes(o.value)).length, o.count, o.value));
  assert.deepStrictEqual(f.bodyPart.map(o => o.value), ['chest', 'back', 'shoulders', 'legs', 'arms', 'core']);
  f.bodyPart.forEach(o => assert.ok(o.count > 0, o.value));
});
test('T9 许可：AGPL/MIT 署名与许可证是否随小程序分发（DATA_NOTES 列为使用方待决事项）', () => {
  const src = walk(MP, '.wxml').concat(walk(MP, '.js').filter(f => !f.endsWith('data/exercises.js'))).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const inBundle = fs.readdirSync(MP).some(f => /license|notice/i.test(f));
  assert.ok(/openGym/i.test(src) || inBundle, '小程序包内没有任何 openGym 署名、版权声明或许可证文本（data/LICENSE-openGym 在 miniprogram/ 之外，不会被打包）');
});
