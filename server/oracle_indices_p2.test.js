import './test_setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from './index.js';
import { db, migrateEntriesTable } from './db.js';
import { createSession } from './auth.js';

test('P2: Устранение оракула 403/404 (IDOR) и оптимизация индексов SQLite', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  // Вспомогательный клиент API
  async function api(path, { method = 'GET', body, token } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data };
  }

  // 1. Создаем двух тестовых пользователей
  const userA = `usr_test_a_${Date.now()}`;
  const userB = `usr_test_b_${Date.now()}`;
  const now = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userA,
    `user_a_${Date.now()}`,
    'hash_a',
    'salt_a',
    now
  );
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userB,
    `user_b_${Date.now()}`,
    'hash_b',
    'salt_b',
    now
  );

  const tokenA = createSession(userA, 1).token;
  const tokenB = createSession(userB, 1).token;

  await t.test('1. Устранение оракула 403/404: чужие и несуществующие ID возвращают строго одинаковый 404', async () => {
    // Пользователь A создает собственную медицинскую запись
    const createRes = await api('/api/entries', {
      method: 'POST',
      token: tokenA,
      body: {
        date: '2026-04-10',
        time: '08:30',
        glucose: 5.4,
        carbs: 45,
        notes: 'Конфиденциальная запись пациента A',
      },
    });
    assert.equal(createRes.status, 201);
    const entryIdA = createRes.data.id;
    assert.ok(entryIdA);

    const nonExistentId = '00000000-0000-4000-8000-000000000000';

    // 1.1. Пользователь B пытается обновить чужую запись A -> 404 Not Found
    const updateAlien = await api(`/api/entries/${entryIdA}`, {
      method: 'PUT',
      token: tokenB,
      body: {
        date: '2026-04-10',
        time: '08:30',
        glucose: 12.0,
        notes: 'Попытка взлома B',
      },
    });

    // 1.2. Пользователь B пытается обновить несуществующую запись -> 404 Not Found
    const updateNonExist = await api(`/api/entries/${nonExistentId}`, {
      method: 'PUT',
      token: tokenB,
      body: {
        date: '2026-04-10',
        time: '08:30',
        glucose: 12.0,
      },
    });

    assert.equal(updateAlien.status, 404, 'Обновление чужой записи возвращает 404 (не 403)');
    assert.equal(updateNonExist.status, 404, 'Обновление несуществующей записи возвращает 404');
    assert.deepEqual(
      updateAlien.data,
      updateNonExist.data,
      'Тело ошибки для чужой и несуществующей записи должно быть абсолютно одинаковым (без утечки)'
    );

    // 1.3. Пользователь B пытается удалить чужую запись A -> 404 Not Found
    const deleteAlien = await api(`/api/entries/${entryIdA}`, {
      method: 'DELETE',
      token: tokenB,
    });

    // 1.4. Пользователь B пытается удалить несуществующую запись -> 404 Not Found
    const deleteNonExist = await api(`/api/entries/${nonExistentId}`, {
      method: 'DELETE',
      token: tokenB,
    });

    assert.equal(deleteAlien.status, 404, 'Удаление чужой записи возвращает 404 (не 403)');
    assert.equal(deleteNonExist.status, 404, 'Удаление несуществующей записи возвращает 404');
    assert.deepEqual(
      deleteAlien.data,
      deleteNonExist.data,
      'Тело ответа на удаление чужой и несуществующей записи идентично'
    );

    // 1.5. Проверяем, что запись A не была изменена или удалена
    const checkEntryA = db.prepare('SELECT glucose, notes FROM entries WHERE user_id = ? AND id = ?').get(userA, entryIdA);
    assert.equal(checkEntryA.glucose, 5.4);
    assert.equal(checkEntryA.notes, 'Конфиденциальная запись пациента A');

    // 1.6. Пользователь A может успешно обновить свою запись
    const updateOwn = await api(`/api/entries/${entryIdA}`, {
      method: 'PUT',
      token: tokenA,
      body: {
        date: '2026-04-10',
        time: '08:30',
        glucose: 5.8,
        notes: 'Обновлено автором',
      },
    });
    assert.equal(updateOwn.status, 200);
    assert.equal(updateOwn.data.glucose, 5.8);

    // 1.7. Пользователь A может успешно удалить свою запись
    const deleteOwn = await api(`/api/entries/${entryIdA}`, {
      method: 'DELETE',
      token: tokenA,
    });
    assert.equal(deleteOwn.status, 200);
    assert.equal(deleteOwn.data.ok, true);
  });

  await t.test('2. Оптимизация индексов SQLite: проверка удаления избыточных индексов и плана выполнения', async () => {
    // Получаем список всех индексов таблицы entries
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'entries'").all();
    const indexNames = indexes.map((i) => i.name);

    // Проверяем, что избыточный idx_entries_user_id удален
    assert.ok(!indexNames.includes('idx_entries_user_id'), 'Индекс idx_entries_user_id должен отсутствовать (избыточен с PRIMARY KEY)');
    assert.ok(!indexNames.includes('idx_entries_user_date'), 'Индекс idx_entries_user_date заменен на составной индекс с time');

    // Проверяем, что составной индекс idx_entries_user_date_time существует
    assert.ok(indexNames.includes('idx_entries_user_date_time'), 'Индекс idx_entries_user_date_time должен существовать');

    // EXPLAIN QUERY PLAN для основного запроса выборки дневника:
    // SELECT ... FROM entries WHERE user_id = ? ORDER BY date DESC, time ASC
    const getEntriesPlan = db.prepare(`
      EXPLAIN QUERY PLAN
      SELECT id, date, time, glucose, carbs, xe, rin_fast AS rinFast, tresiba, calories, notes, tag, created_at AS createdAt
      FROM entries
      WHERE user_id = ?
      ORDER BY date DESC, time ASC
    `).all(userA);

    const planDetails = getEntriesPlan.map((p) => p.detail).join('; ');

    // Запрос должен использовать индекс idx_entries_user_date_time
    assert.ok(
      planDetails.includes('idx_entries_user_date_time'),
      `План запроса дневника должен использовать idx_entries_user_date_time. Текущий план: ${planDetails}`
    );

    // Запрос НЕ должен создавать временный B-Tree для сортировки
    assert.ok(
      !planDetails.includes('USE TEMP B-TREE'),
      `План запроса не должен содержать USE TEMP B-TREE FOR ORDER BY. Текущий план: ${planDetails}`
    );

    // EXPLAIN QUERY PLAN для точечного поиска по (user_id, id):
    const pointLookupPlan = db.prepare('EXPLAIN QUERY PLAN SELECT id FROM entries WHERE user_id = ? AND id = ?').all(userA, 'test-id');
    const pointDetails = pointLookupPlan.map((p) => p.detail).join('; ');
    assert.ok(
      pointDetails.includes('sqlite_autoindex_entries_1'),
      `Точечный поиск должен использовать первичный ключ PRIMARY KEY (user_id, id). План: ${pointDetails}`
    );

    // EXPLAIN QUERY PLAN для удаления дня WHERE user_id = ? AND date = ?
    const deleteDayPlan = db.prepare('EXPLAIN QUERY PLAN DELETE FROM entries WHERE user_id = ? AND date = ?').all(userA, '2026-04-10');
    const deleteDayDetails = deleteDayPlan.map((p) => p.detail).join('; ');
    assert.ok(
      deleteDayDetails.includes('idx_entries_user_date_time'),
      `Удаление записей дня должно использовать префикс индекса idx_entries_user_date_time. План: ${deleteDayDetails}`
    );
  });

  await t.test('3. Идемпотентность миграции и сохранность медицинских данных', async () => {
    // Вставляем тестовую запись
    const testId = `entry_idemp_${Date.now()}`;
    db.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, xe, rin_fast, tresiba, calories, notes, tag, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testId, userA, '2026-04-15', '12:00', 6.0, 50, 4.2, 5, 12, 350, 'Обед перед миграцией', 'lunch', Date.now());

    // Повторно запускаем миграцию таблицы entries
    migrateEntriesTable(db);
    migrateEntriesTable(db);

    // Проверяем, что запись сохранилась без изменений
    const record = db.prepare('SELECT * FROM entries WHERE user_id = ? AND id = ?').get(userA, testId);
    assert.ok(record, 'Запись должна сохраниться после повторной миграции');
    assert.equal(record.glucose, 6.0);
    assert.equal(record.notes, 'Обед перед миграцией');
    assert.equal(record.tag, 'lunch');

    // Проверяем, что индексы в рабочем состоянии
    const indexesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'entries'").all();
    const names = indexesAfter.map((i) => i.name);
    assert.ok(names.includes('idx_entries_user_date_time'));
    assert.ok(!names.includes('idx_entries_user_id'));
  });
});
