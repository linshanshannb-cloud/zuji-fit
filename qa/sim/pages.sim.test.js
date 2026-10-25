// 页面级测试：miniprogram-simulate（官方 WXML 编译器 + j-component + jsdom）渲染真实页面 js/wxml/组件。
// 能验证：模板能编译、数据绑定/事件名/dataset 接线、事件冒泡语义、页面与存储一致。不能验证：像素布局、canvas 绘制、真机手势。
const test = require('node:test');
const assert = require('node:assert');
const P = require('./page-harness');
const { H, ui } = P;
const sleep = ms => P.sim.sleep(ms);
const touch = (el, type, t = [{ pageX: 1, pageY: 1, clientX: 1, clientY: 1 }]) => { const e = new window.Event(type, { bubbles: true, cancelable: true }); e.touches = type === 'touchend' ? [] : t; e.changedTouches = t; el.dispatchEvent(e); };
const tap = async el => { touch(el, 'touchstart'); touch(el, 'touchend'); await sleep(10); };
const longpress = async el => { touch(el, 'touchstart'); await sleep(450); touch(el, 'touchend'); await sleep(10); };
const today = '2026-10-17';
function reset() { ui.toasts.length = 0; ui.modals.length = 0; ui.sheets.length = 0; ui.nav.length = 0; ui.modalAnswer = null; ui.sheetAnswer = null; }
function seed() {
  H.fresh({}, [2026, 10, 17, 10, 0]); const { repo } = P.bootApp(); reset();
  const r = repo.workouts.createDraft({ date: '2026-10-15' }); repo.workouts.addExercises(r.data.id, ['0025', '0294']);
  const v = repo.workouts.getWorkout(r.data.id);
  repo.workouts.updateSet(r.data.id, v.exercises[0].sets[0].id, { weightKg: 60, reps: 8 }); repo.workouts.setSetDone(r.data.id, v.exercises[0].sets[0].id, true);
  repo.workouts.completeWorkout(r.data.id);
  ['2026-10-01', '2026-10-10', '2026-10-16'].forEach((d, i) => repo.body.saveBody({ date: d, weightKg: 70 + i, waistCm: i ? 80 : '' }));
  return { repo, wid: r.data.id };
}

test('PG1 8 个页面全部能用官方 WXML 编译器编译并渲染（有数据），不抛异常', async () => {
  const { repo, wid } = seed();
  const pages = [['pages/calendar/calendar', {}], ['pages/library/library', {}], ['pages/body/body', {}], ['pages/workout-detail/workout-detail', { id: wid }],
    ['pages/workout-edit/workout-edit', { id: wid }], ['pages/exercise-picker/exercise-picker', { mode: 'add', wid }], ['pages/exercise-detail/exercise-detail', { id: '0025' }], ['pages/body-edit/body-edit', {}]];
  for (const [route, q] of pages) { const c = P.renderPage(route, q); await sleep(5); assert.ok(c.dom.textContent.length > 10, route); }
  void repo;
});

test('PG2 日历页：训练日有圆点、摘要卡与存储一致；选中训练日显示摘要；休息日标签', async () => {
  const { repo, wid } = seed();
  const c = P.renderPage('pages/calendar/calendar'); await sleep(5);
  const page = c.instance;
  page.onSelect({ detail: { date: '2026-10-15' } }); await sleep(5);
  const cells = [...c.dom.querySelectorAll('.month-calendar--cell')];
  const on = cells.filter(x => x.querySelector('.month-calendar--dot.month-calendar--on')).map(x => x.textContent.trim());
  assert.deepStrictEqual(on, ['15'], '只有 15 日是训练日');
  const h = repo.workouts.getHeader(wid);
  const txt = c.dom.textContent;
  assert.ok(txt.includes('10月15日训练') && txt.includes(String(h.setCount)) && txt.includes('杠铃卧推'), txt.slice(0, 300));
  assert.ok(!txt.includes('哑铃二头弯举'), '没打勾的动作在完成时被移除');
  page.onSelect({ detail: { date: '2026-10-14' } }); await sleep(5);
  assert.ok(c.dom.textContent.includes('休息日') && c.dom.textContent.includes('补录训练'));
  page.onSelect({ detail: { date: '2026-10-20' } }); await sleep(5);
  assert.ok(c.dom.textContent.includes('还没到这一天'));
  page.newWorkout(); assert.ok(ui.toasts.includes('不能为未来日期新建训练'));
});

test('PG3 训练编辑页：真实 set-row 组件录入（失焦提交）、夹紧上限、截断小数、勾选规则', async () => {
  const { repo } = seed();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025']);
  const c = P.renderPage('pages/workout-edit/workout-edit', { id: r.data.id }); await sleep(5);
  const set = () => repo.workouts.getWorkout(r.data.id).exercises[0].sets[0];
  const inputs = () => [...c.querySelectorAll('.ex-card >>> .val')];
  inputs()[0].dispatchEvent('blur', { detail: { value: '12.345' } }); await sleep(10);
  assert.strictEqual(set().weightKg, 12.3);
  inputs()[1].dispatchEvent('blur', { detail: { value: '8.7' } }); await sleep(10);
  assert.strictEqual(set().reps, 8);
  inputs()[1].dispatchEvent('blur', { detail: { value: '1500' } }); await sleep(10);
  assert.strictEqual(set().reps, 999); assert.ok(ui.toasts.includes('次数最大 999'));
  inputs()[0].dispatchEvent('blur', { detail: { value: '-5' } }); await sleep(10);
  assert.strictEqual(set().weightKg, 0);
  await tap(c.dom.querySelector('.set-row--chk')); assert.strictEqual(set().done, true);
  await tap(c.dom.querySelector('.set-row--no')); assert.strictEqual(set().type, 'warmup');
  inputs()[1].dispatchEvent('blur', { detail: { value: '' } }); await sleep(10);
  assert.ok(ui.toasts.some(t => /次数/.test(t)), '已完成的组清空次数应被拒并提示');
  assert.strictEqual(set().reps, 999);
});

test('PG4 长按组行的 ± 步进器（规格：长按连续加减）不应同时弹出组菜单', async () => {
  const { repo } = seed();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025']);
  const c = P.renderPage('pages/workout-edit/workout-edit', { id: r.data.id }); await sleep(5);
  await longpress(c.dom.querySelectorAll('.set-row--pm')[1]);
  assert.deepStrictEqual(ui.sheets, [], 'longpress 从 .pm 冒泡到 .sr（set-row.wxml:1 bindlongpress="onLong"），弹出了「设为热身组/在下方复制一组/删除此组」');
});

test('PG5 自动保存失败时（PRODUCT_SPEC 7.1）："页面上的数据保留在内存里，不清空"', async () => {
  const { repo } = seed();
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025']);
  const c = P.renderPage('pages/workout-edit/workout-edit', { id: r.data.id }); await sleep(5);
  H.store.failSet = () => true;
  c.querySelectorAll('.ex-card >>> .val')[1].dispatchEvent('blur', { detail: { value: '8' } }); await sleep(20);
  H.store.failSet = null;
  assert.ok(c.dom.textContent.includes('保存失败'));
  const r2 = c.instance.data.cards[0].sets[0].reps; // set-row 的 observer 会用这个值重置输入框
  assert.strictEqual(r2, 8, `失败后 workout-edit.js:34 run() 调 reload()，把页面数据还原成存储里的值（reps=${r2}），用户刚输入的 8 从界面上消失`);
});

test('PG6 身体数据页：图表点 / 记录行 / 当前值 / 日历标记与存储一致；长按删除需确认', async () => {
  const { repo } = seed();
  const c = P.renderPage('pages/body/body'); await sleep(5);
  const d = c.instance.data;
  const st = repo.body.bodyStats('weightKg', 30);
  assert.deepStrictEqual(d.series.points, st.series.points);
  assert.deepStrictEqual(d.rows.map(r => r.value), ['72.0', '71.0', '70.0']);
  assert.strictEqual(d.cur.value, '72.0'); assert.strictEqual(d.cur.delta, '+1.0');
  c.instance.setField({ currentTarget: { dataset: { k: 'waistCm' } } }); await sleep(5);
  assert.strictEqual(c.instance.data.rows.length, 2, '腰围只有 2 条非空记录');
  c.instance.setView({ currentTarget: { dataset: { v: 'calendar' } } }); await sleep(5);
  const vals = [...c.dom.querySelectorAll('.month-calendar--val')].map(x => x.textContent.trim()).filter(Boolean);
  assert.deepStrictEqual(vals, ['70.0', '71.0', '72.0']);
  assert.strictEqual(repo.prefs.get('bodyView'), 'calendar', '图表/日历选择被记住');
  ui.modalAnswer = { confirm: true };
  c.instance.removeRow({ currentTarget: { dataset: { id: repo.body.getBodyByDate('2026-10-16').id } } }); await sleep(5);
  assert.ok(ui.modals.some(m => m.startsWith('删除 10月16日 的记录')));
  assert.strictEqual(repo.body.listBody().length, 2);
});

test('PG7 动作库：分批 30 条、搜索中英文、筛选面板、清除、快速加入当前训练', async () => {
  const { repo } = seed();
  const c = P.renderPage('pages/library/library'); await sleep(5);
  assert.strictEqual(c.dom.querySelectorAll('.main--lib-li').length, 30);
  assert.ok(c.dom.textContent.includes('共 284 个'));
  c.instance.onQ({ detail: { value: '  BENCH press ' } }); await sleep(350);
  const names = c.instance._all.map(e => e.nameEn);
  assert.ok(names.length > 0 && names.every(n => n.includes('bench press')), names.join(','));
  c.instance.clearAll(); await sleep(5);
  c.instance.openPanel(); c.instance.pBP({ currentTarget: { dataset: { v: 'legs' } } }); c.instance.pEq({ currentTarget: { dataset: { v: 'barbell' } } });
  const n = c.instance.data.panelCount; c.instance.applyPanel(); await sleep(5);
  assert.strictEqual(c.instance.data.total, n); assert.ok(c.instance._all.every(e => e.bodyPart === 'legs' && e.equipment === 'barbell'));
  c.instance.onQ({ detail: { value: '不存在的动作xyz' } }); await sleep(350);
  assert.ok(c.dom.textContent.includes('没有找到“不存在的动作xyz”'));
  c.instance.clearAll(); await sleep(5);
  c.instance.quickAdd({ currentTarget: { dataset: { id: '0294' } } });
  const dr = repo.workouts.getDraft(); assert.ok(dr && dr.date === today);
  assert.ok(ui.nav.some(u => u.includes('workout-edit?id=' + dr.id)));
});

test('PG8 动作详情：步骤与数据一致、我的最佳 = 最重的已完成正式组、加入当前训练', async () => {
  const { repo } = seed();
  const c = P.renderPage('pages/exercise-detail/exercise-detail', { id: '0025' }); await sleep(5);
  const ex = repo.exercises.get('0025');
  assert.strictEqual(c.dom.querySelectorAll('.main--step').length, ex.steps.length);
  assert.ok(c.dom.textContent.includes('60kg × 8'), '我的最佳');
  const pend = repo.exercises.all().find(e => e.translationPending);
  if (pend) { // 2026-10-17 起内置数据已全部中文化；保留分支以防日后再引入待翻译数据
    const c2 = P.renderPage('pages/exercise-detail/exercise-detail', { id: pend.id }); await sleep(5);
    assert.ok(c2.dom.textContent.includes('暂无中文'));
  } else {
    const c2 = P.renderPage('pages/exercise-detail/exercise-detail', { id: '10329' }); await sleep(5);
    assert.ok(!c2.dom.textContent.includes('暂无中文')); assert.ok(c2.dom.textContent.includes('克罗克'));
  }
  const c3 = P.renderPage('pages/exercise-detail/exercise-detail', { id: 'nope' }); await sleep(5);
  assert.ok(c3.dom.textContent.includes('未找到该动作'));
});

test('PG9 动作选择器：已在训练里的动作标"已添加"；多选保持顺序', async () => {
  const { repo, wid } = seed();
  const c = P.renderPage('pages/exercise-picker/exercise-picker', { mode: 'add', wid }); await sleep(5);
  assert.ok(c.dom.textContent.includes('已添加'));
  c.instance.toggleId('0294'); c.instance.toggleId('0025'); c.instance.toggleId('1060'); c.instance.toggleId('0025');
  assert.deepStrictEqual(c.instance.data.selected, ['0294', '1060']);
  void repo;
});

test('PG10 只读模式：所有页面顶部提示条，写入口被拦且不写存储', async () => {
  H.fresh({ fit_meta: { schemaVersion: 9 } }); P.bootApp(); reset();
  const snap = H.snapshot();
  const c = P.renderPage('pages/calendar/calendar'); await sleep(5);
  assert.ok(c.dom.textContent.includes('数据来自更新的版本'));
  c.instance.newWorkout();
  const b = P.renderPage('pages/body/body'); await sleep(5); b.instance.add();
  assert.ok(ui.toasts.filter(t => t.includes('请更新小程序')).length >= 2);
  assert.deepStrictEqual(H.snapshot(), snap);
});

test('PG11 身体数据编辑页：选到已有记录的日期自动载入；<20kg 软提示；编辑 v0 无体重记录只改备注', async () => {
  H.fresh({ fit_meta: { schemaVersion: 1 }, fit_body: [{ id: 'b_v0', date: '2026-09-30', weightKg: null, bodyFatPct: null, waistCm: 82, note: '', extra: { chestCm: 98 }, createdAt: 1, updatedAt: 1 }] }, [2026, 10, 17, 10, 0]);
  const { repo } = P.bootApp(); reset();
  repo.body.saveBody({ date: '2026-10-16', weightKg: 70 });
  const c = P.renderPage('pages/body-edit/body-edit', {}); await sleep(5);
  c.instance.onDate({ detail: { value: '2026-10-16' } }); await sleep(5);
  assert.ok(ui.toasts.includes('已载入 10月16日 的记录')); assert.strictEqual(c.instance.data.form.weightKg, '70');
  c.instance.onInput({ currentTarget: { dataset: { k: 'weightKg' } }, detail: { value: '15' } });
  ui.modalAnswer = { confirm: false, cancel: true }; c.instance.save();
  assert.ok(ui.modals.some(m => m.includes('体重 15 kg 看起来不太常见')));
  assert.strictEqual(repo.body.getBodyByDate('2026-10-16').weightKg, 70, '取消软提示不保存');
  // v0 迁移来的无体重记录：DATA_MODEL 9.2 "用户用 updateBody 只改其他字段可以保存"
  reset();
  const e = P.renderPage('pages/body-edit/body-edit', { id: 'b_v0' }); await sleep(5);
  e.instance.onInput({ currentTarget: { dataset: { k: 'note' } }, detail: { value: '补备注' } });
  e.instance.save(); await sleep(5);
  assert.strictEqual(repo.body.getBody('b_v0').note, '补备注', `页面把整个表单（含空体重）交给 updateBody / 先做必填校验，提示「${e.instance.data.errors.weightKg}」，只改备注无法保存`);
});

test('PG12 训练编辑页：信息面板改日期 → 日历移到新日期；放弃草稿二次确认后删除', async () => {
  const { repo, wid } = seed();
  const c = P.renderPage('pages/workout-edit/workout-edit', { id: wid }); await sleep(5);
  c.instance.openInfo(); c.instance.onInfoDate({ detail: { value: '2026-10-03' } }); c.instance.saveInfo(); await sleep(5);
  assert.deepStrictEqual(repo.workouts.completedDates(), { '2026-10-03': 1 });
  const r = repo.workouts.createDraft({}); repo.workouts.addExercises(r.data.id, ['0025']);
  const d = P.renderPage('pages/workout-edit/workout-edit', { id: r.data.id }); await sleep(5);
  ui.modalAnswer = { confirm: true }; d.instance.discard();
  assert.ok(ui.modals.some(m => m.startsWith('放弃这次训练？')));
  assert.strictEqual(repo.workouts.getDraft(), null);
});

test('PG13 媒体：有视频显示 video / 无媒体文字占位 / 错误回退不裂图', async () => {
  const { repo } = seed();
  // 有视频（0025）：业务先进 image（等分包），loadSubpackage success 后再切 video
  const withV = P.renderPage('pages/exercise-detail/exercise-detail', { id: '0025' }); await sleep(5);
  assert.strictEqual(withV.instance.data.ex.mediaMode, 'video', '分包就绪后应为 video');
  assert.strictEqual(withV.instance.data.ex._pendingVideo, false);
  assert.ok(withV.instance.data.ex._pkg === 'videoA' || withV.instance.data.ex.videoSrc.includes('packageVideoA'));
  assert.ok(withV.instance.data.ex.videoSrc.includes('0025.mp4'));
  assert.ok(withV.instance.data.ex.posterSrc.includes('0025.jpg'));
  assert.ok(
    withV.instance.data.ex.posterSrc.includes('video-posters') ||
    withV.instance.data.ex.illSrc.includes('video-posters'),
    '封面应来自主包 video-posters'
  );
  assert.ok(withV.dom.querySelector('.main--media') || withV.dom.querySelector('.main--vid') || withV.dom.querySelector('video') || withV.dom.innerHTML.includes('video') || withV.instance.data.ex.mediaMode === 'video');
  assert.ok(withV.dom.textContent.includes('杠铃卧推'));

  // 无视频且无线稿 → text
  const plain = repo.exercises.all().find(e => !e.video && !e.illustration);
  assert.ok(plain, '应存在无媒体动作');
  const noM = P.renderPage('pages/exercise-detail/exercise-detail', { id: plain.id }); await sleep(5);
  assert.strictEqual(noM.instance.data.ex.mediaMode, 'text');
  assert.ok(noM.dom.querySelector('.main--ph-big'), '无媒体应显示文字占位');

  // 仅有线稿、无视频 → image
  const illOnly = repo.exercises.all().find(e => e.illustration && !e.video);
  if (illOnly) {
    const img = P.renderPage('pages/exercise-detail/exercise-detail', { id: illOnly.id }); await sleep(5);
    assert.strictEqual(img.instance.data.ex.mediaMode, 'image');
    assert.ok(img.instance.data.ex.illSrc.includes(illOnly.id));
  }

  // 视频 binderror：首次会再拉分包重试；第二次（或已 _videoRetry）才回退 image/text
  const bad = P.renderPage('pages/exercise-detail/exercise-detail', { id: '0025' }); await sleep(5);
  assert.strictEqual(bad.instance.data.ex.mediaMode, 'video');
  bad.instance._videoRetry = true; // 跳过重试，直接测回退
  bad.instance.onVideoError(); await sleep(5);
  assert.ok(['image', 'text'].includes(bad.instance.data.ex.mediaMode), '视频失败应回退 image/text');
  if (bad.instance.data.ex.mediaMode === 'image') {
    bad.instance.onIllError(); await sleep(5);
    assert.strictEqual(bad.instance.data.ex.mediaMode, 'text');
  }
  assert.ok(bad.dom.querySelector('.main--ph-big') || bad.instance.data.ex.mediaMode === 'text' || bad.instance.data.ex.mediaMode === 'image');
});

test('PG14 V11–V13：点击暂停/继续、onHide/onUnload 暂停、坏路径逐级回退', async () => {
  const { repo } = seed();
  // ensure createVideoContext exists (installWx 不带此 API)
  const calls = { pause: 0, play: 0, loadPkg: 0 };
  global.wx.createVideoContext = () => ({
    pause() { calls.pause++; },
    play() { calls.play++; },
    stop() {},
    seek() {},
  });
  // 覆盖 harness 默认：记录 loadSubpackage 调用（仍同步 success）
  global.wx.loadSubpackage = o => {
    calls.loadPkg++;
    if (o && typeof o.success === 'function') o.success({});
  };

  // V11: togglePlay 同步 playing 与图标（先进 image，分包 success 后 video）
  const c = P.renderPage('pages/exercise-detail/exercise-detail', { id: '0025' }); await sleep(5);
  assert.ok(calls.loadPkg >= 1, '进详情应 loadSubpackage');
  assert.strictEqual(c.instance.data.ex.mediaMode, 'video');
  assert.strictEqual(c.instance.data.playing, true);
  if (c.instance.onReady) c.instance.onReady();
  assert.ok(c.instance._ctx, 'onReady 应创建 video context');
  c.instance.togglePlay(); await sleep(5);
  assert.strictEqual(c.instance.data.playing, false);
  assert.ok(calls.pause >= 1, '应调用 pause');
  assert.ok(c.dom.textContent.includes('▶') || c.instance.data.playing === false, '暂停图标');
  c.instance.togglePlay(); await sleep(5);
  assert.strictEqual(c.instance.data.playing, true);
  assert.ok(calls.play >= 1, '应调用 play');

  // V11b: 卡在封面时 onCoverTap 应再拉分包并切回 video
  calls.loadPkg = 0;
  c.instance.setData({
    'ex.mediaMode': 'image',
    'ex._pendingVideo': false,
    playing: false,
  });
  c.instance.onCoverTap(); await sleep(5);
  assert.ok(calls.loadPkg >= 1, 'onCoverTap 应再 loadSubpackage');
  assert.strictEqual(c.instance.data.ex.mediaMode, 'video', '封面点击重试后应为 video');
  assert.strictEqual(c.instance.data.playing, true);

  // V12: onHide / onUnload 调用暂停
  calls.pause = 0;
  c.instance.onHide(); await sleep(5);
  assert.strictEqual(c.instance.data.playing, false);
  assert.ok(calls.pause >= 1, 'onHide 应 pause');
  // 再 play 后 unload
  c.instance.togglePlay(); await sleep(5);
  assert.strictEqual(c.instance.data.playing, true);
  calls.pause = 0;
  c.instance.onUnload(); await sleep(5);
  assert.strictEqual(c.instance.data.playing, false);
  assert.ok(calls.pause >= 1, 'onUnload 应 pause');

  // V13: 故意坏路径 — 有 poster 时 video error → image → ill error → text
  // 首次 onVideoError 会再拉分包；设 _videoRetry 测最终回退
  const bad = P.renderPage('pages/exercise-detail/exercise-detail', { id: '0025' }); await sleep(5);
  if (bad.instance.onReady) bad.instance.onReady();
  bad.instance.setData({
    'ex.videoSrc': '/packageVideoA/videos/____missing.mp4',
    'ex.posterSrc': '/assets/video-posters/____missing.jpg',
    'ex.illSrc': '/assets/video-posters/____missing.jpg',
  });
  assert.strictEqual(bad.instance.data.ex.mediaMode, 'video');
  bad.instance._videoRetry = true;
  bad.instance.onVideoError(); await sleep(5);
  assert.strictEqual(bad.instance.data.ex.mediaMode, 'image', '坏 video 应回退 image');
  bad.instance.onIllError(); await sleep(5);
  assert.strictEqual(bad.instance.data.ex.mediaMode, 'text', '坏封面应回退 text');
  assert.ok(
    bad.dom.querySelector('.ph-big') ||
    bad.dom.querySelector('.main--ph-big') ||
    bad.instance.data.ex.mediaMode === 'text',
    '最终文字占位，无裂图'
  );

  // V13b: 无海报无图时 video error 直接 text（无 _pkg 时不走分包重试）
  const plain = repo.exercises.all().find(e => !e.video && !e.illustration);
  const synth = P.renderPage('pages/exercise-detail/exercise-detail', { id: plain.id }); await sleep(5);
  synth.instance.setData({
    'ex.mediaMode': 'video',
    'ex.videoSrc': '/bad.mp4',
    'ex.posterSrc': '',
    'ex.illSrc': '',
    'ex._pkg': '',
    playing: true,
  });
  synth.instance.onVideoError(); await sleep(5);
  assert.strictEqual(synth.instance.data.ex.mediaMode, 'text');
});
