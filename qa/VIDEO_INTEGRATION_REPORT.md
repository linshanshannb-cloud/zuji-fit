# 动作视频接入报告（24）

> 时间：2026-10-19 Asia/Shanghai　执行：executor

## 结论

- **成功**：24 段视频已压缩、抽海报、装入 3 个分包；`exercises.json` / `exercises.js` 已写 `video`/`poster`；详情页支持视频→封面→文字回退；本机工程已同步；自动化（含 `qa/check-videos.js` + 全量 `run-all.sh`）**全部通过**。
- **阻塞级 bug**：无。
- **人工点验**：需珊珊在微信开发者工具中点验下列 5 项（本机 CLI 未找到可用入口，无法远程驱动 GUI）。

## 匹配摘要

| 文件中文名 | id | 动作库 nameZh | 分包 | 备注 |
|-----------|-----|---------------|------|------|
| 45度倒蹬 | `0739` | 45°腿举机腿举 | `packageVideoC` | 别名→45°腿举机腿举 0739 |
| 上斜卧推 | `0047` | 杠铃上斜卧推 | `packageVideoA` | 默认杠铃→0047 |
| 单臂哑铃划船 | `0292` | 哑铃单臂俯身划船 | `packageVideoB` | 精确/近义 |
| 反向蝴蝶机飞鸟 | `0602` | 杠杆坐姿反向飞鸟 | `packageVideoA` | 近似→杠杆坐姿反向飞鸟 0602 |
| 哑铃二头弯举 | `0294` | 哑铃二头弯举 | `packageVideoB` | 精确/近义 |
| 器械推胸 | `0576` | 杠杆推胸 | `packageVideoA` | 近似→杠杆推胸 0576 |
| 坐姿哑铃推肩 | `0405` | 哑铃坐姿肩部推举 | `packageVideoA` | 精确/近义 |
| 坐姿哑铃过顶臂屈伸 | `2188` | 哑铃坐姿三头肌伸展 | `packageVideoB` | 精确/近义 |
| 坐姿器械髋外展 | `0597` | 杠杆坐姿髋外展 | `packageVideoC` | 精确/近义 |
| 坐姿绳索划船 | `0861` | 绳索坐姿划船 | `packageVideoB` | 精确/近义 |
| 坐姿腿屈伸 | `0585` | 杠杆腿屈伸 | `packageVideoC` | 精确/近义 |
| 坐姿腿弯举 | `0599` | 杠杆坐姿腿弯举 | `packageVideoC` | 精确/近义 |
| 对握高位下拉 | `0818` | 双把手平行握高位下拉 | `packageVideoB` | 近似→双把手平行握高位下拉 0818 |
| 平板卧推 | `0025` | 杠铃卧推 | `packageVideoA` | 默认杠铃→0025 |
| 曲杆牧师凳弯举 | `0070` | 杠铃牧师凳弯举 | `packageVideoB` | 精确/近义 |
| 杠铃罗马尼亚硬拉 | `0085` | 杠铃罗马尼亚硬拉 | `packageVideoC` | 精确/近义 |
| 杠铃臀推 | `1060` | 杠铃臀推 | `packageVideoC` | 精确/近义 |
| 深蹲 | `3593` | 杠铃深蹲 | `packageVideoC` | 近似→杠铃深蹲 3593 |
| 站姿哑铃侧平举 | `0334` | 哑铃侧平举 | `packageVideoA` | 精确/近义 |
| 站姿哑铃锤式弯举 | `0313` | 哑铃锤式弯举 | `packageVideoB` | 精确/近义 |
| 站姿绳索直臂下拉 | `0238` | 绳索直臂下拉 | `packageVideoB` | 精确/近义 |
| 站姿龙门架夹胸 | `0227` | 绳索站姿飞鸟 | `packageVideoA` | 近似→绳索站姿飞鸟 0227 |
| 绳索下拉 | `0198` | 绳索下拉 | `packageVideoB` | 精确/近义 |
| 蝴蝶机夹胸 | `0596` | 杠杆坐姿飞鸟 | `packageVideoA` | 近似→杠杆坐姿飞鸟 0596 |

完整说明见 `data/VIDEO_PILOT_24.md`。与原先 illustration-pilot-20 **不完全重合**，以本表为准。

## 体积汇总

| 项 | 数值 |
|----|------|
| 视频合计 | ≈ 2266 KB（24 段） |
| 海报合计 | ≈ 687 KB |
| 单段视频最大 | 136 KB（0085 罗马尼亚硬拉）≤ 200KB |
| 单张海报最大 | 39.7 KB ≤ 40KB |
| packageVideoA（胸+肩 8） | ≈ 0.96 MB |
| packageVideoB（背+臂 9） | ≈ 0.98 MB |
| packageVideoC（腿 7） | ≈ 0.94 MB |
| 主包（不含分包/tests/scripts） | ≈ 0.50 MB < 2MB |

压缩参数：480×480、libx264 CRF32 baseline、去音轨、`+faststart`；海报取约 2.0s 帧、750×750 JPG。

## 分包结构

```
miniprogram/
  packageVideoA/videos/{id}.mp4|.jpg  + pages/placeholder
  packageVideoB/videos/...
  packageVideoC/videos/...
app.json → subpackages + preloadRule（library / exercise-detail）
```

主包内无 `.mp4`。字段路径形如 `packageVideoA/videos/0025.mp4`。

## 代码改动

- `pages/exercise-detail/*`：`<video>` autoplay/loop/muted、controls=false、poster、object-fit=contain；点击暂停/继续；onHide/onUnload 暂停；`onVideoError`→image→`onIllError`→文字
- `data/exercises.json` + `scripts/build-data.js` + `data/exercises.js`：24 条写入 video/poster，保留 illustration
- `qa/check-videos.js`（V1–V6）并挂入 `qa/run-all.sh`；更新 ILL3/PG13/T3/T5

## 自动化验收

| 套件 | 结果 |
|------|------|
| miniprogram/tests | pass 48 |
| smoke-pages | 16/16 |
| qa/tests（含 ILL/VID/T3/T5） | pass 62 |
| miniprogram-simulate | pass 13 |
| TZ matrix | 7 区全部 pass |
| check-videos.js | All passed（148 项） |

## bugs

- （无阻塞）
- 已知限制：微信开发者工具 GUI 无法由本执行器远程操作；本机未定位到可用 `cli.bat`，故真机/模拟器表现依赖人工。
- 近似匹配（深蹲→杠铃深蹲、对握→平行握等）若用户认为不对，可改 `VIDEO_NAME_MAP.json` 后重挂字段。

## 需人工点验（DevTools）

打开本机项目目录：`C:\Users\Administrator\fitness-miniapp\miniprogram`（已同步，勿动 `dongzuo.img`）。

1. **有视频详情**：动作库 → 杠铃卧推(0025) / 杠铃深蹲(3593)：应自动静音循环播放，有海报、无控件条。
2. **无视频详情**：任选无线稿无视频动作：仅文字大占位，无裂图。
3. **循环静音**：听不到声音；循环衔接无明显黑块（抽查 3–5 条）。
4. **点击暂停/继续**：点媒体区可暂停，右下角图标变化；切到后台再回，不应出声卡死。
5. **错误回退（可选）**：临时改坏某条 `video` 路径预览，应先显示封面/线稿，再失败则文字占位。

## 本机同步

- 机器：BF-202609111326（`c786e47f-…`）
- 已覆盖：`miniprogram/packageVideo{A,B,C}`、`app.json`、`pages/exercise-detail`、`data/exercises.json`+`exercises.js`、`VIDEO_PILOT_24.md`、相关 qa 脚本
- **未覆盖**：`dongzuo.img`（按要求保留）

