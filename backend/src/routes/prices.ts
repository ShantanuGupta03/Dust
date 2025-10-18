import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getTokenPricesUSD } from '../services/prices';

const pricesBody = z.object({
  chainId: z.number(),
  tokens: z.array(z.string()),
});

export const pricesRouter = Router();

pricesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = pricesBody.parse(req.body);
    const prices = await getTokenPricesUSD(body.chainId, body.tokens);
    res.json({ prices });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Invalid request' });
  }
});
