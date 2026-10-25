# 动作视频验收计划（待接入完成后执行）

依据：`design/ILLUSTRATION.md` §7；口径（2026-10-19 Jarvis 确认）：**只验收 `VIDEO_NAME_MAP` 的 24 条**挂 `video`/`poster`，不要求与 `illustration-pilot-20` 对齐。原试点 20 线稿 ILL 用例单独测。

名单来源：`assets/videos/VIDEO_NAME_MAP.json`  
24 ids：`0025 0047 0070 0085 0198 0227 0238 0292 0294 0313 0334 0405 0576 0585 0596 0597 0599 0602 0739 0818 0861 1060 2188 3593`

## A. 静态 / 打包（可自动化）
| 编号 | 检查 | 通过标准 |
|---|---|---|
| V1 | 上述 24 个 id 均有 `{id}.mp4` 与 `{id}.jpg`（或约定封面扩展名），无错名 | 与 `VIDEO_NAME_MAP.json` 一一对应 |
| V2 | `exercises` 数据里这 24 条的 `video`/`poster` 路径真实存在；其余动作无该字段（或为空） | 0 条断链 |
| V3 | 体积 | 单段视频 ≤ ~200KB，封面 ≤ 40KB；主包 ≤ 2MB；单分包 ≤ 2MB；总包 ≤ 20MB |
| V4 | `app.json` 的 `subpackages` 正确，视频不在主包 | 主包内无 .mp4 |
| V5 | 详情页 `<video>` 属性 | `autoplay` `loop` `muted`，`poster` 必绑，`show-controls=false`，`object-fit=contain` |
| V6 | 列表页不引用 video / poster | wxml 中无 |

## B. 页面级（miniprogram-simulate）
| 编号 | 场景 | 期望 |
|---|---|---|
| V7 | 有视频动作（如 0025） | 渲染 video，poster 对应该 id |
| V8 | 无视频动作（如原试点中无 video 的条目） | 走线稿 / 文字占位，不渲染 video |
| V9 | 触发 video `binderror` | 切到封面 image |
| V10 | 封面也 `binderror` | 回退文字占位，无裂图 |
| V11 | 点击媒体区 | 暂停 / 继续，状态图标同步 |
| V12 | onHide / onUnload | 调用暂停 |
| V13 | 坏路径（故意改错 video、poster） | 依次回退，最终文字占位 |

## C. 本机 DevTools / 真机（珊珊点验）
- 分包首次进详情的加载；弱网 / 断网时首帧前只显示封面
- 循环衔接无跳帧、无黑块；姿势与步骤大致一致（抽查即可）
- 切后台再回来不自动出声、不卡死

## 与线稿 ILL 的关系
- ILL1–3 / PG13 / `ILLUSTRATION_SPOTCHECK.md`：仍针对试点 20 线稿，本轮不因视频名单变更而取消
- 发布前回归：`bash qa/run-all.sh` + 本计划 A/B；C 节本机点验清单由 Jarvis 另列

## 素材合规
- 来源：libtv 会员 + 自生成形象；未使用 openGym media
