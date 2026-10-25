# 开源推送前检查（2026-10-19 18:00 UTC+8）

## 结论
未发现 AppSecret、token、密码或私钥，可以推送；但需先补 `.gitignore` 并排除下列内容。

## 发现
| 项 | 情况 | 建议 |
|---|---|---|
| `miniprogram/project.config.json` | 仅含 appid `wxd000e3fb6e804ce0`、编译设置；无 secret | appid 属公开信息，可保留；要更稳可在仓库里换成 `touristappid` |
| `project.private.config.json` | 不存在 | 写进 `.gitignore`，防止以后 DevTools 生成后被推上去 |
| `.gitignore` | 项目里没有 | 按下方模板新增 |
| `qa/devtools/**` | 约 55MB，含 4 个 out.zip（各约 1.4MB）、截图、运行结果 | 不推 |
| `qa/DEVTOOLS_RUN.md` | 含本机路径 `C:\Users\MX20426\...`、`D:\微信web开发者工具` | 不推，或推送前脱敏 |
| `design/release-assets/src/*` | 渲染脚本与 HTML | 可推可不推，不涉及隐私 |

## 建议仓库内容
`miniprogram/`（源码 + `LICENSE-openGym.txt`）、根目录 `LICENSE`（AGPL-3.0 全文）、`README.md`（含 openGym 出处）、`data/DATA_NOTES.md`、`data/LICENSE_AUDIT.md`。qa/ 可选择只推 `qa/tests`、`qa/sim`、`qa/run-all.sh`。

## `.gitignore` 模板
```
node_modules/
miniprogram_npm/
project.private.config.json
*.zip
.DS_Store
qa/devtools/
qa/results/
qa/DEVTOOLS_RUN.md
.env*
```
