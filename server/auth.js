import crypto from 'node:crypto';
import { db } from './db.js';

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  try {
    const check = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
  } catch {
    return false;
  }
}

export function createSession(userId, durationDays = 30) {
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + durationDays * 24 * 60 * 60 * 1000;

  const stmt = db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)');
  stmt.run(token, userId, createdAt, expiresAt);
  return { token, expiresAt };
}

export function getUserByToken(token) {
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT users.id, users.username, sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ? AND sessions.expires_at > ?
  `);
  const row = stmt.get(token, Date.now());
  return row || null;
}

export function deleteSession(token) {
  if (!token) return;
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const user = getUserByToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Сессия недействительна или истекла' });
  }

  req.user = user;
  req.token = token;
  next();
}
