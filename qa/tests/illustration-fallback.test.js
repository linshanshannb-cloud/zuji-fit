// 示意图/视频字段与文件一致性 + 缺图兜底契约（对照 design/ILLUSTRATION.md §7）
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const H = require('./_harness');

const ROOT = path.resolve(__dirname, '../..');
const MP = H.MP;
const PILOT = path.join(ROOT, 'data/illustration-pilot-20.md');
const ASSETS = path.join(MP, 'assets/exercises');

function pilotIds() {
  const md = fs.readFileSync(PILOT, 'utf8');
  return [...md.matchAll(/`(\d{4})`/g)].map(m => m[1]);
}

test('ILL1 线稿试点 20 个 id 仍在动作库；磁盘上有 png 的都写了 illustration', () => {
  const { repo } = H.boot();
  const ids = pilotIds();
  assert.strictEqual(ids.length, 20, '名单应有 20 个 id');
  let linked = 0;
  for (const id of ids) {
    const ex = repo.exercises.get(id);
    assert.ok(ex && !ex.unknown, id + ' 应存在');
    const png = path.join(ASSETS, id + '.png');
    if (!fs.existsSync(png)) continue;
    assert.ok(ex.illustration && typeof ex.illustration === 'string', id + ' 应有 illustration 字符串');
    assert.ok(!/openGym|catalogue\/media/i.test(ex.illustration), id + ' 禁止 openGym media 路径');
    assert.strictEqual(ex.illustration.replace(/^\//, ''), `assets/exercises/${id}.png`);
    linked++;
  }
  assert.ok(linked >= 1, '至少一条试点线稿仍挂在动作上');
});

test('ILL2 每条 illustration 都指向已存在的主包 png，目录里没有未被引用的文件', () => {
  const { repo } = H.boot();
  const referenced = [];
  for (const ex of repo.exercises.all()) {
    if (!ex.illustration) continue;
    const rel = ex.illustration.replace(/^\//, '');
    assert.ok(/^assets\/exercises\/\d+\.png$/.test(rel), ex.id + ' ' + rel);
    assert.ok(fs.existsSync(path.join(MP, rel)), rel);
    referenced.push(path.basename(rel));
  }
  const files = fs.readdirSync(ASSETS).filter(f => f.endsWith('.png')).sort();
  assert.deepStrictEqual(files, referenced.slice().sort());
  assert.ok(referenced.length >= 20);
});

test('ILL3 详情页 mediaMode 契约：有 video→video；仅 illustration→image；皆无→text；错误回退', () => {
  const wxml = fs.readFileSync(path.join(MP, 'pages/exercise-detail/exercise-detail.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(MP, 'pages/exercise-detail/exercise-detail.js'), 'utf8');
  assert.ok(/mediaMode==='video'/.test(wxml));
  assert.ok(/mediaMode==='image'/.test(wxml));
  assert.ok(/ph-big/.test(wxml));
  assert.ok(/binderror="onAnimError"/.test(wxml));
  assert.ok(/binderror="onIllError"/.test(wxml));
  assert.ok(/function mediaOf\s*\(/.test(js));
  assert.ok(/onCoverTap\s*\(/.test(js), '封面应可点重试');
  assert.ok(/onAnimError\s*\(/.test(js));
  assert.ok(/onIllError\s*\(/.test(js));
  assert.ok(/remoteGif/.test(wxml), '无云视频时可显示数据集 GIF，并保留 Gym visual 署名');
  assert.ok(/mediaMode': 'image'/.test(js) || /mediaMode": "image"/.test(js) || /'ex\.mediaMode': 'image'/.test(js));
  assert.ok(/mediaMode': 'text'/.test(js) || /'ex\.mediaMode': 'text'/.test(js));
});

test('VID1 已有云视频仍指向 anim/<id>.mp4，海报文件在主包', () => {
  const { repo } = H.boot();
  const withV = repo.exercises.all().filter(e => e.video);
  assert.ok(withV.length >= 200);
  const bench = repo.exercises.get('0025');
  assert.ok(/\/anim\/0025\.mp4$/.test(bench.video));
  assert.ok(bench.poster && fs.existsSync(path.join(MP, bench.poster.replace(/^\//, ''))));
  for (const ex of withV) {
    assert.ok(ex.video.startsWith('cloud://') && ex.video.endsWith('/anim/' + ex.id + '.mp4'), ex.id);
    assert.ok(!/catalogue\/media/i.test(ex.video));
    if (ex.poster) {
      const rel = ex.poster.replace(/^\//, '');
      assert.ok(/^assets\/video-posters\/\d+\.jpg$/.test(rel), ex.id);
      assert.ok(fs.existsSync(path.join(MP, rel)), rel);
    }
  }
});
