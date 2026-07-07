/**
 * Express app wiring. Kept separate from `server.ts` so it can be imported in
 * tests without binding a port.
 */
import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { apiRouter } from './routes';
import { errorHandler } from './middleware/error.middleware';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', apiRouter);

  // Error handler must be registered last.
  app.use(errorHandler);

  return app;
}
