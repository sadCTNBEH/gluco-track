import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { app } from './index.js';
import { db, migrateEntriesTable } from './db.js';
import { createSession } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('SEC-10: Шрифты подключены локально через WOFF2, внешние запросы к Google Fonts исключены', () => {
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  const mainTsxPath = path.join(ROOT_DIR, 'src/main.tsx');
  const indexCssPath = path.join(ROOT_DIR, 'src/index.css');

  assert.ok(fs.existsSync(indexHtmlPath));
  assert.ok(fs.existsSync(mainTsxPath));
  assert.ok(fs.existsSync(indexCssPath));

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  const mainTsx = fs.readFileSync(mainTsxPath, 'utf-8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

  // 1. В index.html отсутствуют любые упоминания fonts.googleapis.com и fonts.gstatic.com
  assert.doesNotMatch(
    indexHtml,
    /fonts\.googleapis\.com/i,
    'index.html не должен содержать ссылок на fonts.googleapis.com'
  );
  assert.doesNotMatch(
    indexHtml,
    /fonts\.gstatic\.com/i,
    'index.html не должен содержать ссылок на fonts.gstatic.com'
  );

  // 2. В src/main.tsx подключены локальные пакеты @fontsource для Plus Jakarta Sans и JetBrains Mono
  assert.match(mainTsx, /@fontsource\/plus-jakarta-sans\/400\.css/i);
  assert.match(mainTsx, /@fontsource\/plus-jakarta-sans\/500\.css/i);
  assert.match(mainTsx, /@fontsource\/plus-jakarta-sans\/600\.css/i);
  assert.match(mainTsx, /@fontsource\/plus-jakarta-sans\/700\.css/i);
  assert.match(mainTsx, /@fontsource\/plus-jakarta-sans\/800\.css/i);
  assert.match(mainTsx, /@fontsource\/jetbrains-mono\/400\.css/i);
  assert.match(mainTsx, /@fontsource\/jetbrains-mono\/500\.css/i);
  assert.match(mainTsx, /@fontsource\/jetbrains-mono\/600\.css/i);

  // 3. В src/index.css объявлены переменные семейств шрифтов
  assert.match(indexCss, /--font-sans:\s*'Plus Jakarta Sans'/i);
  assert.match(indexCss, /--font-mono:\s*'JetBrains Mono'/i);

  // 4. В собранном бандле (dist/assets) присутствуют локальные WOFF2 файлы
  const distAssetsDir = path.join(ROOT_DIR, 'dist/assets');
  if (fs.existsSync(distAssetsDir)) {
    const files = fs.readdirSync(distAssetsDir);
    const woff2Files = files.filter((f) => f.endsWith('.woff2'));
    assert.ok(woff2Files.length > 0, 'В dist/assets должны быть скомпилированы WOFF2 шрифты');
    assert.ok(
      woff2Files.some((f) => f.includes('plus-jakarta-sans')),
      'В dist/assets должен быть Plus Jakarta Sans woff2'
    );
    assert.ok(
      woff2Files.some((f) => f.includes('jetbrains-mono')),
      'В dist/assets должен быть JetBrains Mono woff2'
    );
  }
});

test('SEC-11: Криптографически стойкие UUID вместо Math.random() при генерации ID', async () => {
  const appTsxPath = path.join(ROOT_DIR, 'src/App.tsx');
  const excelImportPath = path.join(ROOT_DIR, 'src/utils/excelImport.ts');

  const appTsx = fs.readFileSync(appTsxPath, 'utf-8');
  const excelImport = fs.readFileSync(excelImportPath, 'utf-8');

  // В коде создания записей отсутствует Math.random()
  assert.doesNotMatch(appTsx, /Math\.random/i, 'src/App.tsx не должен использовать Math.random() для генерации ID');
  assert.match(appTsx, /crypto\.randomUUID\(\)/i, 'src/App.tsx должен использовать crypto.randomUUID()');

  assert.doesNotMatch(
    excelImport,
    /Math\.random/i,
    'src/utils/excelImport.ts не должен использовать Math.random() для генерации ID'
  );
  assert.match(
    excelImport,
    /crypto\.randomUUID\(\)/i,
    'src/utils/excelImport.ts должен использовать crypto.randomUUID()'
  );

  // Проверка серверной генерации UUID при обращении к API POST /api/entries без ID
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = `usr_uuid_test_${Date.now()}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `uuid_user_${Date.now()}`,
    'h',
    's',
    now
  );
  const { token } = createSession(testUserId, 1);

  try {
    const res = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        date: '2026-11-02',
        time: '12:00',
        glucose: 6.4,
      }),
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.ok(created.id, 'Созданная запись должна иметь id');
    assert.match(created.id, UUID_REGEX, 'Сгенерированный сервером ID должен быть валидным crypto.randomUUID()');
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-12: Составной первичный ключ PRIMARY KEY (user_id, id) исключает коллизии между пользователями', async () => {
  // 1. Проверяем, что в текущей базе SQLite таблица entries имеет составной первичный ключ
  const tableInfo = db.prepare('PRAGMA table_info(entries)').all();
  const userIdCol = tableInfo.find((c) => c.name === 'user_id');
  const idCol = tableInfo.find((c) => c.name === 'id');

  assert.ok(userIdCol && userIdCol.pk > 0, 'user_id должен быть частью первичного ключа');
  assert.ok(idCol && idCol.pk > 0, 'id должен быть частью первичного ключа');

  // 2. Тестируем независимость записей двух разных пользователей с ОДИНАКОВЫМ ID
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userA = `usr_comp_a_${Date.now()}`;
  const userB = `usr_comp_b_${Date.now()}`;
  const now = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userA,
    `comp_user_a_${Date.now()}`,
    'h',
    's',
    now
  );
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userB,
    `comp_user_b_${Date.now()}`,
    'h',
    's',
    now
  );

  const tokenA = createSession(userA, 1).token;
  const tokenB = createSession(userB, 1).token;
  const sharedEntryId = `shared_id_${Date.now()}`;

  try {
    // Пользователь A создает запись с sharedEntryId (глюкоза 5.5)
    const resA = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        id: sharedEntryId,
        date: '2026-11-02',
        time: '08:00',
        glucose: 5.5,
        notes: 'Запись пользователя A',
      }),
    });
    assert.equal(resA.status, 201, 'Пользователь A должен успешно создать запись');

    // Пользователь B создает запись с ТЕМ ЖЕ sharedEntryId (глюкоза 9.0)
    // Благодаря составному ключу (user_id, id), коллизии нет, запрос завершается успешно
    const resB = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        id: sharedEntryId,
        date: '2026-11-02',
        time: '08:00',
        glucose: 9.0,
        notes: 'Запись пользователя B с тем же ID',
      }),
    });
    assert.equal(
      resB.status,
      201,
      'Пользователь B должен успешно создать запись с тем же ID без конфликтов'
    );

    // Проверяем данные в базе SQLite: в таблице entries хранятся ОБЕ записи
    const entriesInDb = db.prepare('SELECT user_id, glucose, notes FROM entries WHERE id = ?').all(sharedEntryId);
    assert.equal(entriesInDb.length, 2, 'В базе должно быть ровно две записи с этим ID');

    const entryAInDb = entriesInDb.find((e) => e.user_id === userA);
    const entryBInDb = entriesInDb.find((e) => e.user_id === userB);

    assert.equal(entryAInDb.glucose, 5.5);
    assert.equal(entryAInDb.notes, 'Запись пользователя A');
    assert.equal(entryBInDb.glucose, 9.0);
    assert.equal(entryBInDb.notes, 'Запись пользователя B с тем же ID');

    // 3. Пользователь A обновляет свою запись -> запись пользователя B НЕ затрагивается
    const updateResA = await fetch(`${baseUrl}/api/entries/${sharedEntryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        date: '2026-11-02',
        time: '08:00',
        glucose: 6.0,
        notes: 'Обновленная запись A',
      }),
    });
    assert.equal(updateResA.status, 200);

    const checkBAfterUpdateA = db
      .prepare('SELECT glucose, notes FROM entries WHERE user_id = ? AND id = ?')
      .get(userB, sharedEntryId);
    assert.equal(checkBAfterUpdateA.glucose, 9.0, 'Запись B не должна измениться при обновлении записи A');
    assert.equal(checkBAfterUpdateA.notes, 'Запись пользователя B с тем же ID');

    // 4. Пользователь A удаляет свою запись -> запись пользователя B остается в базе
    const deleteResA = await fetch(`${baseUrl}/api/entries/${sharedEntryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(deleteResA.status, 200);

    const checkAAfterDelete = db
      .prepare('SELECT id FROM entries WHERE user_id = ? AND id = ?')
      .get(userA, sharedEntryId);
    assert.equal(checkAAfterDelete, undefined, 'Запись пользователя A должна быть удалена');

    const checkBAfterDeleteA = db
      .prepare('SELECT id, glucose FROM entries WHERE user_id = ? AND id = ?')
      .get(userB, sharedEntryId);
    assert.ok(checkBAfterDeleteA, 'Запись пользователя B должна остаться нетронутой');
    assert.equal(checkBAfterDeleteA.glucose, 9.0);
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
  }
});

test('SEC-12: Дедупликация при повторном импорте (re-import idempotency)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = `usr_reimport_${Date.now()}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `reimport_user_${Date.now()}`,
    'h',
    's',
    now
  );
  const { token } = createSession(testUserId, 1);

  const testEntries = [
    { id: `reimp_1_${Date.now()}`, date: '2026-11-01', time: '08:00', glucose: 5.4, notes: 'Первый импорт' },
    { id: `reimp_2_${Date.now()}`, date: '2026-11-01', time: '13:00', glucose: 6.8, notes: 'Первый импорт' },
  ];

  try {
    // 1. Первый импорт пакета
    const res1 = await fetch(`${baseUrl}/api/entries/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entries: testEntries, replaceAll: false }),
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.importedCount, 2);

    // 2. Повторный импорт того же пакета с обновленной заметкой (без replaceAll)
    const updatedEntries = testEntries.map((e) => ({ ...e, notes: 'Повторный импорт с обновлением' }));
    const res2 = await fetch(`${baseUrl}/api/entries/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entries: updatedEntries, replaceAll: false }),
    });
    assert.equal(res2.status, 200);

    // В базе должно остаться ровно 2 записи (без дублей), с обновленными данными
    const rows = db.prepare('SELECT id, notes FROM entries WHERE user_id = ?').all(testUserId);
    assert.equal(rows.length, 2, 'Повторный импорт не должен создавать дублирующиеся записи');
    assert.equal(rows[0].notes, 'Повторный импорт с обновлением');
    assert.equal(rows[1].notes, 'Повторный импорт с обновлением');
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-12: Атомарная и идемпотентная миграция старой таблицы entries в схему PRIMARY KEY (user_id, id)', () => {
  // Тестируем миграцию на изолированной базе в памяти
  const testDb = new DatabaseSync(':memory:');

  try {
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL
      );
      -- Старая схема (v1): id TEXT PRIMARY KEY (без user_id в ключе)
      CREATE TABLE entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        glucose REAL,
        carbs REAL,
        xe REAL,
        rin_fast REAL,
        tresiba REAL,
        calories REAL,
        notes TEXT,
        tag TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    testDb.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('usr_legacy_1', 'legacy_1');
    testDb.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('usr_legacy_2', 'legacy_2');

    const now = Date.now();
    // Вставляем записи в старую таблицу
    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('entry-old-1', 'usr_legacy_1', '2026-11-01', '08:00', 5.5, 20, now);

    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('entry-old-2', 'usr_legacy_2', '2026-11-01', '09:00', 6.0, 30, now);

    // 1. Запуск миграции таблицы entries
    migrateEntriesTable(testDb);

    // 2. Проверка новой схемы
    const columns = testDb.prepare('PRAGMA table_info(entries)').all();
    const userIdCol = columns.find((c) => c.name === 'user_id');
    const idCol = columns.find((c) => c.name === 'id');

    assert.ok(userIdCol.pk > 0, 'user_id должен входить в составной PK после миграции');
    assert.ok(idCol.pk > 0, 'id должен входить в составной PK после миграции');

    // 3. Проверка сохранности данных
    const entriesAfterMigration = testDb.prepare('SELECT * FROM entries ORDER BY id ASC').all();
    assert.equal(entriesAfterMigration.length, 2, 'Все существующие записи должны сохраниться');
    assert.equal(entriesAfterMigration[0].id, 'entry-old-1');
    assert.equal(entriesAfterMigration[0].user_id, 'usr_legacy_1');
    assert.equal(entriesAfterMigration[0].glucose, 5.5);

    assert.equal(entriesAfterMigration[1].id, 'entry-old-2');
    assert.equal(entriesAfterMigration[1].user_id, 'usr_legacy_2');
    assert.equal(entriesAfterMigration[1].glucose, 6.0);

    // 4. Проверка возможности добавления в мигрированную таблицу записи с одинаковым ID для второго пользователя
    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('entry-old-1', 'usr_legacy_2', '2026-11-01', '10:00', 7.5, now);

    const checkColl = testDb.prepare('SELECT COUNT(*) as cnt FROM entries WHERE id = ?').get('entry-old-1');
    assert.equal(checkColl.cnt, 2, 'После миграции разные пользователи могут иметь одинаковый ID');

    // 5. Идемпотентность: повторный вызов migrateEntriesTable не вызывает ошибок и не повреждает данные
    migrateEntriesTable(testDb);
    const checkIdempotency = testDb.prepare('SELECT COUNT(*) as cnt FROM entries').get();
    assert.equal(checkIdempotency.cnt, 3, 'Повторная миграция не должна изменять количество записей');
  } finally {
    testDb.close();
  }
});
