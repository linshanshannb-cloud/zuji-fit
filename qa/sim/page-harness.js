// Page-level harness on miniprogram-simulate (official WXML compiler + j-component + jsdom).
// Page() is shimmed onto Component() so the REAL page .js/.wxml render together. Not a pixel renderer.
const path = require('path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window; global.document = dom.window.document;
['Node', 'HTMLElement', 'CustomEvent', 'Event', 'TouchEvent', 'Touch'].forEach(k => { if (dom.window[k]) global[k] = dom.window[k]; }); // 必须用 jsdom 的 Event 覆盖 Node 20 自带的
const H = require('../tests/_harness');
const sim = require('miniprogram-simulate');
const MP = H.MP;
const app = require(path.join(MP, 'app.json'));
const ui = { toasts: [], modals: [], sheets: [], nav: [], modalAnswer: null, sheetAnswer: null };
function wxUi() {
  Object.assign(global.wx, {
    showToast: o => ui.toasts.push(o.title),
    showModal: o => { ui.modals.push(o.title + (o.content ? '|' + o.content : '')); const a = ui.modalAnswer || { confirm: true }; o.success && o.success(Object.assign({ confirm: false, cancel: false, content: '' }, a)); },
    showActionSheet: o => { ui.sheets.push(o.itemList); if (ui.sheetAnswer != null) o.success && o.success({ tapIndex: ui.sheetAnswer }); },
    navigateTo: o => ui.nav.push(o.url), navigateBack: () => ui.nav.push('back'), redirectTo: o => ui.nav.push('redirect ' + o.url), switchTab: o => ui.nav.push('tab ' + o.url),
    vibrateShort() {}, getWindowInfo: () => ({ statusBarHeight: 20, windowWidth: 375, pixelRatio: 2 }), getSystemInfoSync: () => ({ statusBarHeight: 20, windowWidth: 375, pixelRatio: 2 }),
    getMenuButtonBoundingClientRect: () => ({ top: 24, height: 32, left: 281 }),
    createVideoContext: global.wx.createVideoContext || (() => ({ play() {}, pause() {}, stop() {}, seek() {} })),
    // 详情页有视频时会先封面再 wx.loadSubpackage；默认同步 success，模拟分包已缓存
    loadSubpackage: global.wx.loadSubpackage || (o => {
      if (o && typeof o.success === 'function') o.success({});
    }),
  });
}
// app.json 的全局 usingComponents 在 simulate 里不生效：先逐个注册全局组件，再把 tag→id 映射注入每个 Component/Page 定义。
const IDS = {};
const ORIG = global.Component;
global.Component = opts => ORIG(Object.assign({ usingComponents: Object.assign({}, IDS) }, opts));
function loadComponents() { // 每次"冷启动"后重新加载，保证组件拿到的是同一个 repo 模块实例
  Object.keys(IDS).forEach(k => delete IDS[k]);
  ['btn', 'card', 'nav-bar', 'set-row', 'undo-toast', 'line-chart', 'month-calendar', 'empty-state'].forEach(tag => {
    IDS[tag] = sim.load(path.join(MP, app.usingComponents[tag]), tag, { rootPath: MP });
  });
}
let QUERY = {};
global.getCurrentPages = () => [{}, {}];
global.Page = def => {
  const methods = {}; Object.keys(def).forEach(k => { if (typeof def[k] === 'function') methods[k] = def[k]; });
  global.Component({ data: def.data, methods, lifetimes: { attached() { this.getOpenerEventChannel = () => ({ emit() {} }); if (this.onLoad) this.onLoad(QUERY); if (this.onReady) this.onReady(); if (this.onShow) this.onShow(); } } });
};
// Boot app modules against current H.store (the same require cache is shared by pages, like the real runtime).
function bootApp() { const b = H.boot(); wxUi(); loadComponents(); return b; }
function renderPage(route, query = {}) {
  QUERY = query;
  const id = sim.load(path.join(MP, route), { rootPath: MP });
  const comp = sim.render(id);
  comp.attach(document.createElement('parent-wrapper'));
  return comp;
}
const flush = () => sim.sleep(5);
module.exports = { H, sim, ui, bootApp, renderPage, flush, MP };
