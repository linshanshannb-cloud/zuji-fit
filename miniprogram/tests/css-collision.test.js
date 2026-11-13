// app.wxss 里 position:fixed 的类（.bar / .fab / .mask / .sheet）不能在页面样式里再定义成小图标。
// 日历「记训练」曾用 class="bar" 画哑铃横杠，和全局底栏叠在一起，变成左下角黑块。
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function walk(dir, ext, out = []) {
  fs.readdirSync(dir).forEach(name => {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'tests') return;
      walk(p, ext, out);
    } else if (p.endsWith(ext)) out.push(p);
  });
  return out;
}

function fixedClasses(css) {
  const names = [];
  const re = /\.([a-zA-Z][\w-]*)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    if (/position\s*:\s*fixed/.test(m[2])) names.push(m[1]);
  }
  return names;
}

test('page styles do not redefine global fixed classes, and the dumbbell bar is lift-bar', () => {
  const appCss = fs.readFileSync(path.join(root, 'app.wxss'), 'utf8');
  const fixed = fixedClasses(appCss);
  assert.ok(fixed.includes('bar') && fixed.includes('fab') && fixed.includes('mask') && fixed.includes('sheet'));
  const bad = [];
  walk(root, '.wxss').forEach(file => {
    if (path.resolve(file) === path.resolve(root, 'app.wxss')) return;
    const css = fs.readFileSync(file, 'utf8');
    fixed.forEach(name => {
      const re = new RegExp('(^|[\\s,])\\.' + name + '\\s*\\{');
      if (re.test(css)) bad.push(path.relative(root, file) + ' redefines .' + name);
    });
  });
  assert.deepStrictEqual(bad, []);
  const wxml = fs.readFileSync(path.join(root, 'pages/calendar/calendar.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'pages/calendar/calendar.wxss'), 'utf8');
  assert.ok(wxml.includes('class="lift-bar"'));
  assert.ok(!/(^|[\s"'])bar([\s"']|$)/.test(wxml.split('lift-bar').join('')), 'calendar wxml still has a bare bar class');
  assert.ok(wxss.includes('.lift-bar'));
  assert.ok(!/(^|[\s,])\.bar\s*\{/.test(wxss));
});
