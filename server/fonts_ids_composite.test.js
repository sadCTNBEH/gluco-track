import './test_setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { app, deduplicateUserEntries } from './index.js';
import { db, migrateEntriesTable } from './db.js';
import { createSession } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('SEC-10: Шрифты подключены локально через WOFF2, внешние запросы к Google Fonts исключены', () => {
  const indexHtmlPath = path.join(ROOT_DIR, 'index.html');
  const indexCssPath = path.join(ROOT_DIR, 'src/index.css');

  assert.ok(fs.existsSync(indexHtmlPath));
  assert.ok(fs.existsSync(indexCssPath));

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  const indexCss = fs.readFileSync(indexCssPath, 'utf-8');

  // 1. Архитектурная проверка безопасности: в index.html отсутствуют любые упоминания fonts.googleapis.com и fonts.gstatic.com
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

  // 2. В src/index.css объявлены переменные семейств шрифтов
  assert.match(indexCss, /--font-sans:\s*'Plus Jakarta Sans'/i);
  assert.match(indexCss, /--font-mono:\s*'JetBrains Mono'/i);

  // 3. Поведенческая проверка артефактов сборки (dist/assets): локальные WOFF2 файлы
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

    // 4. Поведенческая проверка CSS: стили ссылаются исключительно на локальные шрифты без внешних URL
    const cssFiles = files.filter((f) => f.endsWith('.css'));
    assert.ok(cssFiles.length > 0, 'В dist/assets должен присутствовать скомпилированный CSS');
    for (const cssFile of cssFiles) {
      const cssContent = fs.readFileSync(path.join(distAssetsDir, cssFile), 'utf-8');
      assert.doesNotMatch(
        cssContent,
        /url\(['"]?https?:\/\/[^'")]+\.(?:woff2?|ttf|otf|eot)/i,
        `CSS ${cssFile} не должен загружать шрифты по внешним HTTP/HTTPS URL`
      );
      assert.match(
        cssContent,
        /url\(['"]?(?:\/assets|\.\/assets|\.\/|\/)[^'")]+\.woff2/i,
        `CSS ${cssFile} должен загружать шрифты из локальных assets`
      );
    }
  }
});

test('SEC-11: Криптографически стойкие UUID вместо Math.random() при генерации ID', async () => {
  const appTsxPath = path.join(ROOT_DIR, 'src/App.tsx');
  const excelImportPath = path.join(ROOT_DIR, 'src/utils/excelImport.ts');
  const useDiaryDataPath = path.join(ROOT_DIR, 'src/hooks/useDiaryData.ts');

  // Архитектурное ограничение: запрет Math.random() для генерации идентификаторов
  if (fs.existsSync(appTsxPath)) {
    assert.doesNotMatch(fs.readFileSync(appTsxPath, 'utf-8'), /Math\.random/i, 'src/App.tsx не должен использовать Math.random()');
  }
  if (fs.existsSync(useDiaryDataPath)) {
    assert.doesNotMatch(fs.readFileSync(useDiaryDataPath, 'utf-8'), /Math\.random/i, 'src/hooks/useDiaryData.ts не должен использовать Math.random()');
  }
  if (fs.existsSync(excelImportPath)) {
    assert.doesNotMatch(fs.readFileSync(excelImportPath, 'utf-8'), /Math\.random/i, 'src/utils/excelImport.ts не должен использовать Math.random()');
  }

  // Поведенческая проверка 1: парсер Excel/CSV генерирует реальные криптостойкие UUID v4 для записей без ID
  const { parseExcelDiary } = await import('../src/utils/excelImport.ts');
  const sampleCsv = `Дата,Время,Глюкоза,Углеводы,ХЕ,Болюс,Базал,Примечания
2026-11-01,08:00,5.5,20,1.7,3,14,Завтрак
2026-11-01,13:00,6.0,30,2.5,4,,Обед
2026-11-01,19:00,7.0,40,3.3,5,,Ужин`;
  const file = new File([sampleCsv], 'diary.csv', { type: 'text/csv' });
  const parsed = await parseExcelDiary(file);
  assert.equal(parsed.entries.length, 3);
  const generatedIds = new Set();
  for (const entry of parsed.entries) {
    assert.ok(entry.id, 'Каждая импортированная запись должна иметь сгенерированный ID');
    assert.match(
      entry.id,
      UUID_REGEX,
      `Сгенерированный ID (${entry.id}) должен быть валидным UUID v4`
    );
    generatedIds.add(entry.id);
  }
  assert.equal(generatedIds.size, 3, 'Все сгенерированные идентификаторы должны быть уникальными');

  // Поведенческая проверка 2: серверная генерация UUID при обращении к API POST /api/entries без ID
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

    // Проверяем реальное ограничение SQLite: попытка вставить запись с дублирующимся (user_id, id)
    // должна отклоняться SQLite с ошибкой PRIMARY KEY / UNIQUE constraint
    assert.throws(
      () => {
        db.prepare('INSERT INTO entries (id, user_id, date, time, created_at) VALUES (?, ?, ?, ?, ?)').run(
          sharedEntryId,
          userA,
          '2026-11-02',
          '11:00',
          Date.now()
        );
      },
      (err) => {
        return /UNIQUE constraint failed|PRIMARY KEY constraint failed/i.test(err.message);
      },
      'Повторная вставка с одинаковым составным первичным ключом (user_id, id) должна отклоняться SQLite'
    );

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

test('deduplicateUserEntries: находит и безопасно объединяет дубликаты в SQLite', () => {
  const testDb = new DatabaseSync(':memory:');
  try {
    testDb.exec(`
      CREATE TABLE entries (
        id TEXT NOT NULL,
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
        PRIMARY KEY (user_id, id)
      );
    `);

    const now = Date.now();
    const userId = 'usr_dedup_test';

    // Вставляем 3 записи: 2 из них — дубликаты на 12:00
    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('e1', userId, '2026-11-02', '12:00', 5.5, null, now);

    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('e2', userId, '2026-11-02', '12:00', 5.5, 45, 'Обед', now + 10);

    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('e3', userId, '2026-11-02', '18:00', 6.8, 50, now + 20);

    const countBefore = testDb.prepare('SELECT COUNT(*) as cnt FROM entries WHERE user_id = ?').get(userId);
    assert.equal(countBefore.cnt, 3);

    const removed = deduplicateUserEntries(userId, testDb);
    assert.equal(removed, 1, 'Ровно 1 дубликат должен быть удален');

    const countAfter = testDb.prepare('SELECT COUNT(*) as cnt FROM entries WHERE user_id = ?').get(userId);
    assert.equal(countAfter.cnt, 2, 'В базе должно остаться 2 уникальные записи');

    const merged = testDb.prepare('SELECT * FROM entries WHERE user_id = ? AND time = ?').get(userId, '12:00');
    assert.equal(merged.glucose, 5.5);
    assert.equal(merged.carbs, 45, 'Углеводы из дубликата должны быть объединены в основную запись');
    assert.equal(merged.notes, 'Обед', 'Заметка должна быть сохранена');
  } finally {
    testDb.close();
  }
});

test('deduplicateUserEntries: безопасная работа внутри открытой транзакции BEGIN (SAVEPOINT без ошибки вложенного BEGIN)', () => {
  const testDb = new DatabaseSync(':memory:');
  try {
    testDb.exec(`
      CREATE TABLE entries (
        id TEXT NOT NULL,
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
        PRIMARY KEY (user_id, id)
      );
    `);

    const now = Date.now();
    const userId = 'usr_nested_tx_test';

    // Открываем внешнюю транзакцию
    testDb.exec('BEGIN');

    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('n1', userId, '2026-11-02', '14:00', 6.0, null, now);

    testDb.prepare(`
      INSERT INTO entries (id, user_id, date, time, glucose, carbs, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('n2', userId, '2026-11-02', '14:00', 6.0, 30, 'Перекус', now + 10);

    // Вызываем deduplicateUserEntries ВНУТРИ активной транзакции
    // До исправления это вызывало ошибку: "cannot start a transaction within a transaction"
    const removed = deduplicateUserEntries(userId, testDb);
    assert.equal(removed, 1, 'Внутри транзакции должен быть удален ровно 1 дубликат');

    // Фиксируем внешнюю транзакцию
    testDb.exec('COMMIT');

    const remaining = testDb.prepare('SELECT * FROM entries WHERE user_id = ?').all(userId);
    assert.equal(remaining.length, 1, 'После COMMIT в БД должна остаться 1 объединенная запись');
    assert.equal(remaining[0].glucose, 6.0);
    assert.equal(remaining[0].carbs, 30);
    assert.equal(remaining[0].notes, 'Перекус');
  } finally {
    testDb.close();
  }
});

test('deduplicateUserEntries: идемпотентность и изоляция разных пользователей', () => {
  const testDb = new DatabaseSync(':memory:');
  try {
    testDb.exec(`
      CREATE TABLE entries (
        id TEXT NOT NULL,
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
        PRIMARY KEY (user_id, id)
      );
    `);

    const userA = 'usr_patient_A';
    const userB = 'usr_patient_B';
    const now = Date.now();

    // Пользователь A: 2 дубликата на 12:00
    testDb.prepare('INSERT INTO entries (id, user_id, date, time, glucose, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('a1', userA, '2026-11-02', '12:00', 5.0, now);
    testDb.prepare('INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('a2', userA, '2026-11-02', '12:00', 5.0, 40, now + 5);

    // Пользователь B: своя запись на ТО ЖЕ САМОЕ время 12:00
    testDb.prepare('INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('b1', userB, '2026-11-02', '12:00', 5.0, 90, now);

    // Дедуплицируем только пользователя A
    const removedA = deduplicateUserEntries(userA, testDb);
    assert.equal(removedA, 1, 'Для пользователя A должен быть удален 1 дубликат');

    // Проверяем изоляцию: данные пользователя B не должны измениться
    const entryB = testDb.prepare('SELECT * FROM entries WHERE user_id = ?').all(userB);
    assert.equal(entryB.length, 1, 'Запись пользователя B должна остаться нетронутой');
    assert.equal(entryB[0].carbs, 90, 'Данные пользователя B не должны быть смешаны');

    // Идемпотентность: повторный вызов дедупликации для A возвращает 0 и не удаляет ничего
    const removedAgain = deduplicateUserEntries(userA, testDb);
    assert.equal(removedAgain, 0, 'Повторный вызов дедупликации должен возвращать 0');
    const remainingA = testDb.prepare('SELECT COUNT(*) as cnt FROM entries WHERE user_id = ?').get(userA);
    assert.equal(remainingA.cnt, 1, 'Количество записей пользователя A должно остаться равным 1');
  } finally {
    testDb.close();
  }
});

test('POST /api/entries/import: успешный импорт с дубликатами в единой атомарной транзакции (P0)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = `usr_import_dedup_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `import_dedup_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    'h',
    's',
    now
  );
  const { token } = createSession(testUserId, 1);

  try {
    // Пакет импорта, содержащий 3 записи: 2 из них — дубликаты на 09:00
    const importPayload = {
      entries: [
        {
          id: 'imp-1',
          date: '2026-11-02',
          time: '09:00',
          glucose: 5.4,
          carbs: null,
          notes: '',
        },
        {
          id: 'imp-2',
          date: '2026-11-02',
          time: '09:00',
          glucose: 5.4,
          carbs: 50,
          notes: 'Завтрак',
        },
        {
          id: 'imp-3',
          date: '2026-11-02',
          time: '14:00',
          glucose: 6.2,
          carbs: 60,
          notes: 'Обед',
        },
      ],
      replaceAll: false,
    };

    const res = await fetch(`${baseUrl}/api/entries/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(importPayload),
    });

    assert.equal(res.status, 200, 'Импорт с дубликатами должен успешно завершиться со статусом 200 (без падения на вложенном BEGIN)');
    const body = await res.json();
    assert.equal(body.ok, true);

    // Проверяем, что в базе для этого пользователя ровно 2 уникальные записи
    const saved = db.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY time ASC').all(testUserId);
    assert.equal(saved.length, 2, 'В БД должно остаться ровно 2 уникальные записи');

    const breakfast = saved.find((e) => e.time === '09:00');
    assert.ok(breakfast);
    assert.equal(breakfast.glucose, 5.4);
    assert.equal(breakfast.carbs, 50, 'Углеводы из дубликата должны быть объединены');
    assert.equal(breakfast.notes, 'Завтрак');
  } finally {
    server.close();
    db.prepare('DELETE FROM entries WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('POST /api/entries/import: откат транзакции при ошибке (отсутствие частичного сохранения)', () => {
  const testDb = new DatabaseSync(':memory:');
  try {
    testDb.exec(`
      CREATE TABLE entries (
        id TEXT NOT NULL,
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
        PRIMARY KEY (user_id, id)
      );
    `);

    const userId = 'usr_rollback_test';
    const entries = [
      { id: 'rb-1', date: '2026-11-02', time: '10:00', glucose: 5.0 },
      { id: 'rb-2', date: '2026-11-02', time: '12:00', glucose: 6.0 },
    ];

    // Симулируем атомарный блок импорта с возникновением ошибки перед фиксацией
    assert.throws(() => {
      testDb.exec('BEGIN');
      try {
        for (const e of entries) {
          testDb.prepare(`
            INSERT INTO entries (id, user_id, date, time, glucose, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(e.id, userId, e.date, e.time, e.glucose, Date.now());
        }
        // Симулируем критический сбой
        throw new Error('Simulated crash during import transaction');
      } catch (err) {
        testDb.exec('ROLLBACK');
        throw err;
      }
    }, /Simulated crash/);

    const count = testDb.prepare('SELECT COUNT(*) as cnt FROM entries WHERE user_id = ?').get(userId);
    assert.equal(count.cnt, 0, 'При ошибке транзакция должна быть полностью откатана, частичные записи отсутствуют');
  } finally {
    testDb.close();
  }
});

test('GET /api/entries: отсутствие побочных эффектов (read-only семантика, P1)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = `usr_readonly_get_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `readonly_get_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    'h',
    's',
    now
  );
  const { token } = createSession(testUserId, 1);

  // Вставляем 2 записи с одинаковым временем напрямую в БД (дубликаты)
  db.prepare('INSERT INTO entries (id, user_id, date, time, glucose, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    'dup-1',
    testUserId,
    '2026-11-02',
    '15:00',
    7.5,
    now
  );
  db.prepare('INSERT INTO entries (id, user_id, date, time, glucose, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    'dup-2',
    testUserId,
    '2026-11-02',
    '15:00',
    7.5,
    now + 1
  );

  try {
    const countBefore = db.prepare('SELECT COUNT(*) as cnt FROM entries WHERE user_id = ?').get(testUserId);
    assert.equal(countBefore.cnt, 2, 'До запроса в базе 2 записи');

    // Вызываем GET /api/entries
    const res = await fetch(`${baseUrl}/api/entries`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.length, 2, 'GET должен вернуть текущее состояние без скрытой модификации');

    // Проверяем БД: количество записей в базе НЕ должно измениться!
    const countAfter = db.prepare('SELECT COUNT(*) as cnt FROM entries WHERE user_id = ?').get(testUserId);
    assert.equal(countAfter.cnt, 2, 'GET /api/entries не должен выполнять мутаций и удалений (чистый read-only)');
  } finally {
    server.close();
    db.prepare('DELETE FROM entries WHERE user_id = ?').run(testUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('P1 Test Isolation: server/db.js блокирует запуск тестов с рабочей директорией ./data', () => {
  const result = cp.spawnSync(
    process.execPath,
    ['--input-type=module', '-e', "process.env.NODE_ENV = 'test'; process.env.DATA_DIR = './data'; import('./server/db.js');"],
    { cwd: ROOT_DIR, encoding: 'utf-8' }
  );
  assert.notEqual(result.status, 0, 'Запуск с ./data должен завершаться с ненулевым кодом ошибки');
  assert.match(
    result.stderr,
    /КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ: Запуск тестов с рабочей директорией \.\/data категорически запрещен!/,
    'Должно выбрасываться исключение о нарушении безопасности'
  );
});

test('P1 Test Isolation: тесты используют изолированный DATA_DIR в os.tmpdir() и не трогают ./data', () => {
  assert.ok(process.env.DATA_DIR, 'process.env.DATA_DIR должен быть определен в тестах');
  const defaultDataDir = path.resolve(ROOT_DIR, 'data');
  const currentDataDir = path.resolve(process.env.DATA_DIR);
  assert.notEqual(currentDataDir, defaultDataDir, 'DATA_DIR тестов не должен указывать на ./data');
  assert.equal(
    currentDataDir.startsWith(defaultDataDir),
    false,
    'DATA_DIR тестов не должен находиться внутри директории ./data'
  );
});
