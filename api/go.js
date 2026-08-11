// Vercel serverless function — /go/:slug redirect with click analytics.
// Reads the visitor's geo (Vercel headers), device (user-agent) and referrer,
// logs the click to Google Apps Script, then issues a real 302 redirect.

const GAS_EXEC =
  'https://script.google.com/macros/s/AKfycbzZQ4r4_63UPSsuWnSlH7sI3r1Y2gvvfIhZ9hY1RVJhwMeIguWLpSpmtW1l9LPLUbxR/exec';

function deviceFromUA(ua) {
  const u = (ua || '').toLowerCase();
  if (!u) return 'Unknown';
  if (/ipad|tablet/.test(u)) return 'Tablet';
  if (/mobi|iphone|android/.test(u)) return 'Mobile';
  return 'Desktop';
}

// Small stable visitor id from IP + UA (not personally identifying, just for
// counting unique visitors).
function visitorId(ip, ua) {
  const s = `${ip}|${ua}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return 'v' + Math.abs(h).toString(36);
}

export default async function handler(req, res) {
  const slug = (req.query.slug || '').toString().toLowerCase();
  const ua = req.headers['user-agent'] || '';
  const ref = req.headers['referer'] || req.headers['referrer'] || '';
  const city = decodeURIComponent(req.headers['x-vercel-ip-city'] || '') || '';
  const country = req.headers['x-vercel-ip-country'] || '';
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();

  const params = new URLSearchParams({
    go: slug,
    fmt: 'json',
    device: deviceFromUA(ua),
    ref,
    city,
    country,
    vid: visitorId(ip, ua),
  });

  let destination = 'https://sunlite-crm.vercel.app/';
  try {
    const r = await fetch(`${GAS_EXEC}?${params.toString()}`, { redirect: 'follow' });
    const data = await r.json();
    if (data && data.destination) destination = data.destination;
  } catch (err) {
    // If logging fails, still forward the visitor.
  }

  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(302, { Location: destination });
  res.end();
}
