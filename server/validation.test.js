import './test_setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { db } from './db.js';
import { createSession } from './auth.js';
import {
  entrySchema,
  settingsSchema,
  registerSchema,
  importEntriesSchema,
  isValidDateString,
  MAX_IMPORT_ENTRIES,
  MAX_NOTES_LENGTH,
} from './validation.js';
import { app } from './index.js';

// --- ЮНИТ-ТЕСТЫ СХЕМ ВАЛИДАЦИИ (Zod) ---

test('SEC-05: isValidDateString отсекает некорректные и несуществующие календарные даты', () => {
  assert.equal(isValidDateString('2026-11-02'), true);
  assert.equal(isValidDateString('2024-02-29'), true); // Високосный год
  assert.equal(isValidDateString('2026-02-28'), true);

  // Несуществующие календарные даты
  assert.equal(isValidDateString('2026-02-29'), false, '2026 год невисокосный');
  assert.equal(isValidDateString('2026-02-30'), false, '30 февраля не существует');
  assert.equal(isValidDateString('2026-04-31'), false, 'В апреле только 30 дней');
  assert.equal(isValidDateString('2026-11-31'), false, 'В ноябре только 30 дней');
  assert.equal(isValidDateString('2026-13-01'), false, '13 месяца не существует');
  assert.equal(isValidDateString('bad-date'), false);
  assert.equal(isValidDateString(''), false);
  assert.equal(isValidDateString('1800-01-01'), false, 'Слишком старая дата');
});

test('SEC-05: entrySchema валидирует корректные данные и физиологические диапазоны', () => {
  const validEntry = {
    date: '2026-11-02',
    time: '14:30',
    glucose: 5.5,
    carbs: 48,
    xe: 4.0,
    rinFast: 4,
    tresiba: 14,
    calories: 450,
    notes: 'Обед: гречка с курицей',
    tag: 'lunch',
  };

  const parsed = entrySchema.safeParse(validEntry);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.glucose, 5.5);
    assert.equal(parsed.data.carbs, 48);
  }

  // Минимальная запись только с датой и временем
  const minimalEntry = { date: '2026-11-02', time: '08:00' };
  const minParsed = entrySchema.safeParse(minimalEntry);
  assert.equal(minParsed.success, true);
  if (minParsed.success) {
    assert.equal(minParsed.data.notes, '');
    assert.equal(minParsed.data.tag, 'other');
  }
});

test('SEC-05: entrySchema запрещает отрицательные значения, NaN, Infinity и абсурдные показатели', () => {
  // Отрицательные дозы инсулина
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', rinFast: -1 }).success,
    false,
    'Отрицательный болюс должен отклоняться'
  );
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', tresiba: -5 }).success,
    false,
    'Отрицательный базал должен отклоняться'
  );

  // Отрицательные углеводы, ХЕ и калории
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', carbs: -10 }).success,
    false,
    'Отрицательные углеводы должны отклоняться'
  );
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', xe: -2 }).success,
    false,
    'Отрицательные ХЕ должны отклоняться'
  );
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', calories: -100 }).success,
    false,
    'Отрицательные калории должны отклоняться'
  );

  // NaN и Infinity
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', glucose: NaN }).success,
    false,
    'NaN должен отклоняться'
  );
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', glucose: Infinity }).success,
    false,
    'Infinity должен отклоняться'
  );
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', carbs: -Infinity }).success,
    false,
    '-Infinity должен отклоняться'
  );

  // Вне физиологических границ (глюкоза < 0.1 или > 50.0)
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', glucose: 0 }).success,
    false,
    'Глюкоза 0 невозможна у живого пациента'
  );
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', glucose: 75.0 }).success,
    false,
    'Глюкоза 75 ммоль/л превышает физиологический максимум'
  );

  // Недопустимый тег
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', tag: 'malicious_tag' }).success,
    false,
    'Недопустимый тег должен отклоняться'
  );

  // Слишком длинная заметка (> 2000 знаков)
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', notes: 'a'.repeat(MAX_NOTES_LENGTH + 1) }).success,
    false,
    'Заметка более 2000 знаков должна отклоняться'
  );

  // Недопустимый формат ID
  assert.equal(
    entrySchema.safeParse({ date: '2026-11-02', time: '12:00', id: '<script>alert(1)</script>' }).success,
    false,
    'ID с XSS-символами должен отклоняться'
  );
});

test('SEC-05: settingsSchema проверяет клиническую согласованность порогов и отсекает лишние свойства', () => {
  const validSettings = {
    patientName: 'Иванов И.И.',
    diabetesType: '1',
    xeRatio: 12,
    hypoThreshold: 3.9,
    targetLow: 4.0,
    targetHigh: 9.9,
    severeHyperThreshold: 13.9,
    bolusName: 'РинФаст',
    basalName: 'Тресиба',
  };

  const parsed = settingsSchema.safeParse(validSettings);
  assert.equal(parsed.success, true);

  // Ошибка согласованности: hypoThreshold > targetLow
  const badHypo = { ...validSettings, hypoThreshold: 5.0, targetLow: 4.0 };
  assert.equal(settingsSchema.safeParse(badHypo).success, false);

  // Ошибка согласованности: targetLow >= targetHigh
  const badTarget = { ...validSettings, targetLow: 10.0, targetHigh: 9.9 };
  assert.equal(settingsSchema.safeParse(badTarget).success, false);

  // Ошибка согласованности: targetHigh > severeHyperThreshold
  const badSevere = { ...validSettings, targetHigh: 15.0, severeHyperThreshold: 13.9 };
  assert.equal(settingsSchema.safeParse(badSevere).success, false);

  // Недопустимый xeRatio (< 5 или > 30)
  assert.equal(settingsSchema.safeParse({ ...validSettings, xeRatio: 2 }).success, false);
  assert.equal(settingsSchema.safeParse({ ...validSettings, xeRatio: 50 }).success, false);

  // Удаление лишних/вредоносных полей (Prototype Pollution / Parameter Injection)
  const settingsWithInjected = {
    ...validSettings,
    admin: true,
    role: 'superuser',
    __proto__: { injected: true },
  };
  const parsedClean = settingsSchema.safeParse(settingsWithInjected);
  assert.equal(parsedClean.success, true);
  if (parsedClean.success) {
    assert.equal('admin' in parsedClean.data, false, 'Лишнее поле admin должно быть удалено');
    assert.equal('role' in parsedClean.data, false, 'Лишнее поле role должно быть удалено');
  }
});

test('SEC-05: registerSchema валидирует логин и правила сложности пароля', () => {
  // Валидная регистрация
  assert.equal(
    registerSchema.safeParse({
      username: 'patient_2026',
      password: 'safe passphrase with words',
      patientName: 'Тестовый Пациент',
    }).success,
    true
  );

  // Короткий логин
  assert.equal(
    registerSchema.safeParse({
      username: 'ab',
      password: 'safe passphrase with words',
    }).success,
    false
  );

  // Логин с недопустимыми символами
  assert.equal(
    registerSchema.safeParse({
      username: 'user@bad/name',
      password: 'safe passphrase with words',
    }).success,
    false
  );

  // Короткий пароль (< 12 знаков)
  assert.equal(
    registerSchema.safeParse({
      username: 'gooduser',
      password: 'short',
    }).success,
    false
  );

  // Пароль, содержащий логин
  assert.equal(
    registerSchema.safeParse({
      username: 'alexey123',
      password: 'my_alexey123_pass',
    }).success,
    false
  );
});

// --- ИНТЕГРАЦИОННЫЕ ТЕСТЫ API И ЭНДПОИНТОВ ---

test('SEC-05: API PUT /api/settings отклоняет несогласованные настройки (400) и очищает JSON', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const testUserId = `usr_test_set_${Date.now()}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    testUserId,
    `settings_user_${Date.now()}`,
    'hash',
    'salt',
    now
  );
  const { token } = createSession(testUserId, 1);

  try {
    // 1. Попытка сохранить несогласованные пороги (targetLow > targetHigh)
    const badRes = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        patientName: 'Test Patient',
        diabetesType: '1',
        xeRatio: 12,
        hypoThreshold: 3.9,
        targetLow: 11.0,
        targetHigh: 9.0, // Меньше, чем targetLow!
        severeHyperThreshold: 14.0,
      }),
    });
    assert.equal(badRes.status, 400, 'Сервер должен возвращать 400 при несогласованных настройках');
    const badJson = await badRes.json();
    assert.ok(badJson.error);

    // 2. Успешное сохранение валидных настроек с попыткой внедрения неизвестных полей
    const goodRes = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        patientName: 'Валидный Пациент',
        diabetesType: '1',
        xeRatio: 12,
        hypoThreshold: 3.9,
        targetLow: 4.0,
        targetHigh: 9.9,
        severeHyperThreshold: 13.9,
        unknownField: 'should be stripped',
        isAdmin: true,
      }),
    });
    assert.equal(goodRes.status, 200);
    const goodJson = await goodRes.json();
    assert.equal(goodJson.patientName, 'Валидный Пациент');
    assert.equal('unknownField' in goodJson, false, 'Неизвестные поля не должны возвращаться');
    assert.equal('isAdmin' in goodJson, false);

    // Проверяем, что в БД сохранился очищенный JSON
    const row = db.prepare('SELECT settings_json FROM settings WHERE user_id = ?').get(testUserId);
    const saved = JSON.parse(row.settings_json);
    assert.equal('unknownField' in saved, false);
    assert.equal('isAdmin' in saved, false);
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id = ?').run(testUserId);
  }
});

test('SEC-05: API POST /api/entries валидирует поля и предотвращает коллизии ID', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userA = `usr_test_a_${Date.now()}`;
  const userB = `usr_test_b_${Date.now()}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userA,
    `usera_${Date.now()}`,
    'h',
    's',
    now
  );
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userB,
    `userb_${Date.now()}`,
    'h',
    's',
    now
  );
  const tokenA = createSession(userA, 1).token;
  const tokenB = createSession(userB, 1).token;

  try {
    // 1. Ошибка валидации: отрицательные углеводы и неверный формат даты
    const invalidRes = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        date: '2026-02-30', // несуществующая дата
        time: '12:00',
        carbs: -15, // отрицательное
      }),
    });
    assert.equal(invalidRes.status, 400);

    // 2. Успешное создание записи Пользователем A с фиксированным ID
    const entryId = `entry-fixed-${Date.now()}`;
    const validRes = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        id: entryId,
        date: '2026-11-02',
        time: '13:00',
        glucose: 5.6,
        carbs: 30,
        notes: 'Тест',
      }),
    });
    assert.equal(validRes.status, 201);

    // 3. SEC-12: Пользователь B создает запись с ТЕМ ЖЕ ID (благодаря составному ключу коллизии исключены)
    const userBRes = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        id: entryId,
        date: '2026-11-02',
        time: '14:00',
        glucose: 7.0,
      }),
    });
    assert.equal(userBRes.status, 201, 'Пользователь B может иметь запись с тем же ID благодаря составному ключу (user_id, id)');

    // 4. Пользователь A пытается снова создать запись с тем же своим ID через POST
    const duplicateOwnRes = await fetch(`${baseUrl}/api/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        id: entryId,
        date: '2026-11-02',
        time: '15:00',
      }),
    });
    assert.equal(duplicateOwnRes.status, 409, 'Дублирующий собственный ID в POST должен возвращать 409 Conflict');
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
  }
});

test('SEC-05: API PUT/DELETE /api/entries/:id изолирует пользователей (404 без оракула 403/404), обрабатывает 404 и 400', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userA = `usr_iso_a_${Date.now()}`;
  const userB = `usr_iso_b_${Date.now()}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userA,
    `iso_a_${Date.now()}`,
    'h',
    's',
    now
  );
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userB,
    `iso_b_${Date.now()}`,
    'h',
    's',
    now
  );
  const tokenA = createSession(userA, 1).token;
  const tokenB = createSession(userB, 1).token;

  // Создаем запись пользователя A
  const entryId = `entry_a_${Date.now()}`;
  db.prepare(`
    INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entryId, userA, '2026-11-02', '10:00', 5.0, 20, now);

  try {
    // 1. Пользователь B пытается обновить чужую запись A -> 404 Not Found (без оракула 403)
    const updateAlienRes = await fetch(`${baseUrl}/api/entries/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        date: '2026-11-02',
        time: '10:00',
        glucose: 9.9,
      }),
    });
    assert.equal(updateAlienRes.status, 404, 'Обновление чужой записи должно возвращать 404 Not Found');

    // 2. Пользователь B пытается удалить чужую запись A -> 404 Not Found (без оракула 403)
    const deleteAlienRes = await fetch(`${baseUrl}/api/entries/${entryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(deleteAlienRes.status, 404, 'Удаление чужой записи должно возвращать 404 Not Found');

    // Запись A должна остаться нетронутой в базе
    const checkEntry = db.prepare('SELECT glucose FROM entries WHERE id = ?').get(entryId);
    assert.equal(checkEntry.glucose, 5.0);

    // 3. Обращение к несуществующей записи -> 404 Not Found
    const updateNonExist = await fetch(`${baseUrl}/api/entries/non-existent-id-12345`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ date: '2026-11-02', time: '10:00' }),
    });
    assert.equal(updateNonExist.status, 404, 'Несуществующая запись должна возвращать 404');

    const deleteNonExist = await fetch(`${baseUrl}/api/entries/non-existent-id-12345`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(deleteNonExist.status, 404);

    // 4. Некорректный ID (спецсимволы / инъекции) -> 400 Bad Request
    const badIdRes = await fetch(`${baseUrl}/api/entries/bad%20id%20with%20spaces`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(badIdRes.status, 400);

    // 5. Корректное обновление своей записи пользователем A -> 200 OK
    const updateOwnRes = await fetch(`${baseUrl}/api/entries/${entryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        date: '2026-11-02',
        time: '10:30',
        glucose: 5.8,
        carbs: 25,
      }),
    });
    assert.equal(updateOwnRes.status, 200);
    const updated = db.prepare('SELECT glucose, time FROM entries WHERE id = ?').get(entryId);
    assert.equal(updated.glucose, 5.8);
    assert.equal(updated.time, '10:30');

    // 6. Корректное удаление своей записи пользователем A -> 200 OK
    const deleteOwnRes = await fetch(`${baseUrl}/api/entries/${entryId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(deleteOwnRes.status, 200);
    assert.equal(db.prepare('SELECT id FROM entries WHERE id = ?').get(entryId), undefined);
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
  }
});

test('SEC-05: API DELETE /api/entries/day/:date валидирует дату (400)', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const user = `usr_del_day_${Date.now()}`;
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    user,
    `del_day_${Date.now()}`,
    'h',
    's',
    Date.now()
  );
  const token = createSession(user, 1).token;

  try {
    // Неверная календарная дата
    const badDateRes = await fetch(`${baseUrl}/api/entries/day/2026-02-31`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(badDateRes.status, 400);

    // Валидная дата
    const goodDateRes = await fetch(`${baseUrl}/api/entries/day/2026-11-02`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(goodDateRes.status, 200);
    const body = await goodDateRes.json();
    assert.equal(body.ok, true);
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id = ?').run(user);
  }
});

test('SEC-05: API POST /api/entries/import — лимит пакета (413), атомарность и защита от перезаписи чужих ID', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const userA = `usr_imp_a_${Date.now()}`;
  const userB = `usr_imp_b_${Date.now()}`;
  const now = Date.now();
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userA,
    `imp_a_${Date.now()}`,
    'h',
    's',
    now
  );
  db.prepare('INSERT INTO users (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)').run(
    userB,
    `imp_b_${Date.now()}`,
    'h',
    's',
    now
  );
  const tokenA = createSession(userA, 1).token;
  const tokenB = createSession(userB, 1).token;

  // Создаем существующую ценную запись пользователя A
  const originalEntryA = `entry_a_valuable_${Date.now()}`;
  db.prepare(`
    INSERT INTO entries (id, user_id, date, time, glucose, carbs, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(originalEntryA, userA, '2026-11-01', '08:00', 5.2, 30, now);

  try {
    // 1. Превышение лимита пакета (> MAX_IMPORT_ENTRIES = 2000) -> HTTP 413 Payload Too Large
    const oversizedBatch = Array.from({ length: 2001 }, (_, i) => ({
      date: '2026-11-02',
      time: '12:00',
      glucose: 5.5,
    }));
    const oversizedRes = await fetch(`${baseUrl}/api/entries/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ entries: oversizedBatch }),
    });
    assert.equal(oversizedRes.status, 413, 'Пакет > 2000 записей должен возвращать 413 Payload Too Large');

    // 2. АТОМАРНОСТЬ: Если в пакете есть хотя бы одна ошибочная запись при replaceAll: true,
    // база данных не должна модифицироваться (ни удаление старых, ни сохранение части новых)
    const mixedBatch = [
      { date: '2026-11-02', time: '09:00', glucose: 6.0 }, // валидная
      { date: '2026-02-30', time: '10:00', glucose: 7.0 }, // НЕВАЛИДНАЯ (30 февраля)
    ];

    const atomicFailRes = await fetch(`${baseUrl}/api/entries/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ entries: mixedBatch, replaceAll: true }),
    });
    assert.equal(atomicFailRes.status, 400, 'Пакет с невалидной записью должен отклоняться с 400');

    // Проверяем: старая запись пользователя A НЕ была удалена!
    const checkOriginal = db.prepare('SELECT id FROM entries WHERE id = ?').get(originalEntryA);
    assert.ok(checkOriginal, 'Исходная запись пользователя НЕ должна удаляться при ошибке в пакете');

    // Проверяем: валидная запись из пакета НЕ была сохранена частично
    const checkPartial = db.prepare('SELECT id FROM entries WHERE user_id = ? AND time = ?').get(userA, '09:00');
    assert.equal(checkPartial, undefined, 'Частичное сохранение не должно происходить');

    // 3. ЗАЩИТА ОТ ПЕРЕЗАПИСИ ЧУЖИХ ID:
    // Пользователь B пытается импортировать запись с ID, принадлежащим пользователю A
    const maliciousBatch = [
      {
        id: originalEntryA, // чужой ID
        date: '2026-11-02',
        time: '11:00',
        glucose: 18.0,
        notes: 'Атака подменой ID',
      },
    ];

    const importAlienIdRes = await fetch(`${baseUrl}/api/entries/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ entries: maliciousBatch, replaceAll: false }),
    });
    assert.equal(importAlienIdRes.status, 200);

    // Запись пользователя A НЕ была перезаписана!
    const verifyVictimEntry = db.prepare('SELECT user_id, glucose, notes FROM entries WHERE id = ?').get(originalEntryA);
    assert.equal(verifyVictimEntry.user_id, userA, 'Запись должна по-прежнему принадлежать пользователю A');
    assert.equal(verifyVictimEntry.glucose, 5.2, 'Показатели пользователя A не должны изменяться злоумышленником');

    // Пользователю B была создана новая безопасная запись с другим сгенерированным ID
    const userBEntries = db.prepare('SELECT id, glucose, notes FROM entries WHERE user_id = ?').all(userB);
    assert.equal(userBEntries.length, 1);
    assert.notEqual(userBEntries[0].id, originalEntryA, 'Для B должен быть сгенерирован новый безопасный ID');
    assert.equal(userBEntries[0].glucose, 18.0);
  } finally {
    server.close();
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
  }
});
