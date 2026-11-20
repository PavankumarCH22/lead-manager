import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './routes/auth.js';
import { leadsRoutes } from './routes/leads.js';
import { requireAuth, notFound, errorHandler } from './middleware.js';

export function createApp(db, config) {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Brute-force protection on credential endpoints (disabled in tests).
  const authLimiter = config.rateLimit
    ? rateLimit({ windowMs: 15 * 60 * 1000, limit: 50, standardHeaders: true, legacyHeaders: false })
    : (_req, _res, next) => next();

  app.use('/api/auth', authLimiter, authRoutes(db, config));
  app.use('/api/leads', requireAuth(config.jwtSecret), leadsRoutes(db));

  if (config.staticDir) {
    app.use(express.static(config.staticDir));
    // SPA fallback for non-API routes
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile('index.html', { root: config.staticDir }));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
