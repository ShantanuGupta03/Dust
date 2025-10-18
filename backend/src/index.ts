import 'dotenv/config';
import express, { Request } from 'express';
import cors, { CorsRequest } from 'cors';
import pino from 'pino';

import { healthRouter } from './routes/health';
import { pricesRouter } from './routes/prices';
import { quoteRouter } from './routes/quote';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(
  cors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
      const allowed = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!origin || allowed.length === 0 || allowed.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use('/health', healthRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/quote', quoteRouter);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  logger.info(`Backend listening on http://localhost:${port}`);
});
