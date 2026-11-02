import { db } from '../db.js';

/**
 * Удаление дубликатов записей пользователя в SQLite с объединением данных.
 * Находит записи с одинаковой датой и временем (и совпадающим сахаром),
 * объединяет клинические данные в первую запись и удаляет лишние копии.
 * 
 * Безопасно для вложенных транзакций: использует SQLite SAVEPOINT, что исключает
 * ошибку вложенного BEGIN/COMMIT при вызове внутри уже открытой транзакции импорта.
 *
 * @param {string} userId - Идентификатор пользователя
 * @param {import('node:sqlite').DatabaseSync} [database=db] - Инстанс базы данных
 * @returns {number} Количество удаленных дубликатов
 */
export function deduplicateUserEntries(userId, database = db) {
  if (!userId) return 0;

  const rows = database.prepare(`
    SELECT id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at
    FROM entries
    WHERE user_id = ?
    ORDER BY date DESC, time ASC, created_at ASC
  `).all(userId);

  if (rows.length === 0) return 0;

  const seen = new Map();
  const idsToDelete = [];
  const updatesToApply = new Map();

  for (const row of rows) {
    const dtKey = `${row.date} ${row.time}`;
    if (!seen.has(dtKey)) {
      seen.set(dtKey, { ...row });
      continue;
    }

    const existing = seen.get(dtKey);
    const isSameGlucose =
      existing.glucose == null ||
      row.glucose == null ||
      Math.abs(existing.glucose - row.glucose) < 0.05;

    if (isSameGlucose) {
      // Это дубликат! Объединяем недостающие данные в сохраненную запись
      let needsUpdate = false;
      if (existing.glucose == null && row.glucose != null) { existing.glucose = row.glucose; needsUpdate = true; }
      if (existing.carbs == null && row.carbs != null) { existing.carbs = row.carbs; needsUpdate = true; }
      if (existing.xe == null && row.xe != null) { existing.xe = row.xe; needsUpdate = true; }
      if (existing.rin_fast == null && row.rin_fast != null) { existing.rin_fast = row.rin_fast; needsUpdate = true; }
      if (existing.tresiba == null && row.tresiba != null) { existing.tresiba = row.tresiba; needsUpdate = true; }
      if (existing.calories == null && row.calories != null) { existing.calories = row.calories; needsUpdate = true; }
      if ((!existing.notes || !existing.notes.trim()) && row.notes) { existing.notes = row.notes; needsUpdate = true; }
      if ((!existing.tag || existing.tag === 'other') && row.tag && row.tag !== 'other') { existing.tag = row.tag; needsUpdate = true; }

      if (needsUpdate) {
        updatesToApply.set(existing.id, { ...existing });
      }

      idsToDelete.push(row.id);
    }
  }

  if (idsToDelete.length > 0 || updatesToApply.size > 0) {
    const savepointName = `sp_dedup_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    database.exec(`SAVEPOINT ${savepointName}`);
    try {
      if (updatesToApply.size > 0) {
        const updateStmt = database.prepare(`
          UPDATE entries
          SET glucose = ?, carbs = ?, xe = ?, rin_fast = ?, tresiba = ?, calories = ?, notes = ?, tag = ?
          WHERE user_id = ? AND id = ?
        `);
        for (const target of updatesToApply.values()) {
          updateStmt.run(
            target.glucose,
            target.carbs,
            target.xe,
            target.rin_fast,
            target.tresiba,
            target.calories,
            target.notes || '',
            target.tag || 'other',
            userId,
            target.id
          );
        }
      }

      if (idsToDelete.length > 0) {
        const deleteStmt = database.prepare('DELETE FROM entries WHERE user_id = ? AND id = ?');
        for (const id of idsToDelete) {
          deleteStmt.run(userId, id);
        }
      }

      database.exec(`RELEASE ${savepointName}`);
    } catch (err) {
      try {
        database.exec(`ROLLBACK TO ${savepointName}`);
        database.exec(`RELEASE ${savepointName}`);
      } catch {}
      console.error('Ошибка дедупликации в БД:', err);
      throw err;
    }
  }

  return idsToDelete.length;
}
