// 过滤无依赖文件不把 app.json tabBar.iconPath 当依赖。日历页要显式引用 8 张图标。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ICONS = ['calendar', 'calendar-active', 'library', 'library-active', 'diet', 'diet-active', 'body', 'body-active'];

test('tabBar icons stay in the compile dependency graph', () => {
  const root = path.join(__dirname, '..');
  const wxml = fs.readFileSync(path.join(root, 'pages/calendar/calendar.wxml'), 'utf8');
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const pc = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  ICONS.forEach(name => {
    const rel = 'images/tabbar/' + name + '.png';
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
    assert.ok(wxml.includes('/' + rel), rel);
  });
  const paths = app.tabBar.list.flatMap(item => [item.iconPath, item.selectedIconPath]).sort();
  assert.deepStrictEqual(paths, ICONS.map(name => 'images/tabbar/' + name + '.png').sort());
  const include = (pc.packOptions.include || []).map(rule => rule.type + ':' + rule.value);
  assert.ok(include.includes('folder:images/tabbar'));
});
