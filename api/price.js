// pages/api/price.js
export default async function handler(req, res) {
// Vercel Edge Function for querying product prices
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
    return new Response(JSON.stringify({ error: '只接受 POST 請求' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: '伺服器未設定 OPENAI_API_KEY' });
    return new Response(
      JSON.stringify({ error: '伺服器未設定 OPENAI_API_KEY' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  let productName;
  try {
    const body = await req.json();
    productName = body?.productName;
  } catch {
    // ignore JSON parse errors
  }

  const { productName } = req.body || {};
  if (typeof productName !== 'string' || !productName.trim()) {
    return res.status(400).json({ error: '缺少產品名稱' });
    return new Response(JSON.stringify({ error: '缺少產品名稱' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // 10 秒超時，避免上游卡住
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 建議改用較新的模型（如 gpt-4o 系列）
        model: 'gpt-4o-mini',
        // 要求輸出 JSON，後端易於解析
        response_format: { type: 'json_object' },
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              '你是價格查詢助手。只輸出 JSON，格式為：{"price": number|null, "currency": "TWD", "message": string}。若不知道，price 用 null，message 說明原因。',
          },
          {
            role: 'user',
            content: `請問「${productName.trim()}」的價格是多少？`,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const payload = await openaiRes.json();
    if (!openaiRes.ok) {
      // 將上游錯誤往外拋給前端比較好除錯
      return res
        .status(openaiRes.status)
        .json({ error: payload?.error?.message || 'OpenAI 服務錯誤' });
      return new Response(
        JSON.stringify({ error: payload?.error?.message || 'OpenAI 服務錯誤' }),
        {
          status: openaiRes.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // 解析模型回傳的 JSON
    const content = payload.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    return res.status(200).json({
      price: parsed.price ?? null,
      currency: parsed.currency ?? 'TWD',
      message: parsed.message ?? '查無資料',
    });
    return new Response(
      JSON.stringify({
        price: parsed.price ?? null,
        currency: parsed.currency ?? 'TWD',
        message: parsed.message ?? '查無資料',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (err) {
    const isAbort = err?.name === 'AbortError';
    return res
      .status(502)
      .json({ error: isAbort ? '上游逾時，請稍後再試' : '伺服器錯誤' });
    return new Response(
      JSON.stringify({
        error: isAbort ? '上游逾時，請稍後再試' : '伺服器錯誤',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } finally {
    // 確保無論成功或失敗都清除計時器，避免資源洩漏
    clearTimeout(timeoutId);
  }
}
