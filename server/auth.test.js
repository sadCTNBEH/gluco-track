import './test_setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { DatabaseSync } from 'node:sqlite';
import {
  hashPassword,
  verifyPassword,
  verifyPasswordDummy,
  validateNewPassword,
  createSession,
  getUserByToken,
  deleteSession,
  hashSessionToken,
  cleanExpiredSessions,
  cleanExpiredSessionsThrottled,
  resetCleanupThrottle,
  authMiddleware,
  SESSION_MAX_DAYS,
  INACTIVITY_TIMEOUT_MS,
  ACTIVITY_UPDATE_INTERVAL_MS,
} from './auth.js';
import { db, migrateSessionsTable } from './db.js';

test('SEC-02: Обратная совместимость старых хешей scryptSync с асинхронным verifyPassword', async () => {
  // Имитируем старый хеш, созданный в v1 синхронным методом crypto.scryptSync
  const oldSalt = 'e5f6a1b2c3d40718293a4b5c6d7e8f90';
  const oldPassword = 'short'; // старый короткий пароль (< 12 символов)
  const legacySyncHash = crypto.scryptSync(oldPassword, oldSalt, 64).toString('hex');

  // Асинхронный verifyPassword должен успешно проверить старый хеш
  const isValid = await verifyPassword(oldPassword, legacySyncHash, oldSalt);
  assert.equal(isValid, true, 'Старый пароль должен успешно проходить проверку');

  // Неверный пароль к старому хешу должен быть отклонен
  const isInvalid = await verifyPassword('wrongShort', legacySyncHash, oldSalt);
  assert.equal(isInvalid, false);
});

test('SEC-02: Асинхронное хеширование hashPassword создает совместимый и валидный хеш', async () => {
  const password = 'myLongClinicalPassphrase2026';
  const { hash, salt } = await hashPassword(password);

  assert.equal(typeof hash, 'string');
  assert.equal(hash.length, 128); // 64 байта в hex = 128 символов
  assert.equal(typeof salt, 'string');
  assert.equal(salt.length, 32); // 16 байт в hex = 32 символа

  const verified = await verifyPassword(password, hash, salt);
  assert.equal(verified, true);

  const wrongVerified = await verifyPassword('anotherPassword', hash, salt);
  assert.equal(wrongVerified, false);
});

test('SEC-06: Валидация новых паролей (мин. 12 знаков, запрет тривиальных, разрешение фраз)', () => {
  // 1. Короткие пароли (< 12 символов) должны отклоняться
  assert.equal(
    validateNewPassword('12345', 'patient1'),
    'Пароль должен содержать не менее 12 символов'
  );
  assert.equal(
    validateNewPassword('shortpwd', 'patient1'),
    'Пароль должен содержать не менее 12 символов'
  );
  assert.equal(
    validateNewPassword('12345678901', 'patient1'),
    'Пароль должен содержать не менее 12 символов'
  );

  // 2. Пароль, содержащий логин пользователя, должен отклоняться
  assert.equal(
    validateNewPassword('patient1_secure', 'patient1'),
    'Пароль не должен содержать ваш логин'
  );

  // 3. Пароль из одного повторяющегося символа должен отклоняться
  assert.equal(
    validateNewPassword('aaaaaaaaaaaa', 'user'),
    'Пароль не должен состоять из одного повторяющегося символа'
  );
  assert.equal(
    validateNewPassword('111111111111', 'user'),
    'Пароль не должен состоять из одного повторяющегося символа'
  );

  // 4. Очевидно слабые и словарные пароли (>= 12 символов) должны отклоняться
  assert.equal(
    validateNewPassword('123456789012', 'user'),
    'Пароль не должен состоять из простой последовательности цифр'
  );
  assert.equal(
    validateNewPassword('password12345', 'user'),
    'Данный пароль слишком простой и легко угадываемый. Выберите более надежный пароль'
  );
  assert.equal(
    validateNewPassword('qwertyuiopas', 'user'),
    'Данный пароль слишком простой и легко угадываемый. Выберите более надежный пароль'
  );
  assert.equal(
    validateNewPassword('administrator', 'user'),
    'Данный пароль слишком простой и легко угадываемый. Выберите более надежный пароль'
  );

  // 5. Надежные пароли и фразы БЕЗ обязательных спецсимволов должны успешно приниматься
  assert.equal(
    validateNewPassword('correct horse battery staple', 'ivanov'),
    null,
    'Парольная фраза без спецсимволов должна быть валидной'
  );
  assert.equal(
    validateNewPassword('glucoTrackSafePassphrase2026', 'ivanov'),
    null,
    'Надежный пароль должен приниматься'
  );
  assert.equal(
    validateNewPassword('insulinrinfastkontrol2026', 'ivanov'),
    null,
    'Длинная фраза на русском/латинице должна приниматься'
  );
});

test('SEC-06: Защита от перечисления пользователей (фиктивная проверка для несуществующего пользователя)', async () => {
  // Фиктивная проверка verifyPasswordDummy должна всегда возвращать false
  const dummyRes = await verifyPasswordDummy('nonExistentUserPassword123');
  assert.equal(dummyRes, false);

  // Сравниваем время выполнения проверки существующего и несуществующего пользователя:
  // Они оба выполняют scrypt с одинаковыми параметрами и имеют сопоставимое время работы
  const t0 = performance.now();
  await verifyPasswordDummy('somePassword12345');
  const dummyDuration = performance.now() - t0;

  const { hash, salt } = await hashPassword('realPassword12345');
  const t1 = performance.now();
  await verifyPassword('realPassword12345', hash, salt);
  const realDuration = performance.now() - t1;

  // Оба вызова должны выполняться в порядке величины десятков миллисекунд (не субмиллисекунды)
  assert.ok(dummyDuration > 5, `Фиктивная проверка должна занимать время scrypt (получено ${dummyDuration.toFixed(1)}мс)`);
  assert.ok(realDuration > 5, `Реальная проверка должна занимать время scrypt (получено ${realDuration.toFixed(1)}мс)`);
});

test('SEC-02: Параллельные запросы scrypt не блокируют event loop Node.js', async () => {
  let timerTickCount = 0;
  const interval = setInterval(() => {
    timerTickCount++;
  }, 10);

  // Запускаем 6 параллельных вызовов scrypt (превышающих размер пула потоков)
  const scryptPromises = Array.from({ length: 6 }, (_, i) =>
    hashPassword(`concurrentPassword_${i}_test123456`)
  );

  await Promise.all(scryptPromises);
  clearInterval(interval);

  // Если бы вызовы были синхронными (scryptSync), event loop заблокировался бы полностью и таймер не сработал
  // При асинхронном scrypt таймер должен сработать многократно
  assert.ok(
    timerTickCount > 0,
    `Event loop не должен блокироваться во время scrypt (таймер сработал ${timerTickCount} раз)`
  );
});

test('SEC-02: Rate Limiting возвращает HTTP 429 и Retry-After', async () => {
  const app = express();
  app.set('trust proxy', 'loopback');
  app.use(express.json());

  // Лимитер: макс 2 запроса
  const testLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 2,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    statusCode: 429,
    message: { error: 'Слишком много запросов' },
  });

  app.post('/test-limit', testLimiter, (req, res) => {
    res.json({ ok: true });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Запрос 1: OK
    const r1 = await fetch(`${baseUrl}/test-limit`, { method: 'POST' });
    assert.equal(r1.status, 200);

    // Запрос 2: OK
    const r2 = await fetch(`${baseUrl}/test-limit`, { method: 'POST' });
    assert.equal(r2.status, 200);

    // Запрос 3: Превышение лимита -> 429
    const r3 = await fetch(`${baseUrl}/test-limit`, { method: 'POST' });
    assert.equal(r3.status, 429, 'Третий запрос должен возвращать 429 Too Many Requests');

    // Проверяем наличие заголовка Retry-After
    const retryAfter = r3.headers.get('retry-after');
    assert.ok(retryAfter, 'Ответ 429 должен содержать заголовок Retry-After');
    assert.ok(Number(retryAfter) > 0, 'Retry-After должен быть положительным числом секунд');

    const body = await r3.json();
    assert.equal(body.error, 'Слишком много запросов');
  } finally {
    server.close();
  }
});

test('SEC-02 / SEC-06: Защита от подделки IP (trust proxy loopback)', async () => {
  const app = express();
  app.set('trust proxy', 'loopback');

  let detectedIp = '';
  app.get('/test-ip', (req, res) => {
    detectedIp = req.ip;
    res.json({ ip: req.ip });
  });

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // Запрос с локального адреса 127.0.0.1 с заголовком X-Forwarded-For:
    // Поскольку соединение исходит от 127.0.0.1 (loopback), Express доверяет прокси и считывает 203.0.113.195
    const rProxy = await fetch(`http://127.0.0.1:${port}/test-ip`, {
      headers: { 'X-Forwarded-For': '203.0.113.195' },
    });
    const bodyProxy = await rProxy.json();
    assert.equal(bodyProxy.ip, '203.0.113.195', 'Для loopback-прокси IP берется из X-Forwarded-For');
  } finally {
    server.close();
  }
});

test('SEC-04: Полный цикл сессии и хранение исключительно SHA-256 хеша в БД', () => {
  const testUserId = `test_usr_${Date.now()}`;
  const now = Date.now();

  // Создаем тестового пользователя для удовлетворения FOREIGN KEY (user_id)
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `testuser_${Date.now()}`,
    'dummyhash',
    'dummysalt',
    now
  );

  try {
    const { token, expiresAt } = createSession(testUserId, 7);

    assert.ok(token);
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 64); // 32 байта в hex
    assert.ok(expiresAt > Date.now());

    // 1. Проверяем, что в SQLite записан исключительно SHA-256 хеш токена, а не открытый токен
    const tokenHash = hashSessionToken(token);
    assert.equal(tokenHash.length, 64);

    const sessionInDb = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.ok(sessionInDb, 'Сессия должна находиться по SHA-256 хешу');
    assert.equal(sessionInDb.user_id, testUserId);
    assert.equal(sessionInDb.token_hash, tokenHash);
    assert.ok(sessionInDb.last_activity_at > 0);

    // Убеждаемся, что в базе НЕТ открытого токена (поиск открытого токена в качестве token_hash возвращает null)
    const rawLookup = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(token);
    assert.equal(rawLookup, undefined, 'Открытый токен не должен быть записан в таблицу');

    // 2. Получение пользователя по открытому токену через getUserByToken
    const user = getUserByToken(token);
    assert.ok(user);
    assert.equal(user.id, testUserId);

    // 3. Немедленный отзыв сессии при логауте
    deleteSession(token);
    const afterDelete = getUserByToken(token);
    assert.equal(afterDelete, null, 'Отозванная сессия не должна находиться');

    const dbCheckAfterDelete = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(dbCheckAfterDelete, undefined, 'Строка сессии должна быть удалена из SQLite');
  } finally {
    // Очистка тестового пользователя
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-04: Ограничение срока жизни сессии 7 днями (SESSION_MAX_DAYS)', () => {
  const testUserId = `test_usr_maxdays_${Date.now()}`;
  const now = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `testuser_max_${Date.now()}`,
    'dummyhash',
    'dummysalt',
    now
  );

  try {
    // Запрос на 30 дней должен быть принудительно ограничен SESSION_MAX_DAYS (7 дней)
    const { token, expiresAt } = createSession(testUserId, 30, db, now);
    const expectedMaxExpires = now + SESSION_MAX_DAYS * 24 * 60 * 60 * 1000;
    assert.equal(expiresAt, expectedMaxExpires, 'Срок сессии должен быть ограничен 7 днями');

    // При проверке в момент до истечения срока — сессия активна
    const validUser = getUserByToken(token, db, now + 1000);
    assert.ok(validUser);

    // При проверке после 7 дней — сессия истекает и не продлевается
    const expiredUser = getUserByToken(token, db, expectedMaxExpires + 1);
    assert.equal(expiredUser, null, 'Сессия после 7 дней должна возвращать null');

    // И удаляться из базы
    const tokenHash = hashSessionToken(token);
    const inDb = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(inDb, undefined, 'Истекшая сессия должна удаляться из БД');
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-04: Таймаут неактивности 24 часа (inactivity timeout)', () => {
  const testUserId = `test_usr_inactivity_${Date.now()}`;
  const t0 = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `testuser_inac_${Date.now()}`,
    'dummyhash',
    'dummysalt',
    t0
  );

  try {
    const { token } = createSession(testUserId, 7, db, t0);

    // Запрос через 2 часа (< 24 часов) — успешен
    const userActive = getUserByToken(token, db, t0 + 2 * 60 * 60 * 1000);
    assert.ok(userActive, 'Сессия активна при обращениях в пределах 24 часов');

    // Запрос через 25 часов после последней активности — отказ по таймауту неактивности
    const afterInactivity = t0 + 2 * 60 * 60 * 1000 + INACTIVITY_TIMEOUT_MS + 1000;
    const userInactive = getUserByToken(token, db, afterInactivity);
    assert.equal(userInactive, null, 'Сессия неактивна более 24 часов и должна отклоняться');

    // Сессия должна быть удалена из базы
    const tokenHash = hashSessionToken(token);
    const inDb = db.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(inDb, undefined, 'Неактивная сессия должна быть удалена из базы');
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-04: Троттлинг обновления last_activity_at (не чаще одного раза в 5 минут)', () => {
  const testUserId = `test_usr_throttle_${Date.now()}`;
  const t0 = 1700000000000;

  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `testuser_thr_${Date.now()}`,
    'dummyhash',
    'dummysalt',
    t0
  );

  try {
    const { token } = createSession(testUserId, 7, db, t0);
    const tokenHash = hashSessionToken(token);

    // Начальный last_activity_at равен t0
    let row = db.prepare('SELECT last_activity_at FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(row.last_activity_at, t0);

    // Обращение через 2 минуты (< 5 минут ACTIVITY_UPDATE_INTERVAL_MS)
    getUserByToken(token, db, t0 + 2 * 60 * 1000);
    row = db.prepare('SELECT last_activity_at FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(row.last_activity_at, t0, 'last_activity_at НЕ должен перезаписываться при обращении ранее 5 минут');

    // Обращение через 6 минут (> 5 минут ACTIVITY_UPDATE_INTERVAL_MS)
    const t6 = t0 + 6 * 60 * 1000;
    getUserByToken(token, db, t6);
    row = db.prepare('SELECT last_activity_at FROM sessions WHERE token_hash = ?').get(tokenHash);
    assert.equal(row.last_activity_at, t6, 'last_activity_at должен обновиться при обращении спустя > 5 минут');
  } finally {
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-04: Оппортунистическая очистка устаревших сессий (cleanExpiredSessions)', () => {
  const testDb = new DatabaseSync(':memory:');
  testDb.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT);
    CREATE TABLE sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL
    );
  `);
  const testUserId = `test_usr_clean_${Date.now()}`;
  const now = 1750000000000;

  testDb.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(testUserId, 'testuser_cln');

  try {
    const expiredTokenHash = crypto.randomBytes(32).toString('hex');
    const inactiveTokenHash = crypto.randomBytes(32).toString('hex');
    const activeTokenHash = crypto.randomBytes(32).toString('hex');

    // 1. Истекшая по абсолютному сроку
    testDb.prepare(`
      INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(expiredTokenHash, testUserId, now - 10 * 86400000, now - 1000, now - 1000);

    // 2. Истекшая по неактивности (> 24 часов)
    testDb.prepare(`
      INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(inactiveTokenHash, testUserId, now - 2 * 86400000, now + 5 * 86400000, now - 25 * 3600000);

    // 3. Активная сессия
    testDb.prepare(`
      INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_activity_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(activeTokenHash, testUserId, now - 1000, now + 5 * 86400000, now - 1000);

    // Вызываем очистку
    const removedCount = cleanExpiredSessions(testDb, now);
    assert.equal(removedCount, 2, 'Должно быть удалено ровно 2 устаревшие сессии');

    // Проверяем, что активная сессия осталась в базе
    const activeCheck = testDb.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(activeTokenHash);
    assert.ok(activeCheck, 'Активная сессия не должна быть удалена');

    // Проверяем удаление устаревших
    assert.equal(testDb.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(expiredTokenHash), undefined);
    assert.equal(testDb.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(inactiveTokenHash), undefined);
  } finally {
    testDb.close();
  }
});

test('SEC-04: Атомарная и идемпотентная миграция старой таблицы sessions в новую схему', () => {
  // Создаем изолированную тестовую базу данных в памяти (не трогая рабочую БД)
  const testDb = new DatabaseSync(':memory:');

  try {
    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL
      );
      -- Старая схема таблицы sessions (v1): открытый токен, без last_activity_at
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    `);

    const now = Date.now();
    testDb.prepare('INSERT INTO users (id, username) VALUES (?, ?)').run('legacy_user_1', 'legacy_user');

    const legacyActiveToken = 'legacy_plaintext_secret_token_12345';
    const legacyExpiredToken = 'legacy_expired_secret_token_67890';

    // Вставляем активную сессию со старым токеном
    testDb.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      legacyActiveToken,
      'legacy_user_1',
      now - 1000,
      now + 7 * 86400000
    );

    // Вставляем истекшую сессию
    testDb.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
      legacyExpiredToken,
      'legacy_user_1',
      now - 10 * 86400000,
      now - 1000
    );

    // 1. Выполняем миграцию таблицы sessions
    migrateSessionsTable(testDb);

    // Проверяем, что структура таблицы обновилась
    const columns = testDb.prepare('PRAGMA table_info(sessions)').all();
    const colNames = new Set(columns.map((c) => c.name));
    assert.ok(colNames.has('token_hash'), 'Должна присутствовать колонка token_hash');
    assert.ok(colNames.has('last_activity_at'), 'Должна присутствовать колонка last_activity_at');
    assert.ok(!colNames.has('token'), 'Колонки открытого токена "token" быть не должно');

    // 2. Проверяем, что активная сессия мигрирована (токен захеширован SHA-256)
    const expectedHash = crypto.createHash('sha256').update(legacyActiveToken).digest('hex');
    const migratedRow = testDb.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(expectedHash);
    assert.ok(migratedRow, 'Активная сессия должна быть сохранена под своим SHA-256 хешем');
    assert.equal(migratedRow.user_id, 'legacy_user_1');
    assert.ok(migratedRow.last_activity_at > 0);

    // 3. Пользователь со старым токеном может сразу авторизоваться БЕЗ пересоздания токена
    const authenticatedUser = getUserByToken(legacyActiveToken, testDb, now);
    assert.ok(authenticatedUser, 'Пользователь должен аутентифицироваться по старым учетным данным');
    assert.equal(authenticatedUser.id, 'legacy_user_1');

    // 4. Проверяем, что истекшая сессия не перенесена
    const expiredHash = crypto.createHash('sha256').update(legacyExpiredToken).digest('hex');
    const expiredCheck = testDb.prepare('SELECT * FROM sessions WHERE token_hash = ?').get(expiredHash);
    assert.equal(expiredCheck, undefined, 'Истекшая сессия не должна попадать в новую таблицу');

    // 5. Идемпотентность: повторный вызов migrateSessionsTable не вызывает ошибок и не портит данные
    migrateSessionsTable(testDb);
    const idempotentUser = getUserByToken(legacyActiveToken, testDb, now);
    assert.ok(idempotentUser, 'Повторная миграция не должна повреждать существующие данные');
    assert.equal(idempotentUser.id, 'legacy_user_1');
  } finally {
    testDb.close();
  }
});

test('SEC-04: authMiddleware возвращает HTTP 401 для истекших, отсутствующих и отозванных токенов', async () => {
  const app = express();
  app.use(express.json());

  app.get('/api/test-protected', authMiddleware, (req, res) => {
    res.json({ success: true, userId: req.user.id });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = `test_usr_mw_${Date.now()}`;
  const now = Date.now();

  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `testuser_mw_${Date.now()}`,
    'dummyhash',
    'dummysalt',
    now
  );

  try {
    // 1. Запрос без заголовка Authorization -> 401
    const rNoAuth = await fetch(`${baseUrl}/api/test-protected`);
    assert.equal(rNoAuth.status, 401);
    const bNoAuth = await rNoAuth.json();
    assert.equal(bNoAuth.error, 'Требуется авторизация');

    // 2. Запрос с некорректным токеном -> 401
    const rInvalid = await fetch(`${baseUrl}/api/test-protected`, {
      headers: { Authorization: 'Bearer totally_invalid_token_1234567890' },
    });
    assert.equal(rInvalid.status, 401);
    const bInvalid = await rInvalid.json();
    assert.equal(bInvalid.error, 'Сессия недействительна или истекла');

    // 3. Запрос с валидным токеном -> 200
    const { token } = createSession(testUserId, 7);
    const rValid = await fetch(`${baseUrl}/api/test-protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(rValid.status, 200);
    const bValid = await rValid.json();
    assert.equal(bValid.success, true);
    assert.equal(bValid.userId, testUserId);

    // 4. После вызова deleteSession (логаут) -> 401
    deleteSession(token);
    const rAfterLogout = await fetch(`${baseUrl}/api/test-protected`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(rAfterLogout.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
    } catch {}
  }
});
