import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { rateLimit } from 'express-rate-limit';
import { db } from './db.js';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordDummy,
  hashPasswordDummy,
  createSession,
  deleteSession,
  authMiddleware,
} from './auth.js';
import {
  validateBody,
  entrySchema,
  importEntriesSchema,
  settingsSchema,
  registerSchema,
  MAX_IMPORT_ENTRIES,
  isValidDateString,
  ID_REGEX,
} from './validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 4999;

// Отключение заголовка X-Powered-By для предотвращения идентификации стека сервера (SEC-08)
app.disable('x-powered-by');

// Настройка доверия к обратному прокси Nginx (SEC-02, SEC-08).
// Доверяем loopback (127.0.0.1, ::1) и локальным подсетям Docker bridge (172.16.0.0/12, 10.0.0.0/8).
// Это исключает подделку клиентского IP через X-Forwarded-For и гарантирует корректную работу Rate Limiting.
const TRUST_PROXY_CONFIG = process.env.TRUST_PROXY || 'loopback, 172.16.0.0/12, 10.0.0.0/8';
app.set('trust proxy', TRUST_PROXY_CONFIG);

// Безопасная конфигурация CORS (SEC-08)
export const defaultAllowedOrigins = [
  'http://localhost:4999',
  'http://localhost:5173',
  'http://127.0.0.1:4999',
  'http://127.0.0.1:5173',
  'https://gluco.example.com',
];

export const configuredOrigins = new Set(defaultAllowedOrigins);
if (process.env.APP_ORIGIN) {
  process.env.APP_ORIGIN.split(',').forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) configuredOrigins.add(trimmed);
  });
}
if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((o) => {
    const trimmed = o.trim();
    if (trimmed) configuredOrigins.add(trimmed);
  });
}

export const corsOptions = {
  origin: (origin, callback) => {
    // Разрешаем запросы без Origin (same-origin, curl, server-to-server, мобильные клиенты PWA)
    if (!origin) {
      return callback(null, true);
    }
    // Разрешаем доверенные источники (производственный домен и локальные порты разработки)
    if (configuredOrigins.has(origin)) {
      return callback(null, true);
    }
    // В dev-режиме или при тестировании разрешаем любые порты на localhost / 127.0.0.1
    if (process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
          return callback(null, true);
        }
      } catch {}
    }
    // Недоверенные внешние источники блокируются без заголовка Access-Control-Allow-Origin
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

// --- RATE LIMITERS (SEC-02 / SEC-06) ---

// Лимитер на регистрацию: не более 10 регистраций за час с одного IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Слишком много запросов на регистрацию с этого адреса. Пожалуйста, повторите позже.' },
});

// Общий лимитер на вход по IP: не более 30 попыток за 15 минут
const authIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Слишком много попыток входа с вашего IP-адреса. Пожалуйста, повторите попытку через 15 минут.' },
});

// Лимитер на аккаунт + IP: не более 10 неудачных попыток за 15 минут для конкретного пользователя с данного IP.
// Включение IP в ключ исключает DoS-атаку (блокировку чужого аккаунта злоумышленником с другого IP).
const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => {
    const cleanUser = (req.body?.username || '').trim().toLowerCase();
    return `${req.ip}_${cleanUser}`;
  },
  validate: { keyGeneratorIpFallback: false },
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Слишком много неудачных попыток входа для этого логина с вашего адреса. Повторите попытку через 15 минут.' },
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ---

// Регистрация
app.post('/api/auth/register', registerLimiter, validateBody(registerSchema), async (req, res) => {
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

// Логин
app.post('/api/auth/login', authIpLimiter, loginAccountLimiter, async (req, res) => {
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

// Проверка текущего пользователя
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Выход
app.post('/api/auth/logout', authMiddleware, (req, res) => {
  deleteSession(req.token);
  res.json({ ok: true });
});

// --- НАСТРОЙКИ ---

app.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const row = db.prepare('SELECT settings_json FROM settings WHERE user_id = ?').get(req.user.id);
    if (row && row.settings_json) {
      res.json(JSON.parse(row.settings_json));
    } else {
      res.json({
        patientName: req.user.username,
        diabetesType: '1',
        xeRatio: 12,
        targetLow: 4.0,
        targetHigh: 9.9,
        hypoThreshold: 3.9,
        severeHyperThreshold: 13.9,
      });
    }
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Ошибка получения настроек' });
  }
});

app.put('/api/settings', authMiddleware, validateBody(settingsSchema), (req, res) => {
  try {
    const settings = req.validatedBody;
    const settingsJson = JSON.stringify(settings);
    const now = Date.now();
    const existing = db.prepare('SELECT user_id FROM settings WHERE user_id = ?').get(req.user.id);

    if (existing) {
      db.prepare('UPDATE settings SET settings_json = ?, updated_at = ? WHERE user_id = ?').run(
        settingsJson,
        now,
        req.user.id
      );
    } else {
      db.prepare('INSERT INTO settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)').run(
        req.user.id,
        settingsJson,
        now
      );
    }

    res.json(settings);
  } catch (err) {
    console.error('Save settings error:', err);
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
});

// --- ЗАПИСИ ДНЕВНИКА (CRUD) ---

// Получить все записи
app.get('/api/entries', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT id, date, time, glucose, carbs, xe, rin_fast AS rinFast, tresiba, calories, notes, tag, created_at AS createdAt
      FROM entries
      WHERE user_id = ?
      ORDER BY date DESC, time ASC
    `).all(req.user.id);

    res.json(rows);
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Ошибка загрузки записей' });
  }
});

// Добавить запись
app.post('/api/entries', authMiddleware, validateBody(entrySchema), (req, res) => {
  try {
    const e = req.validatedBody;
    let id = e.id;

    if (id) {
      // Проверяем, существует ли запись с таким ID у ТЕКУЩЕГО пользователя (SEC-12).
      // Благодаря составному первичному ключу (user_id, id), разные пользователи
      // могут иметь одинаковые ID без конфликтов и коллизий.
      const existing = db.prepare('SELECT id FROM entries WHERE user_id = ? AND id = ?').get(req.user.id, id);
      if (existing) {
        return res.status(409).json({ error: 'Запись с таким ID уже существует в вашем дневнике. Для обновления используйте метод PUT' });
      }
    } else {
      id = crypto.randomUUID();
    }

    const createdAt = e.createdAt || Date.now();

    db.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      e.date,
      e.time,
      e.glucose ?? null,
      e.carbs ?? null,
      e.xe ?? null,
      e.rinFast ?? null,
      e.tresiba ?? null,
      e.calories ?? null,
      e.notes || '',
      e.tag || 'other',
      createdAt
    );

    res.status(201).json({ ...e, id, createdAt });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Ошибка добавления записи' });
  }
});

// Обновить запись
app.put('/api/entries/:id', authMiddleware, validateBody(entrySchema), (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Некорректный формат ID записи' });
    }

    // Проверяем наличие записи у текущего пользователя
    const existing = db.prepare('SELECT id FROM entries WHERE user_id = ? AND id = ?').get(req.user.id, id);
    if (!existing) {
      // Если запись с таким ID есть у другого пользователя, возвращаем 403 Forbidden (защита от IDOR/BOLA)
      const existingOther = db.prepare('SELECT user_id FROM entries WHERE id = ?').get(id);
      if (existingOther && existingOther.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Доступ запрещен: запись принадлежит другому пользователю' });
      }
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    const e = req.validatedBody;
    db.prepare(`
      UPDATE entries
      SET date = ?, time = ?, glucose = ?, carbs = ?, xe = ?, rin_fast = ?, tresiba = ?, calories = ?, notes = ?, tag = ?
      WHERE user_id = ? AND id = ?
    `).run(
      e.date,
      e.time,
      e.glucose ?? null,
      e.carbs ?? null,
      e.xe ?? null,
      e.rinFast ?? null,
      e.tresiba ?? null,
      e.calories ?? null,
      e.notes || '',
      e.tag || 'other',
      req.user.id,
      id
    );

    res.json({ ...e, id });
  } catch (err) {
    console.error('Update entry error:', err);
    res.status(500).json({ error: 'Ошибка обновления записи' });
  }
});

// Удалить запись
app.delete('/api/entries/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Некорректный формат ID записи' });
    }

    const existing = db.prepare('SELECT id FROM entries WHERE user_id = ? AND id = ?').get(req.user.id, id);
    if (!existing) {
      const existingOther = db.prepare('SELECT user_id FROM entries WHERE id = ?').get(id);
      if (existingOther && existingOther.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Доступ запрещен: запись принадлежит другому пользователю' });
      }
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    db.prepare('DELETE FROM entries WHERE user_id = ? AND id = ?').run(req.user.id, id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Ошибка удаления записи' });
  }
});

// Удалить все записи за конкретную дату (целый день)
app.delete('/api/entries/day/:date', authMiddleware, (req, res) => {
  try {
    const { date } = req.params;
    if (!isValidDateString(date)) {
      return res.status(400).json({ error: 'Неверный формат даты (ожидается существующая календарная дата YYYY-MM-DD)' });
    }
    const result = db.prepare('DELETE FROM entries WHERE user_id = ? AND date = ?').run(req.user.id, date);
    res.json({ ok: true, deletedCount: result.changes });
  } catch (err) {
    console.error('Delete day error:', err);
    res.status(500).json({ error: 'Ошибка удаления записей за день' });
  }
});

// Очистить все записи
app.delete('/api/entries', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM entries WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Clear entries error:', err);
    res.status(500).json({ error: 'Ошибка очистки дневника' });
  }
});

// Пакетный импорт записей (из JSON или XLSX)
app.post('/api/entries/import', authMiddleware, (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Некорректное тело запроса' });
    }

    // Если размер массива превышает лимит, возвращаем 413 (Payload Too Large)
    if (Array.isArray(req.body.entries) && req.body.entries.length > MAX_IMPORT_ENTRIES) {
      return res.status(413).json({
        error: `Пакет импорта превышает допустимый лимит (максимум ${MAX_IMPORT_ENTRIES} записей за один запрос)`,
      });
    }

    // Валидация всей структуры через Zod ДО любых изменений в БД (атомарность импорта)
    const parseResult = importEntriesSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return res.status(400).json({
        error: firstIssue?.message || 'Ошибка валидации данных импорта',
        details: parseResult.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const { entries, replaceAll } = parseResult.data;

    db.exec('BEGIN');
    try {
      if (replaceAll) {
        db.prepare('DELETE FROM entries WHERE user_id = ?').run(req.user.id);
      }

      const checkStmt = db.prepare('SELECT id FROM entries WHERE user_id = ? AND id = ?');
      const checkOtherStmt = db.prepare('SELECT user_id FROM entries WHERE id = ?');
      const insertStmt = db.prepare(`
        INSERT INTO entries (id, user_id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStmt = db.prepare(`
        UPDATE entries
        SET date = ?, time = ?, glucose = ?, carbs = ?, xe = ?, rin_fast = ?, tresiba = ?, calories = ?, notes = ?, tag = ?
        WHERE user_id = ? AND id = ?
      `);

      let imported = 0;
      for (const e of entries) {
        let entryId = e.id;
        const createdAt = e.createdAt || Date.now();

        if (entryId) {
          const existing = checkStmt.get(req.user.id, entryId);
          if (existing) {
            // Собственная существующая запись: обновляем (дедупликация при повторном импорте, SEC-12)
            updateStmt.run(
              e.date,
              e.time,
              e.glucose ?? null,
              e.carbs ?? null,
              e.xe ?? null,
              e.rinFast ?? null,
              e.tresiba ?? null,
              e.calories ?? null,
              e.notes || '',
              e.tag || 'other',
              req.user.id,
              entryId
            );
          } else {
            // Защита от коллизии при импорте чужого ID: генерируем безопасный UUID (SEC-05, SEC-11)
            const existingOther = checkOtherStmt.get(entryId);
            if (existingOther && existingOther.user_id !== req.user.id) {
              entryId = crypto.randomUUID();
            }
            insertStmt.run(
              entryId,
              req.user.id,
              e.date,
              e.time,
              e.glucose ?? null,
              e.carbs ?? null,
              e.xe ?? null,
              e.rinFast ?? null,
              e.tresiba ?? null,
              e.calories ?? null,
              e.notes || '',
              e.tag || 'other',
              createdAt
            );
          }
        } else {
          entryId = crypto.randomUUID();
          insertStmt.run(
            entryId,
            req.user.id,
            e.date,
            e.time,
            e.glucose ?? null,
            e.carbs ?? null,
            e.xe ?? null,
            e.rinFast ?? null,
            e.tresiba ?? null,
            e.calories ?? null,
            e.notes || '',
            e.tag || 'other',
            createdAt
          );
        }
        imported++;
      }

      db.exec('COMMIT');
      res.json({ ok: true, importedCount: imported });
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Ошибка при импорте данных' });
  }
});

// Раздача статики фронтенда
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Запуск HTTP-сервера только при непосредственном запуске файла (node server/index.js),
// но не при импорте экземпляра app в тестах.
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GlucoTrack server started on http://0.0.0.0:${PORT}`);
  });
}

export { app };
