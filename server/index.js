import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import { sendMoveReminder } from './feishu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/send', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

  if (!text) {
    return res.status(400).json({ ok: false, error: '内容不能为空' });
  }
  if (text.length > 500) {
    return res.status(400).json({ ok: false, error: '内容过长（最多 500 字）' });
  }
  if (phone && !/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ ok: false, error: '手机号格式不正确' });
  }

  try {
    const result = await sendMoveReminder(text, phone);
    return res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err?.message || '发送失败';
    const code = msg.includes('未配置') ? 503 : 502;
    return res.status(code).json({ ok: false, error: msg });
  }
});

// 其余 API 路径返回 404 JSON，避免命中前端回退
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`挪车提醒服务已启动: http://${HOST}:${PORT}`);
});
