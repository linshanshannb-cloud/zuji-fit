# QA 验收报告 · 组迹小程序 v1（视频 24 接入后回归）

- 验收人：测试验收员　时间：2026-10-19 23:55（Asia/Shanghai）
- 类型：**视频接入验收 + 全量回归**；追加 DevTools/`preloadRule` 修复；本轮再验 **主包海报 + 封面可点重试**
- 范围：`qa/VIDEO_TEST_PLAN.md` V1–V13、`qa/ACCEPTANCE_v1.md` A–G 可自动化项、`bash qa/run-all.sh`
- **视频口径**：只验 `assets/videos/VIDEO_NAME_MAP.json` 的 **24 ids**；**不要求**与 `illustration-pilot-20` 对齐。线稿 ILL1–3 / PG13 线稿分支照旧单独测。
- 24 ids：`0025 0047 0070 0085 0198 0227 0238 0292 0294 0313 0334 0405 0576 0585 0596 0597 0599 0602 0739 0818 0861 1060 2188 3593`
- 参考：`qa/VIDEO_INTEGRATION_REPORT.md`、`data/VIDEO_PILOT_24.md`、`design/ILLUSTRATION.md` §7
- 本轮**未改** `miniprogram/` 业务代码；仅更新 `qa/`（`sim/page-harness.js` 增加 `loadSubpackage` mock、`sim/pages.sim.test.js` PG13/PG14 适配「先封面再切 video」、本报告）

一键复现：`bash qa/run-all.sh`

---

## 1. run-all 结果

| # | 套件 | 命令 | 结果 |
|---|---|---|---|
| 1 | 开发自测（单元） | `node --test tests/`（`miniprogram/`） | **48 / 48 通过** |
| 2 | 开发自测（页面冒烟） | `node scripts/smoke-pages.js` | **16 / 16 流程通过** |
| 3 | QA 对抗测试 | `node --test tests/`（`qa/`） | **62 / 62 通过**（含 ILL1–3、VID1、T3/T5 等） |
| 4 | QA 页面级（miniprogram-simulate） | `node --test pages.sim.test.js`（`qa/sim/`） | **14 / 14 通过**（含 PG13 媒体 + **PG14 V11–V13**） |
| 5 | 时区矩阵 | `node run-tz-matrix.js` | 7 区均为 **23 / 23 通过** |
| 6 | 视频静态 | `node check-videos.js` | **PASS 148 / FAIL 0** |

- **退出码**：`0`
- **失败清单**：`qa/results/failures.txt` 为 **0 条**

---

## 2. VIDEO_TEST_PLAN V1–V13

### A. 静态 / 打包（自动化 · check-videos.js）

| 编号 | 结果 | 说明 |
|---|---|---|
| V1 | ✅ 通过 | 24 个 id 均有 `{id}.mp4` + `{id}.jpg`，与 `VIDEO_NAME_MAP.json` 一一对应 |
| V2 | ✅ 通过 | 24 条 `video`/`poster` 路径真实存在；非试点无这两字段；0 断链 |
| V3 | ✅ 通过 | 单段视频 ≤200KB；海报 ≤40KB；主包 ≈0.50MB；分包 A/B/C ≈0.96/0.98/0.94MB；总包 ≤20MB |
| V4 | ✅ 通过 | `app.json` 声明 `packageVideoA/B/C`；主包内 **0** 个 `.mp4` |
| V5 | ✅ 通过 | 详情页 `<video>`：`autoplay` `loop` `muted`、`poster` 绑定、`controls={{false}}`、`object-fit=contain`、`binderror=onVideoError` |
| V6 | ✅ 通过 | `library` / `exercise-picker` 无 `<video>`、无 `.mp4` 引用 |

### B. 页面级（miniprogram-simulate · PG13 + PG14）

> 适配 Jarvis 修复后的时序：有视频时先进 `image`（`_pendingVideo`），`wx.loadSubpackage` success 后再切 `video`。harness 默认同步 mock `loadSubpackage`；错误回退用例设 `_videoRetry=true` 跳过「再拉分包」以测最终回退。

| 编号 | 结果 | 依据 |
|---|---|---|
| V7 | ✅ 通过 | 0025：分包就绪后 `mediaMode=video`，`videoSrc`/`posterSrc` 含 0025，`_pkg=videoA` |
| V8 | ✅ 通过 | 无 video 且无 illustration → `mediaMode=text`，文字占位 |
| V9 | ✅ 通过 | `onVideoError`（已 `_videoRetry`）→ `image` 或 `text` |
| V10 | ✅ 通过 | 再 `onIllError` → `text`，无裂图 |
| V11 | ✅ 通过 | PG14：进详情调用 `loadSubpackage`；`togglePlay` 同步 `playing` |
| V12 | ✅ 通过 | PG14：`onHide` / `onUnload` 调用 `_pause()` |
| V13 | ✅ 通过 | PG14：坏路径 video→image→text；无海报时 video error 直接 text |

### C. 本机 DevTools / 真机（无法远程驱动）

| 项 | 结果 |
|---|---|
| 分包首次进详情加载；弱网/断网首帧前只显示封面 | ⏭ **待珊珊清缓存+编译点验**（见 §8） |
| 有视频动作能播或点一下可播（不再永久静图） | ⏭ **待点验**（回归口径） |
| 循环衔接无跳帧、无黑块；姿势与步骤大致一致（抽查） | ⏭ **待点验** |
| 切后台再回来不自动出声、不卡死 | ⏭ **待点验** |
| 备注 | Windows DevTools / 模拟器对 video 可能不稳（含 `MEDIA_ERR_SRC_NOT_SUPPORTED`）→ **以真机体验版 0.2.0 点 ▶ 为准**（见 §11） |

---

## 3. ACCEPTANCE_v1 对照（可自动化结论）

| 节 | 结论 | 备注 |
|---|---|---|
| A1–A4 | ✅ / ⏭ | 四模块在自动化与冒烟中覆盖；账号/云端/AI 等本版不做 |
| A5 视频 | ✅ **本版纳入** | 按 24 条 VIDEO_NAME_MAP 验收，非整库 |
| A6 openGym media | ✅ | 包内仅有许可/署名文本（`LICENSE-openGym.txt` 等），无 media 资源 |
| B1–B4 | ✅（逻辑/模拟） | 日历/训练/身体/动作库对抗 + PG 全绿；B4.1=284 条；B4.3 线稿试点 ILL 照旧 |
| C1–C5 | ✅ | 结构、体积、run-all、存储对抗、空状态覆盖 |
| C6–C7 | ⏭ 本机 | 窄屏/安全区/canvas/手势 → 珊珊 DevTools |
| D1–D6 | ✅（静态） | `LICENSE`、`data/NOTICE-openGym.md`、README 许可节、about 署名；未打包 openGym media |
| E1–E6 | ⏭ 平台/人工 | 备案、类目、隐私指引、提审截图等非本轮自动化范围 |
| F1–F3 | ✅ | 以 **24** ids 为准（ACCEPTANCE 原文写「20」处已按本轮口径覆盖为 24） |
| F4 | ⏭ 本机点验 | 循环衔接、姿势一致 |
| G 签发 | 自动化侧：**无阻塞**；本机与平台材料待珊珊 / Jarvis | |

**阻塞项（ACCEPTANCE）：无。**

---

## 4. 问题清单

**自动化侧无阻塞。** DevTools「只有静图不自动播」见 §8（Jarvis 已修，待本机点验关闭）。

| 严重度 | 说明 |
|---|---|
| 曾阻塞（已修，待点验） | 详情页主包未等分包 → 视频 src 失败回退静图；见 §8 |
| 已知限制 | 微信开发者工具 GUI 无法由本执行器远程操作；C 节 / F4 / C6–C7 / E 依赖人工 |
| 已知限制 | **Windows DevTools 对 `<video>` 可能不稳**；点验以**真机预览优先** |
| 备注 | 部分视频文件名与动作库为近似匹配（见 `VIDEO_PILOT_24.md`）；若产品认为不对，改 `VIDEO_NAME_MAP.json` 后重挂字段再跑本计划 |

---

## 5. 需珊珊 DevTools / 真机点验

本机项目：`C:\Users\Administrator\fitness-miniapp\miniprogram`（以 Jarvis 同步为准）。

**回归口径（修复后）**：有视频动作进详情应能播，或点一下可播；**不再永久卡在静图**。请先 **清缓存 + 编译** 再测。Windows DevTools 对 video 不稳时，以**真机预览**为准。

1. **有视频详情（体验版 0.2.0 真机优先）**：杠铃卧推(0025)、杠铃深蹲(3593) → 封面为真实海报；点 ▶ 应静音循环、无控件条（见 §11）  
2. **无视频详情**：任选无 video 无线稿动作 → 仅文字大占位，无裂图  
3. **循环静音**：无声；循环无明显黑块（抽查 3–5 条）  
4. **点击暂停/继续**：点媒体区可暂停，右下角图标变化；切后台再回不出声、不卡死  
5. **错误回退（可选）**：临时改坏 video 路径 → 封面/线稿 → 文字占位  
6. **ACCEPTANCE C6/C7**：窄屏/安全区/胶囊；日历视觉与折线图 canvas  

---

## 6. 建议

1. **测试侧结论**：自动化与静态项全部通过（含 loadSubpackage 时序适配）；VIDEO_TEST_PLAN A/B **可签**。  
2. **当前状态**：**自动化回归通过**；体验版 **0.2.0** 已上传。封面项已关；**点 ▶ 播视频** 以真机体验版为准（珊珊上班中，回来再点）。点验 OK 后再勾 `ACCEPTANCE_v1.md` G 节。  
3. ACCEPTANCE F1 条文仍写「20 个 id」——建议产品侧后续改为「VIDEO_NAME_MAP 24」以免口径混淆（本报告已按 24 执行）。



---

## 7. 附件

- `qa/results/1-dev-unit.txt` … `6-video-static.txt`
- `qa/results/failures.txt`（0 条）
- `qa/VIDEO_TEST_PLAN.md`、`qa/VIDEO_INTEGRATION_REPORT.md`
- `assets/videos/VIDEO_NAME_MAP.json`、`data/VIDEO_PILOT_24.md`

---

## 8. DevTools 阻塞与修复

| 项 | 内容 |
|---|---|
| **现象** | 珊珊本机 DevTools：详情页「只有图片、不会自动播放」 |
| **根因** | 详情页在**主包**，视频在 `packageVideoA/B/C`；修复前**未** `wx.loadSubpackage`，分包未就绪时 `<video>` src 失败 → `onVideoError` → 永久回退封面/线稿静图 |
| **Jarvis 修复** | `pages/exercise-detail/exercise-detail.js`：有视频时先 `mediaMode=image`（封面）+ `_pendingVideo`；`wx.loadSubpackage(videoA/B/C)` success 后再切 `video` 并 `play`；`onVideoError` 可再拉分包重试一次，仍失败才回退图片。本机工程已 CopyFromBox 同步 |
| **自动化** | `bash qa/run-all.sh` **退出码 0**；PG13/PG14 已适配新时序（harness mock `loadSubpackage`）；V1–V13 / check-videos 全绿 |
| **追加现象** | 真机调试失败：`ECONNREFUSED 127.0.0.1:7897`（本机代理/VPN）+ `preloadRule [pages/library/library] source size 2952KB exceed max limit 2MB`（错误相关 80058） |
| **追加根因** | `app.json` 曾在库页/详情页一次预下载 videoA+B+C（约 2.9MB），超过微信预下载 **2MB** 上限 |
| **Jarvis 追加修复** | 已删除整段 `preloadRule`；详情仍靠按需 `loadSubpackage`；本机 `app.json` 已同步 |
| **QA 已核对** | `app.json` **无** `preloadRule`；`subpackages` videoA/B/C 仍在；详情页仍有 `wx.loadSubpackage`；本轮 `run-all` 退出码 0、失败 0 |
| **当前状态** | 见 **§10**：封面/海报已关；自动播/点播仍待本机点 ▶ |
| **回归口径** | 有视频动作进详情应能播，或点一下可播；**不再永久卡在静图**；真机调试不再因 preload 2.9MB 报 80058 |

---

---

## 9. 主包海报迁移回归（2026-10-19 23:55 Asia/Shanghai）

### 9.1 业务侧核对（只读核对 + 双源）

| 项 | 结果 |
|---|---|
| `app.json` 无 `preloadRule` | ✅ |
| `assets/video-posters/` 24 张 jpg | ✅ |
| **根目录** `data/exercises.json` 24 条 poster → `assets/video-posters/{id}.jpg` | ✅ |
| **运行时** `miniprogram/data/exercises.js`（`{list,filters,…}`）24 条 poster 同上 | ✅ |
| **js/json 双源已对齐** | ✅ 抽查 0025/0047/3593/0739；24 条 video/poster 字段一一相等 |
| 24 条 `video` 仍在 `packageVideoA/B/C/videos/*.mp4` | ✅ |
| 详情页：先进主包封面（**优先 illustration，其次主包海报**）→ `loadSubpackage` → video | ✅ |
| `onCoverTap` / `togglePlay`（非 video 态）均可触发再拉分包 | ✅ |
| 分包内残留旧 jpg | ⚠ 字段已不引用；体积仍 ≤2MB |

> 说明：运行时读的是 **`miniprogram/data/exercises.js`**，不是 json。本轮曾发现 box 上 js 被写成裸数组（无 `list`），已用 `node miniprogram/scripts/build-data.js` 从根目录 json 重生；**重生后 js/json 双源已对齐**。

### 9.2 QA 脚本适配（本轮只改 `qa/`，除上述 build-data 重生 js）

| 文件 | 改动 |
|---|---|
| `qa/check-videos.js` | poster 主包 / video 分包；`video-posters`×24；无 preloadRule；`loadSubpackage`/`onCoverTap`；**V2b 核 exercises.js 与 json 对齐** |
| `qa/tests/static-structure.test.js` | T5：poster → `assets/video-posters/`；允许 `data/exercises.json` 含 mp4 字段 |
| `qa/tests/illustration-fallback.test.js` | VID1 路径格式 + 详情 loadSubpackage/onCoverTap |
| `qa/sim/pages.sim.test.js` | PG13 主包封面；PG14 V11b `onCoverTap` 重试；V13 坏封面改主包路径 |

### 9.3 run-all 结果（重生 js 并适配 T5 后）

| # | 套件 | 结果 |
|---|---|---|
| 1 | 开发自测（单元） | **48 / 48** |
| 2 | 开发自测（冒烟） | **16 / 16** |
| 3 | QA 对抗 | **62 / 62** |
| 4 | QA 页面 sim（含 PG13/PG14） | **14 / 14** |
| 5 | 时区矩阵 | 7 区均为 **23 / 23** |
| 6 | 视频静态 `check-videos` | **PASS 300 / FAIL 0** |

- **退出码**：`0`
- **失败清单**：`qa/results/failures.txt` **0 条**

### 9.4 本轮状态（已被 §10 覆盖）

**自动化烟雾通过（含 js/json 双源对齐核对）。** 本机封面点验见 §10。

---

## 10. 本机点验（Jarvis · 2026-10-20 Asia/Shanghai）

| 项 | 结果 | 说明 |
|---|---|---|
| **封面/海报** | ✅ **关闭** | CLI wechatide：0025 / 3593 的 `illSrc`/`posterSrc` = `/assets/video-posters/{id}.jpg`（真实海报，非线稿）；模拟器截图已确认 |
| **videoSrc 字段** | ✅ | 0025→`/packageVideoA/videos/0025.mp4`；3593→`/packageVideoC/videos/3593.mp4` |
| **进详情自动切 video** | ⏭ **仍开** | 进入后 `mediaMode` 仍为 `image`（海报+▶），CLI 未观察到自动切到 video |
| **点封面/▶ 播放** | ⏭ **仍开** | CLI `callMethod onCoverTap` 报 `No context found for objectId`，点击未成；需模拟器或真机再点一次 ▶ |
| **Console** | ✅ | `get_simulator_console` 无 error 命中 |
| **详情封面优先** | 已记 | Jarvis：有视频时封面优先 poster，失败才退线稿（`exercise-detail.js` 已同步） |

### 结论
- **§「封面空白 / 永久静图误用分包海报」：关闭**（主包海报已出图）。
- **§「封面→自动播 / 点封面播」：待人工**：以 **真机体验版 0.2.0** 打开 0025（或 3593），点右下角 ▶，确认分包加载后静音循环（见 §11）。模拟器/CLI 不作为关闭依据。

---

## 11. 体验版 0.2.0（Jarvis · 2026-10-20 Asia/Shanghai）

| 项 | 内容 |
|---|---|
| **版本** | 体验版 **0.2.0**（本机官方 CLI `upload` 成功） |
| **AppID** | `wxd000e3fb6e804ce0` |
| **体积** | 约 **5.2MB**（含 `packageVideoA/B/C`） |
| **改动摘要** | 封面优先主包海报；24 段视频 **AAC + faststart** 重封装；播放在 `setData` 回调后 `loadSubpackage`，失败 toast |
| **模拟器注意** | DevTools 模拟器仍可能报 `MEDIA_ERR_SRC_NOT_SUPPORTED` → **不以模拟器为准** |

### 待关闭项（仅真机体验版）
1. 微信 → 体验版 → 动作库 → **杠铃卧推 (0025)**（抽查可加 **杠铃深蹲 3593**）
2. 确认封面为真实海报（非线稿、非空白）
3. 点右下角 **▶** → 应加载分包后 **静音循环**；失败应有 toast
4. 可选：切后台再回、循环衔接抽查

**当前阻塞**：无自动化阻塞。**人工**：§「点 ▶ 播视频」仍开，等珊珊真机体验版确认。
