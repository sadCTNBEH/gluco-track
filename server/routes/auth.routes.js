import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordDummy,
  hashPasswordDummy,
  createSession,
  deleteSession,
  authMiddleware,
} from '../auth.js';
import { validateBody, registerSchema } from '../validation.js';
import {
  registerLimiter,
  authIpLimiter,
  loginAccountLimiter,
} from '../middleware/rateLimiters.js';

const router = express.Router();

/**
 * Регистрация нового пользователя
 * POST /api/auth/register
 */
router.post('/register', registerLimiter, validateBody(registerSchema), async (req, res) => {
  try {
    const { username, password, patientName } = req.validatedBody;
    const cleanUsername = username.toLowerCase();

    // Проверка уникальности логина
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      // Защита от перечисления пользователей через тайминг: выполняем фиктивное хеширование
      await hashPasswordDummy();
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const userId = `usr_${crypto.randomUUID()}`;
    const { hash, salt } = await hashPassword(password);
    const createdAt = Date.now();

    db.exec('BEGIN');
    try {
      db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
        userId,
        cleanUsername,
        hash,
        salt,
        createdAt
      );

      // Начальные настройки пользователя
      const defaultSettings = {
        patientName: patientName || cleanUsername,
        diabetesType: '1',
        xeRatio: 12,
        targetLow: 4.0,
        targetHigh: 9.9,
        hypoThreshold: 3.9,
        severeHyperThreshold: 13.9,
        doctorName: '',
        doctorNotes: 'Инсулинотерапия: РинФаст (ультракороткий) + Тресиба (базальный). Целевой диапазон: 4.0 – 9.9 ммоль/л.',
      };

      db.prepare('INSERT INTO settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)').run(
        userId,
        JSON.stringify(defaultSettings),
        createdAt
      );

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const { token } = createSession(userId);
    res.status(201).json({
      user: { id: userId, username: cleanUsername },
      token,
    });
  } catch (err) {
    console.error('Registration error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Ошибка сервера при регистрации' });
  }
});

/**
 * Аутентификация (вход) пользователя
 * POST /api/auth/login
 */
router.post('/login', authIpLimiter, loginAccountLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim().toLowerCase();

    if (!cleanUsername || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    const user = db.prepare('SELECT id, username, password_hash, salt FROM users WHERE username = ?').get(cleanUsername);

    let valid = false;
    if (user) {
      // Асинхронная проверка пароля (совместима со старыми паролями любой длины)
      valid = await verifyPassword(password, user.password_hash, user.salt);
    } else {
      // Защита от перечисления пользователей (SEC-06): фиктивная проверка с постоянным временем выполнения
      await verifyPasswordDummy(password);
    }

    if (!user || !valid) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const { token } = createSession(user.id);
    res.json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Ошибка сервера при входе' });
  }
});

/**
 * Проверка текущего пользователя по токену сессии
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

/**
 * Выход из системы (отзыв текущей сессии)
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, (req, res) => {
  deleteSession(req.token);
  res.json({ ok: true });
});

export const authRouter = router;
