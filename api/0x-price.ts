import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const qs = new URLSearchParams(req.query as any).toString();

    const url = `https://api.0x.org/swap/allowance-holder/price?${qs}`;

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
    res.status(response.status).send(text);
  } catch (err: any) {
    res.status(500).json({
      error: "0x_price_proxy_failed",
      message: err?.message,
    });
  }
}
