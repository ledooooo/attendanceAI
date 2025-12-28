// api/send-email.js

export default async function handler(req, res) {
  // السماح بالطلبات من الواجهة الأمامية
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // قراءة المفتاح من إعدادات فيرسل المخفية
  // هذا هو السر: المفتاح غير موجود في الملف!
  const API_KEY = process.env.BREVO_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
  }

  const { toEmail, toName, subject, htmlContent } = req.body;

  // ⚠️ هام: ضع هنا الإيميل الذي سجلت به في Brevo
  const SENDER_EMAIL = "gharbalmatar@gmail.com"; 
  const SENDER_NAME = "نظام الموارد البشرية";

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': API_KEY, // استخدام المتغير البيئي
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: toEmail, name: toName }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Failed to send', details: data });
    }

    return res.status(200).json({ success: true, id: data.messageId });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
