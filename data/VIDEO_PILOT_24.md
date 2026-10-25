# 动作示意视频试点名单（24）

> 更新：2026-10-19（Asia/Shanghai）　负责人：Jarvis / 执行器

用途：组迹小程序详情页「封面 + 静音循环短视频」。素材由用户 libtv 会员生成、形象自生成；**禁止** openGym media。

映射源文件：`assets/videos/VIDEO_NAME_MAP.json`；压缩后进 `miniprogram/packageVideo{A|B|C}/videos/`。

| # | id | 文件中文名 | 动作库 nameZh | bodyPart | 分包 | 匹配说明 |
|---|-----|-----------|---------------|----------|------|----------|
| 1 | `0739` | 45度倒蹬 | 45°腿举机腿举 | legs | `packageVideoC` | 文件名「45度倒蹬」→ 45°腿举机腿举 0739（同动作别名） |
| 2 | `0047` | 上斜卧推 | 杠铃上斜卧推 | chest | `packageVideoA` | 文件名「上斜卧推」→ 杠铃上斜卧推 0047（默认杠铃） |
| 3 | `0292` | 单臂哑铃划船 | 哑铃单臂俯身划船 | back | `packageVideoB` | 精确/近义匹配 |
| 4 | `0602` | 反向蝴蝶机飞鸟 | 杠杆坐姿反向飞鸟 | shoulders | `packageVideoA` | 文件名「反向蝴蝶机飞鸟」→ 杠杆坐姿反向飞鸟 0602（器械名差异） |
| 5 | `0294` | 哑铃二头弯举 | 哑铃二头弯举 | arms | `packageVideoB` | 精确匹配 |
| 6 | `0576` | 器械推胸 | 杠杆推胸 | chest | `packageVideoA` | 文件名「器械推胸」→ 杠杆推胸 0576 |
| 7 | `0405` | 坐姿哑铃推肩 | 哑铃坐姿肩部推举 | shoulders | `packageVideoA` | 精确/近义匹配 |
| 8 | `2188` | 坐姿哑铃过顶臂屈伸 | 哑铃坐姿三头肌伸展 | arms | `packageVideoB` | 精确/近义匹配 |
| 9 | `0597` | 坐姿器械髋外展 | 杠杆坐姿髋外展 | legs | `packageVideoC` | 精确/近义匹配 |
| 10 | `0861` | 坐姿绳索划船 | 绳索坐姿划船 | back | `packageVideoB` | 精确/近义匹配 |
| 11 | `0585` | 坐姿腿屈伸 | 杠杆腿屈伸 | legs | `packageVideoC` | 精确/近义匹配 |
| 12 | `0599` | 坐姿腿弯举 | 杠杆坐姿腿弯举 | legs | `packageVideoC` | 精确匹配 |
| 13 | `0818` | 对握高位下拉 | 双把手平行握高位下拉 | back | `packageVideoB` | 文件名「对握高位下拉」→ 双把手平行握高位下拉 0818（近似：对握≈平行握） |
| 14 | `0025` | 平板卧推 | 杠铃卧推 | chest | `packageVideoA` | 文件名「平板卧推」→ 杠铃卧推 0025 |
| 15 | `0070` | 曲杆牧师凳弯举 | 杠铃牧师凳弯举 | arms | `packageVideoB` | 精确/近义匹配 |
| 16 | `0085` | 杠铃罗马尼亚硬拉 | 杠铃罗马尼亚硬拉 | legs | `packageVideoC` | 精确匹配 |
| 17 | `1060` | 杠铃臀推 | 杠铃臀推 | legs | `packageVideoC` | 精确匹配 |
| 18 | `3593` | 深蹲 | 杠铃深蹲 | legs | `packageVideoC` | 文件名「深蹲」→ 杠铃深蹲 3593（近似：视频为杠铃深蹲示意） |
| 19 | `0334` | 站姿哑铃侧平举 | 哑铃侧平举 | shoulders | `packageVideoA` | 精确匹配 |
| 20 | `0313` | 站姿哑铃锤式弯举 | 哑铃锤式弯举 | arms | `packageVideoB` | 精确匹配 |
| 21 | `0238` | 站姿绳索直臂下拉 | 绳索直臂下拉 | back | `packageVideoB` | 精确匹配 |
| 22 | `0227` | 站姿龙门架夹胸 | 绳索站姿飞鸟 | chest | `packageVideoA` | 文件名「站姿龙门架夹胸」→ 绳索站姿飞鸟 0227 |
| 23 | `0198` | 绳索下拉 | 绳索下拉 | back | `packageVideoB` | 文件名「绳索下拉」→ 绳索下拉 0198（精确） |
| 24 | `0596` | 蝴蝶机夹胸 | 杠杆坐姿飞鸟 | chest | `packageVideoA` | 文件名「蝴蝶机夹胸」→ 杠杆坐姿飞鸟 0596 |

## 部位与分包

| 分包 | 部位 | 数量 | 说明 |
|------|------|------|------|
| packageVideoA | chest + shoulders | 8 | 胸推/夹胸 + 肩推/侧平举/反向飞鸟 |
| packageVideoB | back + arms | 9 | 划船/下拉 + 弯举/臂屈伸 |
| packageVideoC | legs | 7 | 深蹲/硬拉/腿举/腿屈伸/髋外展/臀推 |

## 规格

- 视频：约 5s、静音、可循环；短边 480、H.264 baseline、无音轨、faststart；单段约 ≤150KB
- 海报：从约 2.0s 抽帧，750×750 JPG，≤40KB
- 字段：仅上述 24 条写 `video` / `poster`；保留原有 `illustration`（若有）
- 详情页回退：视频失败 → 封面/线稿 → 文字占位；列表页不加载视频

## 与 illustration-pilot-20 的关系

本批 24 条与原先线稿试点 20 条**不完全重合**（以本表 / VIDEO_NAME_MAP 为准）。重叠 id 仍保留 `illustration` 字段作视频失败时的备选封面。

## 2026-10-19 修复
- 24 张海报迁入主包 `miniprogram/assets/video-posters/`（约 687KB），详情页封面不再依赖分包，避免真机空白。
- 详情页：先显示主包封面 → `wx.loadSubpackage` → 切 `<video>`；封面可点击重试。
