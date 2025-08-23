export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const { productName } = req.body;

  if (!productName) {
    return res.status(400).json({ error: '缺少產品名稱' });
  }

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '你是一個價格查詢助手，請根據產品名稱回覆價格（用假資料也可以）。',
        },
        {
          role: 'user',
          content: `請問「${productName}」的價格是多少？`,
        },
      ],
      temperature: 0.3,
    }),
  });

  const data = await openaiRes.json();
  const reply = data.choices?.[0]?.message?.content || '查無資料';

  res.status(200).json({
    price: '不一定',
    currency: 'TWD',
    message: reply,
  });
}
