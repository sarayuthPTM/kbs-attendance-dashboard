/**
 * Vercel Serverless Proxy สำหรับเชื่อมต่อ Google Apps Script Web App (Google Sheets)
 * - ใช้ GAS_API_URL จาก Vercel Environment Variables (แนะนำ) หรือ Header x-gas-url
 * - ป้องกันปัญหา CORS และซ่อน URL ปลายทางเมื่อตั้งค่าใน Vercel Env Vars
 */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const envUrl = (process.env.GAS_API_URL || '').trim();
  const headerUrl = typeof req.headers['x-gas-url'] === 'string' ? req.headers['x-gas-url'].trim() : '';
  const targetUrl = envUrl || headerUrl;

  if (!targetUrl) {
    return res.status(400).json({
      success: false,
      notConfigured: true,
      error: 'ยังไม่ได้ตั้งค่า GAS_API_URL ใน Vercel Environment Variables หรือหน้าตั้งค่าแอดมิน'
    });
  }

  // SSRF guard: อนุญาตเฉพาะ Google Apps Script Web App URL
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(targetUrl)) {
    return res.status(400).json({
      success: false,
      error: 'รูปแบบ GAS Web App URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://script.google.com/macros/s/.../exec)'
    });
  }

  try {
    let gasRes;
    if (req.method === 'GET') {
      const qs = new URLSearchParams(req.query || {}).toString();
      const fullUrl = qs ? `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}${qs}` : targetUrl;
      gasRes = await fetch(fullUrl, { method: 'GET', redirect: 'follow' });
    } else if (req.method === 'POST') {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      gasRes = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: rawBody,
        redirect: 'follow'
      });
    } else {
      return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    const text = await gasRes.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        success: false,
        error: 'Google Apps Script ตอบกลับไม่ใช่ JSON (โปรดตรวจสอบว่า Deploy Access เป็น Anyone)'
      });
    }
    return res.status(gasRes.ok ? 200 : 502).json(parsed);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'ไม่สามารถติดต่อ Google Apps Script: ' + (err && err.message ? err.message : String(err))
    });
  }
};
