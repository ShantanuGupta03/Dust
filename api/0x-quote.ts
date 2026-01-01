import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const qs = new URLSearchParams(req.query as any).toString();
    
    // ✅ Use /swap/permit2/quote instead of /swap/allowance-holder/quote
    const url = `https://api.0x.org/swap/permit2/quote?${qs}`;

    const apiKey = process.env.ZEROX_API_KEY || process.env.VITE_0X_API_KEY;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "0x-version": "v2",
        "0x-chain-id": "8453",
        "accept": "application/json",
        ...(apiKey ? { "0x-api-key": apiKey } : {}),
      },
    });

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(response.status).send(text);
  } catch (err: any) {
    res.status(500).json({
      error: "0x_quote_proxy_failed",
      message: err?.message,
    });
  }
}