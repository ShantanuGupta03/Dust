import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getBestQuote } from '../services/quote';

const quoteBody = z.object({
  chainId: z.number(),
  sellToken: z.string(),
  buyToken: z.string(),
  sellAmount: z.string(),
  takerAddress: z.string(),
});

export const quoteRouter = Router();

quoteRouter.post('/', async (req: Request, res: Response) => {
  try {
    const body = quoteBody.parse(req.body);
    const q = await getBestQuote(body);
    res.json({ quote: q });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Quote failed' });
  }
});
