import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const qs = new URLSearchParams(req.query as any).toString();
    const url = `https://api.0x.org/swap/allowance-holder/price?${qs}`;

    console.log('Proxying to 0x API:', url);

    const apiKey = process.env.ZEROX_API_KEY || process.env.VITE_0X_API_KEY;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "0x-version": "v2",
        "accept": "application/json",
        ...(apiKey ? { "0x-api-key": apiKey } : {}),
      },
    });

    const text = await response.text();
    console.log('0x API response:', response.status, text.substring(0, 200));

    // Forward the response with proper content type
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).send(text);
  } catch (err: any) {
    console.error('Proxy error:', err);
    res.status(500).json({
      error: "0x_price_proxy_failed",
      message: err?.message,
    });
  }
}