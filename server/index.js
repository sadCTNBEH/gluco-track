import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  authMiddleware,
} from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const app = express();
const PORT = process.env.PORT || 4999;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ ---

// Регистрация
app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, patientName } = req.body;
    const cleanUsername = (username || '').trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      return res.status(400).json({ error: 'Логин должен содержать не менее 3 символов' });
    }
    if (!password || password.length < 5) {
      return res.status(400).json({ error: 'Пароль должен содержать не менее 5 символов' });
    }

    // Проверка уникальности логина
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Пользователь с таким логином уже существует' });
    }

    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const { hash, salt } = hashPassword(password);
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
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Логин
app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim().toLowerCase();

    if (!cleanUsername || !password) {
      return res.status(400).json({ error: 'Укажите логин и пароль' });
    }

    const user = db.prepare('SELECT id, username, password_hash, salt FROM users WHERE username = ?').get(cleanUsername);
    if (!user) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const valid = verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const { token } = createSession(user.id);
    res.json({
      user: { id: user.id, username: user.username },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
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

app.put('/api/settings', authMiddleware, (req, res) => {
  try {
    const settingsJson = JSON.stringify(req.body);
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

    res.json(req.body);
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
app.post('/api/entries', authMiddleware, (req, res) => {
  try {
    const e = req.body;
    const id = e.id || `entry-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
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
app.put('/api/entries/:id', authMiddleware, (req, res) => {
  try {
    const e = req.body;
    const { id } = req.params;

    db.prepare(`
      UPDATE entries
      SET date = ?, time = ?, glucose = ?, carbs = ?, xe = ?, rin_fast = ?, tresiba = ?, calories = ?, notes = ?, tag = ?
      WHERE id = ? AND user_id = ?
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
      id,
      req.user.id
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
    db.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
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
    const { entries, replaceAll } = req.body;
    if (!Array.isArray(entries)) {
      return res.status(400).json({ error: 'Ожидается массив entries' });
    }

    db.exec('BEGIN');
    try {
      if (replaceAll) {
        db.prepare('DELETE FROM entries WHERE user_id = ?').run(req.user.id);
      }

      const insertStmt = db.prepare(`
        INSERT INTO entries (id, user_id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let imported = 0;
      for (const e of entries) {
        if (!e.date || !e.time) continue;
        const id = e.id || `entry-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const createdAt = e.createdAt || Date.now();

        insertStmt.run(
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GlucoTrack server started on http://0.0.0.0:${PORT}`);
});
