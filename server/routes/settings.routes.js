import express from 'express';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import { validateBody, settingsSchema } from '../validation.js';

const router = express.Router();

// Все маршруты настроек требуют авторизации
router.use(authMiddleware);

/**
 * Получить настройки текущего пользователя
 * GET /api/settings
 */
router.get('/', (req, res) => {
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

/**
 * Сохранить или обновить настройки текущего пользователя
 * PUT /api/settings
 */
router.put('/', validateBody(settingsSchema), (req, res) => {
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

export const settingsRouter = router;
