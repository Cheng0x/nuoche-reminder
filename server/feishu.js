import crypto from 'node:crypto';

const FEISHU_OPEN_HOST = 'https://open.feishu.cn';

function env(name) {
  return (process.env[name] || '').trim();
}

/**
 * 飞书自定义机器人 Webhook 发送（发到群）。
 * 若配置了签名密钥，按官方规则计算 sign：
 *   stringToSign = `${timestamp}\n${secret}`
 *   sign = base64(HMAC-SHA256(key=secret, msg=stringToSign))
 */
export async function sendViaWebhook(text) {
  const url = env('FEISHU_WEBHOOK_URL');
  if (!url) throw new Error('FEISHU_WEBHOOK_URL 未配置');

  const secret = env('FEISHU_WEBHOOK_SECRET');
  const payload = { msg_type: 'text', content: { text } };

  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}\n${secret}`)
      .digest('base64');
    payload.timestamp = timestamp;
    payload.sign = sign;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) {
    throw new Error(`飞书机器人返回错误：${body.msg || res.statusText || '未知错误'}`);
  }
  return { via: 'webhook' };
}

/** 用企业自建应用的 app_id / app_secret 换取 tenant_access_token。 */
export async function getTenantAccessToken() {
  const appId = env('FEISHU_APP_ID');
  const appSecret = env('FEISHU_APP_SECRET');
  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID / FEISHU_APP_SECRET 未配置');
  }

  const res = await fetch(
    `${FEISHU_OPEN_HOST}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0 || !body.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败：${body.msg || res.statusText || '未知错误'}`);
  }
  return body.tenant_access_token;
}

/** 通过 im/v1/messages 向车主发私聊消息，返回 message_id。 */
export async function sendAppMessage(token, receiveId, text, receiveIdType = 'open_id') {
  const url =
    `${FEISHU_OPEN_HOST}/open-apis/im/v1/messages` +
    `?receive_id_type=${encodeURIComponent(receiveIdType)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receive_id: receiveId,
      msg_type: 'text',
      content: JSON.stringify({ text }),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0 || !body.data?.message_id) {
    throw new Error(`发送飞书消息失败：${body.msg || res.statusText || '未知错误'}`);
  }
  return body.data.message_id;
}

/**
 * 对已发送的消息设置加急（飞书开放平台，均为 PATCH 方法）。
 * urgentType 对应不同端点：
 *   app   → urgent_app   （应用内加急）
 *   sms   → urgent_sms   （短信加急）
 *   phone → urgent_phone （电话加急）
 */
const URGENT_ENDPOINTS = {
  app: 'urgent_app',
  sms: 'urgent_sms',
  phone: 'urgent_phone',
};

export async function applyUrgent(token, messageId, userId, urgentType = 'phone', userIdType = 'open_id') {
  const endpoint = URGENT_ENDPOINTS[urgentType];
  if (!endpoint) throw new Error(`不支持的加急类型：${urgentType}`);

  const url =
    `${FEISHU_OPEN_HOST}/open-apis/im/v1/messages/${messageId}/${endpoint}` +
    `?user_id_type=${encodeURIComponent(userIdType)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id_list: [userId] }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.code !== 0) {
    throw new Error(`设置加急失败：${body.msg || res.statusText || '未知错误'}`);
  }
  return true;
}

/**
 * 挪车提醒主流程（带降级）：
 * 1. 配了 App 凭据 + 接收人 → 私聊 + 电话加急（推荐）；
 * 2. 仅配 Webhook → 发群消息（无加急）；
 * 3. 都未配 → 抛错提示。
 */
export async function sendMoveReminder(text) {
  const appId = env('FEISHU_APP_ID');
  const receiveId = env('FEISHU_RECEIVE_ID');
  const webhookUrl = env('FEISHU_WEBHOOK_URL');
  const urgent = env('FEISHU_URGENT') || 'phone';

  if (appId && receiveId) {
    const token = await getTenantAccessToken();
    const receiveIdType = env('FEISHU_RECEIVE_ID_TYPE') || 'open_id';
    const messageId = await sendAppMessage(token, receiveId, text, receiveIdType);

    let urgentResult = 'none';
    if (urgent !== 'none') {
      await applyUrgent(token, messageId, receiveId, urgent, receiveIdType);
      urgentResult = urgent;
    }
    return { via: 'app', urgent: urgentResult, messageId };
  }

  if (webhookUrl) {
    await sendViaWebhook(text);
    return { via: 'webhook', urgent: 'none' };
  }

  throw new Error(
    '飞书未配置：请在 .env 中设置 FEISHU_WEBHOOK_URL，或 FEISHU_APP_ID + FEISHU_RECEIVE_ID'
  );
}
