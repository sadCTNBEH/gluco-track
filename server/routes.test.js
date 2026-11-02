import './test_setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from './index.js';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

test('Integration: Модульная архитектура маршрутов, аутентификация, CRUD, изоляция и SPA', async (t) => {
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
  });

  // Вспомогательная функция для запросов
  async function apiRequest(endpoint, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${endpoint}`, {
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
    return { status: res.status, headers: res.headers, data };
  }

  // 1. Healthcheck
  await t.test('GET /api/health — доступность сервера', async () => {
    const res = await apiRequest('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.data.status, 'ok');
    assert.ok(res.data.timestamp);
  });

  // 2. Регистрация, вход, выход и проверка сессии (/api/auth)
  let userAToken = '';
  let userAId = '';
  let userBToken = '';
  let userBId = '';

  await t.test('POST /api/auth/register — успешная регистрация и создание настроек', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'alice_patient',
        password: 'ValidPassword123!',
        patientName: 'Алиса Тестовая',
      },
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.token);
    assert.equal(res.data.user.username, 'alice_patient');
    assert.ok(res.data.user.id.startsWith('usr_'));
    userAToken = res.data.token;
    userAId = res.data.user.id;

    // Проверяем, что в SQLite создались настройки по умолчанию
    const settingsRow = db.prepare('SELECT settings_json FROM settings WHERE user_id = ?').get(userAId);
    assert.ok(settingsRow);
    const parsed = JSON.parse(settingsRow.settings_json);
    assert.equal(parsed.patientName, 'Алиса Тестовая');
  });

  await t.test('POST /api/auth/register — отказ при дубликате логина (409 Conflict)', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'alice_patient',
        password: 'AnotherPassword123!',
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.error, 'Пользователь с таким логином уже существует');
  });

  await t.test('POST /api/auth/login — успешный вход и неверный пароль', async () => {
    // Неверный пароль
    const badRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: 'alice_patient', password: 'WrongPassword999!' },
    });
    assert.equal(badRes.status, 401);

    // Успешный вход
    const okRes = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: 'alice_patient', password: 'ValidPassword123!' },
    });
    assert.equal(okRes.status, 200);
    assert.ok(okRes.data.token);
    assert.equal(okRes.data.user.id, userAId);
  });

  await t.test('GET /api/auth/me и POST /api/auth/logout', async () => {
    // Без токена
    const unauth = await apiRequest('/api/auth/me');
    assert.equal(unauth.status, 401);

    // С токеном
    const meRes = await apiRequest('/api/auth/me', { token: userAToken });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.id, userAId);

    // Выход
    const logoutRes = await apiRequest('/api/auth/logout', { method: 'POST', token: userAToken });
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.data.ok, true);

    // Повторный me с отозванным токеном возвращает 401
    const revoked = await apiRequest('/api/auth/me', { token: userAToken });
    assert.equal(revoked.status, 401);

    // Вновь авторизуемся для дальнейших тестов
    const login = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { username: 'alice_patient', password: 'ValidPassword123!' },
    });
    userAToken = login.data.token;
  });

  // Регистрируем Пользователя B для проверки изоляции
  await t.test('Регистрация Пользователя B', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: 'bob_patient',
        password: 'ValidPassword456!',
        patientName: 'Боб Тестовый',
      },
    });
    assert.equal(res.status, 201);
    userBToken = res.data.token;
    userBId = res.data.user.id;
  });

  // 3. Настройки (/api/settings)
  await t.test('GET и PUT /api/settings — загрузка, валидация и обновление', async () => {
    // Получение настроек
    const getRes = await apiRequest('/api/settings', { token: userAToken });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.patientName, 'Алиса Тестовая');

    // Невалидные настройки (targetLow >= targetHigh)
    const badPut = await apiRequest('/api/settings', {
      method: 'PUT',
      token: userAToken,
      body: { ...getRes.data, targetLow: 10.0, targetHigh: 4.0 },
    });
    assert.equal(badPut.status, 400);

    // Успешное обновление
    const okPut = await apiRequest('/api/settings', {
      method: 'PUT',
      token: userAToken,
      body: { ...getRes.data, targetLow: 4.2, targetHigh: 9.5, xeRatio: 11 },
    });
    assert.equal(okPut.status, 200);
    assert.equal(okPut.data.targetLow, 4.2);
    assert.equal(okPut.data.xeRatio, 11);

    // Изоляция: Пользователь B не видит измененных настроек Пользователя A
    const bSettings = await apiRequest('/api/settings', { token: userBToken });
    assert.equal(bSettings.data.patientName, 'Боб Тестовый');
    assert.equal(bSettings.data.targetLow, 4.0);
  });

  // 4. CRUD записей дневника (/api/entries) и изоляция пользователей
  let entryAId = '';

  await t.test('POST /api/entries — создание записи и проверка коллизий ID', async () => {
    const res = await apiRequest('/api/entries', {
      method: 'POST',
      token: userAToken,
      body: {
        id: 'entry-a-custom-id',
        date: '2026-11-02',
        time: '08:30',
        glucose: 5.6,
        carbs: 48,
        xe: 4.0,
        rinFast: 5,
        tresiba: null,
        calories: 320,
        notes: 'Завтрак Алисы',
        tag: 'breakfast',
      },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.id, 'entry-a-custom-id');
    entryAId = res.data.id;

    // Повторное создание с тем же ID у Пользователя A возвращает 409 Conflict
    const dupRes = await apiRequest('/api/entries', {
      method: 'POST',
      token: userAToken,
      body: {
        id: 'entry-a-custom-id',
        date: '2026-11-02',
        time: '12:00',
        glucose: 6.0,
      },
    });
    assert.equal(dupRes.status, 409);

    // Но Пользователь B может создать запись с ТАКИМ ЖЕ ID (благодаря составному ключу (user_id, id))
    const bRes = await apiRequest('/api/entries', {
      method: 'POST',
      token: userBToken,
      body: {
        id: 'entry-a-custom-id',
        date: '2026-11-02',
        time: '09:00',
        glucose: 7.2,
      },
    });
    assert.equal(bRes.status, 201);
  });

  await t.test('GET /api/entries — изоляция записей пользователей', async () => {
    const aEntries = await apiRequest('/api/entries', { token: userAToken });
    assert.equal(aEntries.status, 200);
    assert.equal(aEntries.data.length, 1);
    assert.equal(aEntries.data[0].notes, 'Завтрак Алисы');

    const bEntries = await apiRequest('/api/entries', { token: userBToken });
    assert.equal(bEntries.status, 200);
    assert.equal(bEntries.data.length, 1);
    assert.equal(bEntries.data[0].glucose, 7.2);
  });

  await t.test('PUT и DELETE /api/entries/:id — защита от BOLA / IDOR (404 без оракула 403/404)', async () => {
    // Пользователь A создает вторую запись
    const resA2 = await apiRequest('/api/entries', {
      method: 'POST',
      token: userAToken,
      body: {
        date: '2026-11-02',
        time: '14:00',
        glucose: 6.8,
        notes: 'Обед Алисы',
      },
    });
    assert.equal(resA2.status, 201);
    const a2Id = resA2.data.id;

    // Пользователь B пытается изменить чужую запись a2Id -> 404 Not Found (без оракула 403)
    const attackPut = await apiRequest(`/api/entries/${a2Id}`, {
      method: 'PUT',
      token: userBToken,
      body: {
        date: '2026-11-02',
        time: '14:00',
        glucose: 9.9,
        notes: 'Взлом Боба',
      },
    });
    assert.equal(attackPut.status, 404);

    // Пользователь B пытается удалить чужую запись a2Id -> 404 Not Found (без оракула 403)
    const attackDel = await apiRequest(`/api/entries/${a2Id}`, {
      method: 'DELETE',
      token: userBToken,
    });
    assert.equal(attackDel.status, 404);

    // Запись осталась нетронутой у Алисы
    const aCheck = await apiRequest('/api/entries', { token: userAToken });
    const target = aCheck.data.find((e) => e.id === a2Id);
    assert.ok(target);
    assert.equal(target.notes, 'Обед Алисы');

    // Пользователь A может успешно обновить свою запись
    const okPut = await apiRequest(`/api/entries/${a2Id}`, {
      method: 'PUT',
      token: userAToken,
      body: {
        date: '2026-11-02',
        time: '14:00',
        glucose: 6.5,
        notes: 'Обед Алисы (обновлено)',
      },
    });
    assert.equal(okPut.status, 200);
    assert.equal(okPut.data.glucose, 6.5);

    // Пользователь A может успешно удалить свою запись
    const okDel = await apiRequest(`/api/entries/${a2Id}`, {
      method: 'DELETE',
      token: userAToken,
    });
    assert.equal(okDel.status, 200);
    assert.equal(okDel.data.ok, true);
  });

  await t.test('DELETE /api/entries/day/:date — валидация даты и удаление дня', async () => {
    // Неверная дата
    const badDate = await apiRequest('/api/entries/day/2026-02-31', {
      method: 'DELETE',
      token: userAToken,
    });
    assert.equal(badDate.status, 400);

    // Удаление дня
    const delDay = await apiRequest('/api/entries/day/2026-11-02', {
      method: 'DELETE',
      token: userAToken,
    });
    assert.equal(delDay.status, 200);
    assert.equal(delDay.data.deletedCount, 1);

    // Дневник Алисы теперь пуст, а дневник Боба не пострадал
    const aEntries = await apiRequest('/api/entries', { token: userAToken });
    assert.equal(aEntries.data.length, 0);

    const bEntries = await apiRequest('/api/entries', { token: userBToken });
    assert.equal(bEntries.data.length, 1);
  });

  // 5. Пакетный импорт (/api/entries/import), дедупликация и откат транзакций
  await t.test('POST /api/entries/import — лимит размера (413) и откат при ошибке', async () => {
    // Лимит пакета > 2000
    const hugeBatch = Array.from({ length: 2001 }, (_, i) => ({
      date: '2026-11-02',
      time: '12:00',
      glucose: 5.0,
    }));
    const hugeRes = await apiRequest('/api/entries/import', {
      method: 'POST',
      token: userAToken,
      body: { entries: hugeBatch },
    });
    assert.equal(hugeRes.status, 413);

    // Ошибка валидации структуры (одна запись с невалидной датой 2026-02-31)
    const invalidBatch = [
      { date: '2026-11-01', time: '10:00', glucose: 5.5 },
      { date: '2026-02-31', time: '12:00', glucose: 6.0 }, // ошибка
    ];
    const invalidRes = await apiRequest('/api/entries/import', {
      method: 'POST',
      token: userAToken,
      body: { entries: invalidBatch },
    });
    assert.equal(invalidRes.status, 400);

    // Проверяем, что первая запись не была вставлена (полный откат транзакции)
    const aEntries = await apiRequest('/api/entries', { token: userAToken });
    assert.equal(aEntries.data.length, 0);
  });

  await t.test('POST /api/entries/import — успешный импорт и автоматическая дедупликация', async () => {
    const importPayload = [
      { id: 'imp-1', date: '2026-11-02', time: '08:00', glucose: 5.4, rinFast: 4 },
      { id: 'imp-2', date: '2026-11-02', time: '08:00', glucose: 5.4, carbs: 36, notes: 'Завтрак' }, // дубликат по времени и сахару
      { id: 'imp-3', date: '2026-11-02', time: '13:00', glucose: 6.8, carbs: 48, rinFast: 5 },
    ];

    const res = await apiRequest('/api/entries/import', {
      method: 'POST',
      token: userAToken,
      body: { entries: importPayload },
    });
    assert.equal(res.status, 200);

    const aEntries = await apiRequest('/api/entries', { token: userAToken });
    // Из 3 записей (2 из которых дубликаты) должно получиться ровно 2 объединенные записи
    assert.equal(aEntries.data.length, 2);

    const merged = aEntries.data.find((e) => e.time === '08:00');
    assert.ok(merged);
    assert.equal(merged.glucose, 5.4);
    assert.equal(merged.rinFast, 4);
    assert.equal(merged.carbs, 36);
    assert.equal(merged.notes, 'Завтрак');
  });

  await t.test('POST /api/entries/deduplicate — явный вызов дедупликации', async () => {
    const dedupRes = await apiRequest('/api/entries/deduplicate', {
      method: 'POST',
      token: userAToken,
    });
    assert.equal(dedupRes.status, 200);
    assert.equal(dedupRes.data.ok, true);
    assert.equal(dedupRes.data.removedCount, 0, 'Повторный вызов идемпотентен (0 удалений)');
  });

  // 6. Централизованный обработчик ошибок (Malformed JSON)
  await t.test('Middleware: errorHandler перехватывает поврежденный JSON (400 Bad Request)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"username": "broken_json, invalid}',
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, 'Некорректный JSON в теле запроса');
  });

  // 7. Раздача статических файлов и SPA fallback
  await t.test('SPA Fallback — возвращает index.html для не-API маршрутов', async () => {
    if (fs.existsSync(DIST_DIR)) {
      const res = await fetch(`${baseUrl}/dashboard`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/html'));
      const text = await res.text();
      assert.ok(text.includes('<html') || text.includes('<!DOCTYPE html>'));
    }
  });
});
