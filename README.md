# 挪车提醒 · 小米 SU7 Pro

一个**移动端网页**（H5）：把「挡路抱歉」+ 车辆信息（含新能源绿牌）放在首页一眼可见处，路人一键选择/输入话术，发送到车主**飞书并电话加急**；同时内置「交管 12123 一键挪车」指引和「买同款」内推入口。

> 仓库：https://github.com/Cheng0x/nuoche-reminder

## ✨ 功能特性

| # | 需求 | 实现 |
|---|------|------|
| 1 | 移动端网页 | 移动优先（375px 基准）响应式单页，无刷新交互 |
| 2 | 车辆信息 | 小米 SU7 Pro · 赤霞红 · 鲁CDN0940，车牌按**新能源绿牌**样式渲染 |
| 3 | 一眼看到挡路抱歉 | 首屏大字号「挡路抱歉」Hero 区，红色强调 |
| 4 | 话术选择 | 4 条常驻话术 + 自定义输入（自定义优先） |
| 5 | 发送飞书 + 电话加急 | 后端 `/api/send`：机器人 Webhook 发消息，或自建应用发私聊 + `urgent_phone` **电话加急** |
| 6 | 12123 一键挪车 | 按钮触发**从下到上**底部弹窗，内含 4 步操作指引 |
| 7 | 买同款 | 按钮弹窗展示小米汽车内推图片（占位，可替换） |

## 🧱 技术栈

- **前端**：原生 HTML + CSS + JavaScript（零构建、零 CDN 依赖）
- **后端**：Node.js + Express（托管静态页 + 飞书集成，密钥不下发到浏览器）
- **配置**：dotenv + `.env`

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置飞书（二选一，见下文）
cp .env.example .env
# 编辑 .env，填入飞书凭据

# 3. 启动
npm start
# 打开 http://localhost:3000
```

> 开发模式（文件变更自动重启）：`npm run dev`

## 🔔 飞书配置

### 方式一：自定义机器人（发到群，最简单，无加急）

1. 飞书群 → 设置 → 群机器人 → 添加机器人 → 自定义机器人。
2. 复制 Webhook 地址，填入 `.env` 的 `FEISHU_WEBHOOK_URL`。
3. 若开启了「签名校验」，把签名密钥填入 `FEISHU_WEBHOOK_SECRET`。

```dotenv
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxxx
FEISHU_WEBHOOK_SECRET=
```

> 该方式消息落到群里，**不支持电话加急**。

### 方式二：企业自建应用（私聊 + 电话加急，推荐）

1. 登录[飞书开放平台](https://open.feishu.cn/app) → 创建「企业自建应用」。
2. 「凭证与基础信息」页复制 `App ID` / `App Secret`。
3. 「权限管理」开通以下权限并**发布应用**：
   - 获取与发送单聊、群组消息：`im:message`
   - 发送电话加急消息：`im:message.urgent:phone`
   - （可选）发送应用内加急 `im:message.urgent` / 短信加急 `im:message.urgent:sms`
4. 「应用发布」→ 版本管理与发布 → 把**车主**加入应用可用范围。
5. 获取车主在该应用下的 `open_id`，填入 `.env`。

```dotenv
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_RECEIVE_ID=          # 车主 open_id / user_id / 手机号
FEISHU_RECEIVE_ID_TYPE=open_id   # open_id | user_id | chat_id
FEISHU_URGENT=auto          # auto=电话优先，额度不足自动降级应用内加急(免费) | phone/sms/app/none
```

**发送流程**：应用给车主发私聊文本 → 拿到 `message_id` → 按 `FEISHU_URGENT` 加急：

- `auto`（默认）：先 `PATCH .../urgent_phone` **电话加急**；若额度不足（错误码 `230024`）或失败，**自动降级** `PATCH .../urgent_app` **应用内加急**（免费无限）。
- `phone` / `sms` / `app` / `none`：固定策略，失败仅在返回中标记 `urgentError`，不影响消息送达。

> ⚠️ 电话加急会消耗企业「短信/电话加急」额度（管理后台 → 费用中心 → 权益数据 可查，**无查询 API**，所以用「失败自动降级」而非查额度）。应用内加急免费。加急仅对**机器人自己发送**的消息生效，且目标用户需在应用可用范围内。

## 🎨 自定义

| 改什么 | 位置 |
|--------|------|
| 品牌 / 颜色 / 车牌 | `public/index.html` 的 `.vehicle` 与 `.plate` 区块 |
| 话术 / 默认文案 | `public/index.html` 的 `.chips` 与 `public/app.js` 的 `DEFAULT_TEXT` |
| 内推图片 | 替换 `public/assets/referral.svg`（或改 `index.html` 的 `<img src>`） |
| 主题色 / 绿牌渐变 | `public/styles.css` 顶部 `:root` 变量 |

## 📁 项目结构

```
nuoche-reminder/
├── public/               # 前端
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/referral.svg
├── server/               # 后端
│   ├── index.js          # Express：静态托管 + /api/send
│   └── feishu.js         # 飞书 Webhook / Open API 封装
├── docs/                 # 设计文档
│   ├── 设计方案.md
│   └── UI设计.md
├── .env.example
├── package.json
└── README.md
```

## 📡 API

### `POST /api/send`

发送挪车提醒到飞书并加急。

```jsonc
// 请求
{ "text": "麻烦挪一下车" }

// 成功（自建应用，auto：电话加急）
{ "ok": true, "via": "app", "urgent": "phone", "urgentFallback": false, "urgentError": null, "messageId": "om_xxx" }

// 成功（自建应用，auto：额度不足自动降级应用内加急）
{ "ok": true, "via": "app", "urgent": "app", "urgentFallback": true, "urgentError": null, "messageId": "om_xxx" }

// 成功（仅 Webhook）
{ "ok": true, "via": "webhook", "urgent": "none", "urgentFallback": false, "urgentError": null }

// 失败
{ "ok": false, "error": "飞书未配置：…" }   // HTTP 503/502/400
```

### `GET /api/health`

```json
{ "ok": true }
```

## 📚 文档

- [设计方案](docs/设计方案.md)：架构、飞书电话加急集成、目录结构
- [UI 设计](docs/UI设计.md)：配色、绿牌渲染、组件与动效

## ⚖️ License

MIT
