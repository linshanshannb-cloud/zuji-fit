# diet-recognize

文字识别的备用入口。小程序会先调用基础库 `wx.cloud.extend.AI`（`createModel("cloudbase")`）。只有基础库没有这个能力、或当前环境没开通所选模型时，才会调用这个云函数。

云函数不读取、不保存任何密钥。用户输入的那句话只放在当次请求里，不写数据库，也不打到日志。

## 部署

1. 用微信开发者工具打开 `miniprogram/`，云开发环境选 `cloud1-d8gn4xfqredd566d1`。
2. 确认本目录已出现在云函数列表（`project.config.json` 的 `cloudfunctionRoot` 是 `cloudfunctions/`）。
3. 右键 `diet-recognize` → **上传并部署：云端安装依赖**。不要把 `node_modules` 提交进仓库。
4. 超时保持 `config.json` 里的 30 秒。控制台若能改超时，不要低于 20 秒。
5. 若只走小程序端的 `wx.cloud.extend.AI`，可以不部署这个函数。端上失败时会提示开通大模型，或改成手动录入。

模型顺序与小程序一致：先 `hy3`（纯文本），再 `deepseek-v4.1-flash`。两个都要在云开发控制台的 `cloudbase` 分组里启用，见 PR 说明。
