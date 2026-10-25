# 详情页视频 · 设计核对（ILLUSTRATION.md §7）

时间：2026-10-19 23:04（北京时间）　核对人：极简设计师  
对照代码：`miniprogram/pages/exercise-detail/*`、`pages/library`、`pages/exercise-picker`

## 结论

**设计侧通过。** 自动播、循环、静音、封面、无控件、点击暂停、离页暂停、视频→封面/线稿→文字回退、列表不加载媒体，均与 §7 一致。真机/DevTools 播放手感仍需珊珊点验。

## 逐项

| §7 要求 | 结果 | 依据 |
|---|---|---|
| 顶部 1:1 媒体区 686×686rpx、圆角、白底 | 通过 | `.media` / `.vid` |
| `autoplay` + `loop` + `muted` | 通过 | wxml |
| 无控件（全屏/进度/音量/中央播放钮） | 通过 | `controls=false` 及各 `show-*-btn=false` |
| `object-fit="contain"` + `poster` | 通过 | wxml；无 poster 时回退 illustration |
| 点击暂停/继续 | 通过 | `togglePlay` |
| 右下角 48rpx 细线圆播放状态 | 通过 | `.play-hint`（▶ / ❚❚） |
| 回退：视频失败 → 封面 → 文字 | 通过 | `onVideoError` → `onIllError` |
| 离页 / 切后台暂停 | 通过 | `onHide` / `onUnload` → `_pause` |
| 列表页不加载视频/封面 | 通过 | library / picker 仅文字 `ph` |

## 文档同步

已更新 `DESIGN.md` §4.10、P6，以及 `ILLUSTRATION.md` 试点数量说明（20→以 24 为准）。

## 非阻塞备注

1. 播放提示用文字符号 ▶/❚❚，不是独立图标资源；尺寸与细线圆符合规范。
2. 「弱网首帧前只显示封面」依赖 `poster` 属性，需 DevTools 弱网点验。
3. 未在本机实际打开 DevTools 播片；自动化与代码静态核对已完成。

---

## 2026-10-25 架构备注

交互核对结论仍有效。投放架构已改为 **0.3.0 云存储**（见 `docs/动作视频-云存储播放手册.md`）：无分包、封面仍主包 jpg、`<video src>` 用 `getTempFileURL` 的 https。`ILLUSTRATION.md` §7 已同步。有氧视频沿用同一套，勿再按 `loadSubpackage` 验收。
