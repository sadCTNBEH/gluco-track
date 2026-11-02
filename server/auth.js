import util from 'node:util';
import crypto from 'node:crypto';
import { db } from './db.js';

const scryptAsync = util.promisify(crypto.scrypt);

// Ограничение параллельных вычислений scrypt для предотвращения истощения CPU и пула потоков libuv (SEC-02)
const MAX_CONCURRENT_SCRYPT = 3;
const MAX_SCRYPT_QUEUE = 50;

let runningScryptCount = 0;
const scryptQueue = [];

function acquireScryptSlot() {
  if (runningScryptCount < MAX_CONCURRENT_SCRYPT) {
    runningScryptCount++;
    return Promise.resolve();
  }
  if (scryptQueue.length >= MAX_SCRYPT_QUEUE) {
    const err = new Error('Сервер временно перегружен. Пожалуйста, повторите попытку позже.');
    err.statusCode = 429;
    return Promise.reject(err);
  }
  return new Promise((resolve) => {
    scryptQueue.push(resolve);
  });
}

function releaseScryptSlot() {
  runningScryptCount--;
  if (scryptQueue.length > 0) {
    const next = scryptQueue.shift();
    runningScryptCount++;
    next();
  }
}

async function runScryptLimited(password, salt, keylen = 64) {
  await acquireScryptSlot();
  try {
    const derived = await scryptAsync(password, salt, keylen);
    return derived.toString('hex');
  } finally {
    releaseScryptSlot();
  }
}

/**
 * Асинхронное хеширование пароля (совместимо со старыми scryptSync-хешами: keylen 64, N=16384, r=8, p=1).
 */
export async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = await runScryptLimited(password, salt, 64);
  return { hash, salt };
}

/**
 * Асинхронная проверка пароля с защитой от тайминг-атак.
 */
export async function verifyPassword(password, hash, salt) {
  try {
    if (!password || !hash || !salt) return false;
    const check = await runScryptLimited(password, salt, 64);
    const hashBuf = Buffer.from(hash, 'hex');
    const checkBuf = Buffer.from(check, 'hex');
    if (hashBuf.length !== checkBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuf, checkBuf);
  } catch {
    return false;
  }
}

// Предопределенная соль и хеш для фиктивной проверки при несуществующем пользователе (защита от перечисления, SEC-06)
const DUMMY_SALT = '00000000000000000000000000000000';
const DUMMY_HASH = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

export async function verifyPasswordDummy(password) {
  try {
    await runScryptLimited(password || 'dummyPasswordVerificationString123', DUMMY_SALT, 64);
  } catch {}
  return false;
}

export async function hashPasswordDummy() {
  try {
    await runScryptLimited('dummyPasswordVerificationString123', DUMMY_SALT, 64);
  } catch {}
}

const COMMON_WEAK_PASSWORDS = new Set([
  '123456789012',
  '1234567890123',
  '12345678901234',
  'password1234',
  'password12345',
  'password123456',
  'qwertyuiopas',
  'qwertyuiopasd',
  'asdfghjklzxc',
  'asdfghjklzxcv',
  'zxcvbnmasdfg',
  'administrator',
  'adminadminadmin',
  'iloveyou1234',
  'welcome12345',
  'defaultpassword',
  '111111111111',
  '000000000000',
  '121212121212',
  '123123123123',
]);

/**
 * Валидация сложности пароля для НОВЫХ регистраций (SEC-06).
 * Не навязывает спецсимволы, допуская длинные парольные фразы (passphrases).
 */
export function validateNewPassword(password, username = '') {
  if (!password || typeof password !== 'string') {
    return 'Укажите пароль';
  }
  if (password.length < 12) {
    return 'Пароль должен содержать не менее 12 символов';
  }
  if (password.length > 128) {
    return 'Пароль не должен превышать 128 символов';
  }

  const cleanPass = password.toLowerCase().trim();
  const cleanUser = (username || '').toLowerCase().trim();

  // Запрет логина внутри пароля
  if (cleanUser && cleanUser.length >= 3 && cleanPass.includes(cleanUser)) {
    return 'Пароль не должен содержать ваш логин';
  }

  // Запрет одного повторяющегося символа
  if (/^(.)\1+$/.test(password)) {
    return 'Пароль не должен состоять из одного повторяющегося символа';
  }

  // Запрет тривиальных числовых последовательностей
  if (/^(?:012345678901|123456789012|234567890123|345678901234|987654321098|876543210987)$/.test(password)) {
    return 'Пароль не должен состоять из простой последовательности цифр';
  }

  // Проверка по словарю распространенных слабых паролей
  if (COMMON_WEAK_PASSWORDS.has(cleanPass)) {
    return 'Данный пароль слишком простой и легко угадываемый. Выберите более надежный пароль';
  }

  return null;
}

// Константы времени жизни сессий (SEC-04)
export const SESSION_MAX_DAYS = 7; // Максимальный абсолютный срок жизни сессии (7 дней)
export const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // Таймаут неактивности (24 часа)
export const ACTIVITY_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // Троттлинг записи last_activity_at (5 минут)
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Интервал оппортунистической очистки (1 час)

let lastCleanupTime = 0;

/**
 * Хеширование токена сессии по алгоритму SHA-256 (SEC-04).
 * В базе данных SQLite хранятся исключительно хеши токенов.
 */
export function hashSessionToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Очистка истекших сессий (по абсолютному сроку или таймауту неактивности).
 */
export function cleanExpiredSessions(database = db, now = Date.now()) {
  try {
    const minActivityTime = now - INACTIVITY_TIMEOUT_MS;
    const stmt = database.prepare(`
      DELETE FROM sessions
      WHERE expires_at <= ? OR last_activity_at <= ?
    `);
    const info = stmt.run(now, minActivityTime);
    return info.changes;
  } catch (err) {
    console.error('Ошибка очистки устаревших сессий:', err);
    return 0;
  }
}

/**
 * Оппортунистическая очистка с ограничением частоты (не чаще 1 раза в час).
 */
export function cleanExpiredSessionsThrottled(database = db, now = Date.now()) {
  if (now - lastCleanupTime >= CLEANUP_INTERVAL_MS) {
    lastCleanupTime = now;
    return cleanExpiredSessions(database, now);
  }
  return 0;
}

export function resetCleanupThrottle() {
  lastCleanupTime = 0;
}

/**
 * Создание новой сессии (SEC-04).
 * Клиент получает криптографически стойкий случайный токен, в базе сохраняется только SHA-256 хеш.
 */
export function createSession(userId, durationDays = SESSION_MAX_DAYS, database = db, createdAt = Date.now()) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const effectiveDays = Math.min(Math.max(1, Number(durationDays) || SESSION_MAX_DAYS), SESSION_MAX_DAYS);
  const expiresAt = createdAt + effectiveDays * 24 * 60 * 60 * 1000;
  const lastActivityAt = createdAt;

  const stmt = database.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_activity_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(tokenHash, userId, createdAt, expiresAt, lastActivityAt);

  // Оппортунистическая очистка устаревших сессий при создании новой
  cleanExpiredSessionsThrottled(database, createdAt);

  return { token, expiresAt };
}

/**
 * Поиск пользователя по токену с проверкой абсолютного срока, неактивности и троттлингом обновления.
 */
export function getUserByToken(token, database = db, now = Date.now()) {
  if (!token || typeof token !== 'string') return null;
  const tokenHash = hashSessionToken(token);

  // Оппортунистическая очистка с ограничением частоты
  cleanExpiredSessionsThrottled(database, now);

  const stmt = database.prepare(`
    SELECT users.id, users.username, sessions.expires_at, sessions.last_activity_at, sessions.created_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `);
  const session = stmt.get(tokenHash);
  if (!session) return null;

  // 1. Проверка абсолютного срока жизни сессии (макс 7 дней)
  if (now >= session.expires_at) {
    deleteSessionByHash(tokenHash, database);
    return null;
  }

  // 2. Проверка таймаута неактивности (24 часа)
  const lastActive = session.last_activity_at || session.created_at;
  if (now - lastActive > INACTIVITY_TIMEOUT_MS) {
    deleteSessionByHash(tokenHash, database);
    return null;
  }

  // 3. Троттлинг фиксации активности: пишем в БД не чаще 1 раза в 5 минут на токен
  if (!session.last_activity_at || (now - session.last_activity_at >= ACTIVITY_UPDATE_INTERVAL_MS)) {
    try {
      database.prepare('UPDATE sessions SET last_activity_at = ? WHERE token_hash = ?').run(now, tokenHash);
      session.last_activity_at = now;
    } catch (err) {
      console.error('Ошибка фиксации активности сессии:', err);
    }
  }

  return {
    id: session.id,
    username: session.username,
    expires_at: session.expires_at,
  };
}

/**
 * Немедленный отзыв сессии по хешу токена.
 */
export function deleteSessionByHash(tokenHash, database = db) {
  if (!tokenHash) return;
  try {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  } catch (err) {
    console.error('Ошибка отзыва сессии:', err);
  }
}

/**
 * Немедленный отзыв сессии по открытому токену при логауте.
 */
export function deleteSession(token, database = db) {
  if (!token || typeof token !== 'string') return;
  const tokenHash = hashSessionToken(token);
  deleteSessionByHash(tokenHash, database);
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
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
