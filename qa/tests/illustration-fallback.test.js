// 示意图/视频字段与文件一致性 + 缺图兜底契约（对照 design/ILLUSTRATION.md §7）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./_harness');

const ROOT = path.resolve(__dirname, '../..');
const MP = H.MP;
const PILOT = path.join(ROOT, 'data/illustration-pilot-20.md');
const VIDEO_PILOT = path.join(ROOT, 'data/VIDEO_PILOT_24.md');
const ASSETS = path.join(MP, 'assets/exercises');

function pilotIds() {
  const md = fs.readFileSync(PILOT, 'utf8');
  return [...md.matchAll(/`(\d{4})`/g)].map(m => m[1]);
}

function videoIds() {
  const md = fs.readFileSync(VIDEO_PILOT, 'utf8');
  return [...md.matchAll(/`(\d{4})`/g)].map(m => m[1]);
}

test('ILL1 线稿试点 20 个 id 均有 illustration，且指向已存在的本地文件；路径不含 openGym media', () => {
  const { repo } = H.boot();
  const ids = pilotIds();
  assert.strictEqual(ids.length, 20, '名单应有 20 个 id');
  for (const id of ids) {
    const ex = repo.exercises.get(id);
    assert.ok(ex && !ex.unknown, id + ' 应存在');
    assert.ok(ex.illustration && typeof ex.illustration === 'string', id + ' 应有 illustration 字符串');
    assert.ok(!/openGym|catalogue\/media/i.test(ex.illustration), id + ' 禁止 openGym media 路径');
    assert.strictEqual(ex.illustration, `assets/exercises/${id}.png`);
    const abs = path.join(MP, ex.illustration);
    assert.ok(fs.existsSync(abs), abs + ' 文件应存在');
  }
});

test('ILL2 非线稿试点动作 illustration 为空/缺省；assets 目录无多余 png', () => {
  const { repo } = H.boot();
  const ids = new Set(pilotIds());
  const extras = [];
  for (const ex of repo.exercises.all()) {
    if (ids.has(ex.id)) continue;
    if (ex.illustration) extras.push(ex.id + '=' + ex.illustration);
  }
  assert.deepStrictEqual(extras, [], '非试点不应挂图');
  const files = fs.readdirSync(ASSETS).filter(f => f.endsWith('.png'));
  assert.deepStrictEqual(files.sort(), [...ids].map(i => i + '.png').sort());
});

test('ILL3 详情页 mediaMode 契约：有 video→video；仅 illustration→image；皆无→text；错误回退', () => {
  const wxml = fs.readFileSync(path.join(MP, 'pages/exercise-detail/exercise-detail.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(MP, 'pages/exercise-detail/exercise-detail.js'), 'utf8');
  assert.ok(/mediaMode==='video'/.test(wxml));
  assert.ok(/mediaMode==='image'/.test(wxml));
  assert.ok(/ph-big/.test(wxml));
  assert.ok(/binderror="onVideoError"/.test(wxml));
  assert.ok(/binderror="onIllError"/.test(wxml));
  assert.ok(/function mediaOf\s*\(/.test(js));
  assert.ok(/wx\.loadSubpackage\s*\(/.test(js), '详情应 loadSubpackage');
  assert.ok(/onCoverTap\s*\(/.test(js), '封面应可点重试');
  assert.ok(/onVideoError\s*\(/.test(js));
  assert.ok(/onIllError\s*\(/.test(js));
  assert.ok(/mediaMode': 'image'/.test(js) || /mediaMode": "image"/.test(js) || /'ex\.mediaMode': 'image'/.test(js));
  assert.ok(/mediaMode': 'text'/.test(js) || /'ex\.mediaMode': 'text'/.test(js));
});

test('VID1 视频试点 24 个 id 均有 video+poster 且文件存在；非试点无这两字段', () => {
  const { repo } = H.boot();
  const ids = videoIds();
  assert.strictEqual(ids.length, 24, '视频名单应有 24 个 id');
  const idSet = new Set(ids);
  for (const id of ids) {
    const ex = repo.exercises.get(id);
    assert.ok(ex && !ex.unknown, id);
    assert.ok(ex.video && ex.poster, id + ' 应有 video/poster');
    assert.ok(!/openGym|catalogue\/media/i.test(ex.video + ex.poster));
    assert.ok(fs.existsSync(path.join(MP, ex.video)), ex.video);
    assert.ok(fs.existsSync(path.join(MP, ex.poster)), ex.poster);
    assert.ok(/^packageVideo[ABC]\/videos\/\d{4}\.mp4$/.test(ex.video), id + ' video 应在分包');
    assert.ok(/^assets\/video-posters\/\d{4}\.jpg$/.test(ex.poster), id + ' poster 应在主包');
  }
  const extras = repo.exercises.all().filter(e => !idSet.has(e.id) && (e.video || e.poster)).map(e => e.id);
  assert.deepStrictEqual(extras, []);
});
