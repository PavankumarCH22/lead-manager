import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { HttpError, requireAuth } from '../middleware.js';
import { validateSignup, validateLogin } from '../validation.js';

export function authRoutes(db, { jwtSecret, jwtExpiresIn }) {
  const router = Router();

  const issueToken = (userId) => jwt.sign({ sub: userId }, jwtSecret, { expiresIn: jwtExpiresIn });
  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

  router.post('/signup', (req, res) => {
    const { errors, value } = validateSignup(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(value.email);
    if (existing) throw new HttpError(409, 'An account with this email already exists', { email: 'Email already registered' });

    const hash = bcrypt.hashSync(value.password, 10);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(value.name, value.email, hash);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);

    res.status(201).json({ token: issueToken(user.id), user: publicUser(user) });
  });

  router.post('/login', (req, res) => {
    const { errors, value } = validateLogin(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(value.email);
    // Same message for unknown email and wrong password to avoid account enumeration.
    if (!user || !bcrypt.compareSync(value.password, user.password_hash)) {
      throw new HttpError(401, 'Invalid email or password');
    }
    res.json({ token: issueToken(user.id), user: publicUser(user) });
  });

  router.get('/me', requireAuth(jwtSecret), (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) throw new HttpError(401, 'User no longer exists');
    res.json({ user: publicUser(user) });
  });

  return router;
}
