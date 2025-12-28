// api/send-report.js

export default async function handler(req, res) {
  // السماح بطلبات من أي مكان (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, api-key');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { toEmail, toName, subject, htmlContent } = req.body;

  // مفتاح Brevo الجديد الخاص بك
  // يفضل وضعه في إعدادات Vercel كـ Environment Variable
  // لكن للسهولة الآن ضعه هنا (تذكر حماية الملف)
  const BREVO_API_KEY = "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"; 

  const SENDER_EMAIL = "gharbalmatar@gmail.com"; // الإيميل الذي فعلته في Brevo
  const SENDER_NAME = "نظام الموارد البشرية";

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: toEmail, name: toName }],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send email');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Email Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
