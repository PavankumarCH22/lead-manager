import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDb } from './db.js';
import { createApp } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 16) {
  if (isProd) {
    console.error('JWT_SECRET must be set (16+ chars) in production.');
    process.exit(1);
  }
  console.warn('[warn] JWT_SECRET missing/short - using an insecure dev secret. Copy .env.example to .env.');
}

// If the client has been built, serve it from the same origin (single deployable unit).
const clientDist = path.resolve(__dirname, '../../client/dist');

const config = {
  jwtSecret: jwtSecret || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  rateLimit: isProd,
  staticDir: fs.existsSync(clientDist) ? clientDist : null,
};

const db = createDb();
const app = createApp(db, config);
const port = Number(process.env.PORT) || 4000;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}${config.staticDir ? ' (serving built client)' : ''}`);
});
