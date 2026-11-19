// 手账合成图。宽 1080，高度随内容变长，避免多条记录被裁掉。消耗和摄入分列。
const SD = require('../../../utils/share-day');
const W = 1080;
const BG = '#F6F3EE';
const INK = '#2C241E';
const MUTED = '#6B6560';
const FAINT = '#A89F94';
const ORANGE = '#C64B19';
const AERO = '#5C5854';

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawLines(ctx, height) {
  ctx.save();
  ctx.strokeStyle = 'rgba(44,36,30,0.07)';
  ctx.lineWidth = 2;
  for (let y = 280; y < height - 80; y += 56) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();
  }
  ctx.restore();
}

function text(ctx, value, x, y, font, color, align) {
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function sticker(ctx, img, x, y, size, deg) {
  if (!img) return;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(deg * Math.PI / 180);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function sectionHead(ctx, y, title, color, summary, lines) {
  text(ctx, title, 80, y, '700 28px sans-serif', color, 'left');
  if (lines && lines.length) {
    lines.forEach((line, i) => text(ctx, line, 80, y + 40 + i * 32, '500 22px sans-serif', INK, 'left'));
    return y + 36 + lines.length * 32;
  }
  if (summary) text(ctx, summary, W - 80, y, '700 24px serif', INK, 'right');
  return y + 36;
}

function emptySlot(ctx, y, label) {
  ctx.save();
  ctx.strokeStyle = '#D9D1C6';
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  roundRect(ctx, 80, y, W - 160, 120, 16);
  ctx.stroke();
  ctx.restore();
  text(ctx, label, W / 2, y + 72, '400 24px sans-serif', FAINT, 'center');
  return y + 140;
}

function drawRows(ctx, y, rows, images, opts) {
  rows.forEach((row, i) => {
    if (i) {
      ctx.save();
      ctx.strokeStyle = 'rgba(44,36,30,0.08)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(W - 80, y);
      ctx.stroke();
      ctx.restore();
      y += 16;
    }
    if (row.compact) {
      let ly = y + 28;
      (row.lines || []).forEach(line => {
        text(ctx, line.text, 80, ly, line.kind === 'ex' ? '700 24px serif' : '400 22px sans-serif', line.kind === 'warm' ? ORANGE : (line.kind === 'ex' ? INK : MUTED), 'left');
        ly += 34;
      });
      y += SD.rowSpan(row);
      return;
    }
    const size = opts.large && row.large ? 172 : 140;
    sticker(ctx, images[row.sticker], 80, y, size, row.rot || 0);
    const tx = 80 + size + 28;
    if (row.tag) text(ctx, row.tag, tx, y + 28, '700 18px sans-serif', row.tag === '有氧' ? AERO : ORANGE, 'left');
    text(ctx, row.name, tx, y + (row.tag ? 68 : 56), '700 32px serif', INK, 'left');
    if (row.sub) text(ctx, row.sub, tx, y + (row.tag ? 104 : 96), '400 22px sans-serif', MUTED, 'left');
    if (row.kcalText) text(ctx, row.kcalText, W - 80, y + 68, '700 26px serif', INK, 'right');
    let ly = y + 128;
    (row.lines || []).forEach(line => {
      const strong = line.kind === 'ex';
      text(ctx, line.text, tx, ly, strong ? '700 24px serif' : '400 22px sans-serif', line.kind === 'warm' ? ORANGE : (strong ? INK : MUTED), 'left');
      ly += 34;
    });
    y += SD.rowSpan(row);
  });
  return y;
}

function drawShareCard(ctx, model, images) {
  const height = SD.cardHeight(model);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, height);
  drawLines(ctx, height);
  text(ctx, '组迹', 80, 110, '700 22px sans-serif', MUTED, 'left');
  text(ctx, model.dateLabel, 80, 190, '700 64px serif', INK, 'left');
  const dateWidth = ctx.measureText ? ctx.measureText(model.dateLabel).width : 280;
  text(ctx, model.weekLabel, 80 + dateWidth + 20, 190, '500 26px sans-serif', MUTED, 'left');
  ctx.fillStyle = '#F0C4A8';
  roundRect(ctx, 80, 214, 56, 4, 2);
  ctx.fill();
  let y = 280;
  if (model.rest) {
    text(ctx, '今日休息', 80, y + 48, '700 40px serif', INK, 'left');
    text(ctx, '这一天还是空白的', 80, y + 96, '400 24px sans-serif', MUTED, 'left');
    y = emptySlot(ctx, y + 130, '训练还是空的');
    y = emptySlot(ctx, y + 8, '饮食还是空的');
  } else {
    const showTrain = !(model.train && model.train.skip);
    const showDiet = !(model.diet && model.diet.skip);
    if (showTrain) {
      y = sectionHead(ctx, y, '训练', ORANGE, model.train.summaryLines && model.train.summaryLines.length ? '' : model.train.summary, model.train.summaryLines);
      if (model.train.empty) y = emptySlot(ctx, y + 12, '还没有记训练');
      else {
        y = drawRows(ctx, y + 8, model.train.rows, images, { large: false });
        if (model.train.more) text(ctx, '等' + model.train.more + '项', 80, y + 28, '400 22px sans-serif', MUTED, 'left');
      }
    }
    if (showTrain && showDiet) y += 48;
    if (showDiet) {
      y = sectionHead(ctx, y, '饮食', INK, model.diet.summaryLines && model.diet.summaryLines.length ? '' : model.diet.summary, model.diet.summaryLines);
      if (model.diet.empty) y = emptySlot(ctx, y + 12, '还没有记饮食');
      else {
        y = drawRows(ctx, y + 8, model.diet.rows, images, { large: true });
        if (model.diet.more) text(ctx, '等' + model.diet.more + '项', 80, y + 28, '400 22px sans-serif', MUTED, 'left');
      }
    }
  }
  text(ctx, '组迹', 80, height - 48, '700 20px sans-serif', FAINT, 'left');
  if (model.page && model.page.n > 1) text(ctx, model.page.i + '/' + model.page.n, W / 2, height - 48, '500 20px sans-serif', MUTED, 'center');
  text(ctx, '来自组迹日历', W - 80, height - 48, '400 20px sans-serif', FAINT, 'right');
}

module.exports = { drawShareCard, W };
