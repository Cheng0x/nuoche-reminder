# CLAUDE.md

本文件为在本仓库中工作的 AI 编码助手（Claude/Codex 等）提供项目上下文与约定。

## 项目概述

「挪车提醒」是一个**移动端 H5**：车辆挡道时，路人打开页面，一眼看到「挡路抱歉」与车辆信息（新能源绿牌），选择/输入话术，一键发送到车主飞书并**电话加急**，同时提供「12123 一键挪车」指引和「买同款」内推入口。

- 车辆：小米 SU7 Pro · 赤霞红 · 鲁CDN0940
- 前端：原生 HTML/CSS/JS，无构建、无 CDN 依赖
- 后端：Node.js + Express，ESM（`"type": "module"`）

## 架构与数据流

```
public/index.html + styles.css + app.js
        │ POST /api/send { text }
        ▼
server/index.js  ──►  server/feishu.js
        │                    ├─ sendViaWebhook()      (自定义机器人，发群)
        │                    ├─ getTenantAccessToken()
        │                    ├─ sendAppMessage()      (im/v1/messages 私聊)
        │                    └─ applyUrgentWithFallback()  (电话优先→降级应用内加急)
        ▼
飞书：Webhook 或 Open API
```

## 关键约定

### 飞书加急（易错点，务必遵守）

- 加急接口一律 **`PATCH`**（不是 POST）。
- 「电话加急」是**独立端点** `PATCH /open-apis/im/v1/messages/:message_id/urgent_phone`，请求体只有 `{ user_id_list: [...] }`，**没有 `urgent_type` 字段**。
- 端点映射（见 `server/feishu.js` 的 `URGENT_ENDPOINTS`）：`app→urgent_app`、`sms→urgent_sms`、`phone→urgent_phone`。
- 查询参数 `user_id_type`：`open_id | union_id | user_id`，与 `receive_id_type` 保持一致。
- 权限 scope：电话加急 `im:message.urgent:phone`，应用内加急 `im:message.urgent`，短信加急 `im:message.urgent:sms`，发消息 `im:message`。
- 只能加急**机器人自己发送**的消息；目标用户需在应用可用范围、且在会话内。

### 降级策略

`sendMoveReminder()` 依次尝试：App 私聊+加急 → Webhook 发群 → 抛「飞书未配置」错误。前端 `/api/send` 未配置时返回 `503`，前端以 toast 提示，不静默失败。

**加急降级（`applyUrgentWithFallback`）**：`FEISHU_URGENT=auto`（默认）时，先尝试 `urgent_phone` 电话加急，失败（如额度超限 `230024`）自动降级 `urgent_app` 应用内加急（免费无限）。加急失败**不阻塞消息送达**，仅在返回体 `urgentError` 中记录。飞书**没有查询剩余额度的 API**，故采用「失败降级」而非「查额度」。

### 话术选择状态机（`public/app.js`）

- `selectedChip` 变量记录当前选中 chip；`customInput` 非空时**覆盖** chip 选择，清空后**恢复** `selectedChip`。
- 修改话术/默认值时，同步改 `public/index.html` 的 `.chips` 与 `public/app.js` 的 `DEFAULT_TEXT`。

## 常用命令

```bash
npm install          # 依赖（若全局 npm 缓存报 EACCES，加 --cache ./.npm-cache）
npm start            # 启动，默认 http://localhost:3000
npm run dev          # 开发模式（node --watch）
node --check <file>  # 语法检查
curl -s localhost:3000/api/health
curl -s -X POST localhost:3000/api/send -H 'Content-Type: application/json' -d '{"text":"麻烦挪一下车"}'
```

## 文件索引

| 路径 | 职责 |
|------|------|
| `public/index.html` | 页面结构、车辆信息、车牌、话术、弹窗 |
| `public/styles.css` | 设计令牌（`:root`）、绿牌渲染、底部弹窗/模态动效 |
| `public/app.js` | 话术选择、发送、Toast、弹窗控制 |
| `public/assets/referral.svg` | 内推图片占位（可替换） |
| `server/index.js` | Express 入口，静态托管 + `/api/send`、`/api/health` |
| `server/feishu.js` | 飞书 Webhook/Open API 封装 |
| `docs/设计方案.md` | 架构、集成方案、目录结构 |
| `docs/UI设计.md` | 配色、组件、动效规范 |
| `.env.example` | 环境变量模板（勿提交真实 `.env`） |

## 注意事项

- `.env`、`node_modules/`、`.npm-cache/` 已在 `.gitignore`，不要提交真实密钥。
- 车辆信息变更只改 `public/index.html`；主题色/绿牌渐变改 `public/styles.css` 的 `:root` 变量。
- 前端无第三方依赖，改动后无需构建；刷新浏览器即可看到效果。
