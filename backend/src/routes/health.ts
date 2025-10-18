import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_: Request, res: Response) => {
  res.json({ ok: true, service: 'dust-backend' });
});
