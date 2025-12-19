import type { VercelRequest, VercelResponse } from "@vercel/node";

const CHAIN_ID_BASE = 8453;
const WETH_BASE = "0x4200000000000000000000000000000000000006";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function q1(req: VercelRequest, key: string): string | undefined {
  const v = req.query[key];
  if (Array.isArray(v)) return v[0];
  return v?.toString();
}

function normalizeTokenFor0x(token: string): string {
  const t = token.trim().toLowerCase();
  // your app uses zero-address for native ETH; 0x expects WETH for routing
  if (t === "0x0000000000000000000000000000000000000000") return WETH_BASE;
  return token;
}

async function fetch0x(path: string, params: URLSearchParams) {
  const apiKey = process.env.ZEROX_API_KEY || process.env.VITE_0X_API_KEY || "";
  const url = `https://api.0x.org${path}?${params.toString()}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "0x-version": "v2",
      accept: "application/json",
      ...(apiKey ? { "0x-api-key": apiKey } : {}),
    },
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json error
  }

  return { resp, text, json, url };
}

function pickFeeBps(usdNotional: number | null): number {
  // default if estimation fails (choose your preference)
  if (usdNotional == null || Number.isNaN(usdNotional)) return 50;

  if (usdNotional < 100) return 100;     // 1.00%
  if (usdNotional <= 1000) return 50;    // 0.50%
  return 30;                              // 0.30%
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (optional for same-origin; safe to keep)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const chainId = Number(q1(req, "chainId") || CHAIN_ID_BASE);
    if (chainId !== CHAIN_ID_BASE) {
      return res.status(400).json({ error: "unsupported_chain", chainId });
    }

    // required by 0x quote flow
    const sellTokenRaw = q1(req, "sellToken");
    const buyTokenRaw = q1(req, "buyToken");
    const sellAmount = q1(req, "sellAmount");
    const taker = q1(req, "taker");

    if (!sellTokenRaw || !buyTokenRaw || !sellAmount || !taker) {
      return res.status(400).json({
        error: "missing_params",
        required: ["sellToken", "buyToken", "sellAmount", "taker"],
      });
    }

    const sellToken = normalizeTokenFor0x(sellTokenRaw);
    const buyToken = normalizeTokenFor0x(buyTokenRaw);

    const slippagePercentage = q1(req, "slippagePercentage"); // optional
    const recipient = q1(req, "recipient");                   // optional
    const txOrigin = q1(req, "txOrigin");                     // optional
    const disableFee = (q1(req, "disableFee") || "").toLowerCase() === "true";

    // fee recipient (EOA or contract is fine)
    const feeRecipient = process.env.SWAP_FEE_RECIPIENT || "";
    if (!disableFee && !feeRecipient) {
      return res.status(500).json({ error: "missing_SWAP_FEE_RECIPIENT" });
    }

    // --- Step 1: estimate USD notional of sellAmount (sellToken -> USDC) ---
    let usdNotional: number | null = null;

    if (sellToken.toLowerCase() === USDC_BASE.toLowerCase()) {
      usdNotional = Number(BigInt(sellAmount)) / 1e6;
    } else {
      const priceParams = new URLSearchParams({
        chainId: String(chainId),
        sellToken,
        buyToken: USDC_BASE,
        sellAmount,
      });

      const { resp: priceResp, json: priceJson } = await fetch0x(
        "/swap/allowance-holder/price",
        priceParams
      );

      if (priceResp.ok && priceJson?.buyAmount) {
        usdNotional = Number(BigInt(priceJson.buyAmount)) / 1e6;
      }
    }

    const feeBps = disableFee ? 0 : pickFeeBps(usdNotional);

    // --- Step 2: build quote request (inject v2 affiliate fee params) ---
    const quoteParams = new URLSearchParams({
      chainId: String(chainId),
      sellToken,
      buyToken,
      sellAmount,
      taker,
    });

    if (slippagePercentage) quoteParams.set("slippagePercentage", slippagePercentage);
    if (recipient) quoteParams.set("recipient", recipient);
    if (txOrigin) quoteParams.set("txOrigin", txOrigin);

    if (!disableFee && feeBps > 0) {
      // v2 affiliate fee params 
      quoteParams.set("swapFeeRecipient", feeRecipient);
      quoteParams.set("swapFeeBps", String(feeBps));
      quoteParams.set("swapFeeToken", buyToken); // collect in output token
    }

    const { resp: quoteResp, json: quoteJson, text: quoteText, url } = await fetch0x(
      "/swap/allowance-holder/quote",
      quoteParams
    );

    if (!quoteResp.ok) {
      return res.status(quoteResp.status).json({
        error: "0x_quote_failed",
        url,
        details: quoteJson ?? quoteText,
      });
    }

    // --- Step 3: compute approximate fee amount for UI display ---
    // (the real truth is the signed tx / quote minBuyAmount, but this is helpful UX)
    let feeAmount: string | null = null;
    try {
      const buyAmount = BigInt(quoteJson.buyAmount);
      feeAmount = feeBps > 0 ? ((buyAmount * BigInt(feeBps)) / 10000n).toString() : "0";
    } catch {
      feeAmount = null;
    }

    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(
      JSON.stringify({
        quote: quoteJson,
        fee: {
          enabled: !disableFee && feeBps > 0,
          bps: feeBps,
          recipient: !disableFee && feeBps > 0 ? feeRecipient : null,
          token: !disableFee && feeBps > 0 ? buyToken : null,
          usdNotional,
          feeAmount,
          tiers: [
            { ltUsd: 100, bps: 100 },
            { lteUsd: 1000, bps: 50 },
            { gtUsd: 1000, bps: 30 },
          ],
        },
      })
    );
  } catch (err: any) {
    console.error("Proxy error:", err);
    return res.status(500).json({
      error: "0x_quote_proxy_failed",
      message: err?.message,
    });
  }
}
