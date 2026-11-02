import express from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { authMiddleware } from '../auth.js';
import {
  validateBody,
  entrySchema,
  importEntriesSchema,
  MAX_IMPORT_ENTRIES,
  isValidDateString,
  ID_REGEX,
} from '../validation.js';
import { deduplicateUserEntries } from '../services/deduplication.service.js';

const router = express.Router();

// Все маршруты записей дневника требуют обязательной авторизации
router.use(authMiddleware);

/**
 * Получить все записи пользователя
 * Read-Only: безопасный метод без мутаций БД (P1)
 * GET /api/entries
 */
router.get('/', (req, res) => {
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

/**
 * Ручной / фоновый запуск дедупликации записей пользователя
 * POST /api/entries/deduplicate
 */
router.post('/deduplicate', (req, res) => {
  try {
    const removedCount = deduplicateUserEntries(req.user.id, db);
    res.json({ ok: true, removedCount });
  } catch (err) {
    console.error('Deduplicate error:', err);
    res.status(500).json({ error: 'Ошибка удаления дубликатов' });
  }
});

/**
 * Пакетный импорт записей (из JSON или XLSX)
 * POST /api/entries/import
 */
router.post('/import', (req, res) => {
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
      const checkDateTimeStmt = db.prepare(`
        SELECT id, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag FROM entries
        WHERE user_id = ? AND date = ? AND time = ?
      `);
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

        // 1. Проверяем совпадение по ID
        const existingById = entryId ? checkStmt.get(req.user.id, entryId) : null;
        // 2. Проверяем совпадение по времени события (date + time) для предотвращения дубликатов
        const existingByDateTime = checkDateTimeStmt.get(req.user.id, e.date, e.time);

        if (existingById) {
          // Обновляем запись по ID
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
        } else if (
          existingByDateTime &&
          (existingByDateTime.glucose == null ||
            e.glucose == null ||
            Math.abs(existingByDateTime.glucose - e.glucose) < 0.05)
        ) {
          // Запись на это же время с совпадающим сахаром уже есть: объединяем в существующую (дедупликация)
          const mergedGlucose = e.glucose ?? existingByDateTime.glucose ?? null;
          const mergedCarbs = e.carbs ?? existingByDateTime.carbs ?? null;
          const mergedXe = e.xe ?? existingByDateTime.xe ?? null;
          const mergedRinFast = e.rinFast ?? existingByDateTime.rin_fast ?? null;
          const mergedTresiba = e.tresiba ?? existingByDateTime.tresiba ?? null;
          const mergedCalories = e.calories ?? existingByDateTime.calories ?? null;
          const mergedNotes = e.notes || existingByDateTime.notes || '';
          const mergedTag = e.tag && e.tag !== 'other' ? e.tag : existingByDateTime.tag || 'other';

          updateStmt.run(
            e.date,
            e.time,
            mergedGlucose,
            mergedCarbs,
            mergedXe,
            mergedRinFast,
            mergedTresiba,
            mergedCalories,
            mergedNotes,
            mergedTag,
            req.user.id,
            existingByDateTime.id
          );
        } else {
          // Новая запись: если ID чужой или отсутствует — генерируем новый UUID
          if (entryId) {
            const existingOther = checkOtherStmt.get(entryId);
            if (existingOther && existingOther.user_id !== req.user.id) {
              entryId = crypto.randomUUID();
            }
          } else {
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
        imported++;
      }

      // Дополнительная дедупликация внутри атомарной транзакции импорта (P0)
      deduplicateUserEntries(req.user.id, db);

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

/**
 * Создать новую запись
 * POST /api/entries
 */
router.post('/', validateBody(entrySchema), (req, res) => {
  try {
    const e = req.validatedBody;
    let id = e.id;

    if (id) {
      // Проверяем, существует ли запись с таким ID у ТЕКУЩЕГО пользователя (SEC-12).
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

/**
 * Удалить все записи за конкретную дату (целый день)
 * DELETE /api/entries/day/:date
 */
router.delete('/day/:date', (req, res) => {
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

/**
 * Очистить все записи текущего пользователя
 * DELETE /api/entries
 */
router.delete('/', (req, res) => {
  try {
    db.prepare('DELETE FROM entries WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Clear entries error:', err);
    res.status(500).json({ error: 'Ошибка очистки дневника' });
  }
});

/**
 * Обновить существующую запись
 * PUT /api/entries/:id
 */
router.put('/:id', validateBody(entrySchema), (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Некорректный формат ID записи' });
    }

    // Проверяем наличие записи строго у текущего пользователя (user_id, id).
    // Чужие записи не раскрываются через статус или сообщения (возвращаем 404 Not Found без оракула 403/404).
    const existing = db.prepare('SELECT id FROM entries WHERE user_id = ? AND id = ?').get(req.user.id, id);
    if (!existing) {
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

/**
 * Удалить запись по ID
 * DELETE /api/entries/:id
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !ID_REGEX.test(id)) {
      return res.status(400).json({ error: 'Некорректный формат ID записи' });
    }

    // Удаление записи строго по (user_id, id).
    // Чужие и несуществующие записи дают одинаковый результат (404 Not Found без оракула 403/404).
    const result = db.prepare('DELETE FROM entries WHERE user_id = ? AND id = ?').run(req.user.id, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Ошибка удаления записи' });
  }
});

export const entriesRouter = router;
