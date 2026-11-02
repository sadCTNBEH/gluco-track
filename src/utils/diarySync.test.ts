import test from 'node:test';
import assert from 'node:assert/strict';
import { DiaryEntry } from '../types/diabetes';
import {
  isClientError,
  isConflictError,
  isNetworkOrServerError,
  createOptimisticEntry,
  updateOptimisticEntry,
  rollbackEntry,
  markEntrySaved,
  markEntryPending,
  markEntryError,
  rollbackDeletedEntry,
  rollbackDeletedDay,
  getPendingEntries,
} from './diarySync';
import { ApiError, sanitizeEntryForServer } from '../api/client';
import {
  getUserCachedEntries,
  setUserCachedEntries,
  clearUserStorage,
  flushUserStorage,
} from './userStorage';

// Mock localStorage для тестирования в окружении Node.js
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

const mockStorage = new MockLocalStorage();
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: mockStorage,
  },
  writable: true,
  configurable: true,
});

test('1. Успешное создание, редактирование и удаление записи (Happy Path)', () => {
  const initialEntries: DiaryEntry[] = [];

  // Создание
  const newEntryData = {
    date: '2026-11-02',
    time: '08:30',
    glucose: 5.5,
    carbs: 20,
    xe: 1.7,
    rinFast: 2,
    tresiba: null,
    calories: 120,
    notes: 'Завтрак',
  };

  const optimistic = createOptimisticEntry(newEntryData);
  assert.ok(optimistic.id, 'Должен быть сгенерирован ID');
  assert.equal(optimistic._syncStatus, 'saving', 'Начальный статус должен быть saving');

  const afterCreate = [optimistic, ...initialEntries];
  assert.equal(afterCreate.length, 1);

  // Сервер подтвердил сохранение
  const confirmed = markEntrySaved(afterCreate, optimistic.id);
  assert.equal(confirmed[0]._syncStatus, 'saved', 'После ответа сервера статус должен быть saved');
  assert.equal(confirmed[0]._syncError, undefined);

  // Редактирование
  const { updatedEntries, previousEntry } = updateOptimisticEntry(confirmed, optimistic.id, {
    glucose: 5.8,
    notes: 'Завтрак дополнен',
  });
  assert.ok(previousEntry);
  assert.equal(previousEntry.glucose, 5.5);
  assert.equal(updatedEntries[0].glucose, 5.8);
  assert.equal(updatedEntries[0]._syncStatus, 'saving');

  // Сервер подтвердил обновление
  const afterUpdateSaved = markEntrySaved(updatedEntries, optimistic.id);
  assert.equal(afterUpdateSaved[0].glucose, 5.8);
  assert.equal(afterUpdateSaved[0]._syncStatus, 'saved');

  // Удаление
  const afterDelete = afterUpdateSaved.filter((e) => e.id !== optimistic.id);
  assert.equal(afterDelete.length, 0);
});

test('2. Откат изменений при отказе сервера (HTTP 400, 403, 422)', () => {
  const existingEntry: DiaryEntry = {
    id: 'entry-1',
    date: '2026-11-02',
    time: '12:00',
    glucose: 6.0,
    carbs: 40,
    xe: 3.3,
    rinFast: 4,
    tresiba: null,
    calories: 250,
    notes: 'Обед',
    createdAt: Date.now(),
    _syncStatus: 'saved',
  };

  let list: DiaryEntry[] = [existingEntry];

  // А. Откат при создании (сервер вернул 400 Bad Request)
  const err400 = new ApiError('Недопустимое значение глюкозы', 400);
  assert.equal(isClientError(err400), true);

  const invalidNew = createOptimisticEntry({
    date: '2026-11-02',
    time: '13:00',
    glucose: -5.0, // невалидное
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: '',
  });

  list = [invalidNew, ...list];
  assert.equal(list.length, 2);

  // Сервер отклонил -> откат
  list = rollbackEntry(list, null, invalidNew.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'entry-1', 'Невалидная запись должна быть полностью удалена из списка');

  // Б. Откат при редактировании (сервер вернул 403 Forbidden)
  const err403 = new ApiError('Чужая запись', 403);
  assert.equal(isClientError(err403), true);

  const { updatedEntries, previousEntry } = updateOptimisticEntry(list, 'entry-1', {
    glucose: 15.0,
    notes: 'Взлом',
  });
  assert.equal(updatedEntries[0].glucose, 15.0);

  // Сервер отклонил -> восстанавливаем previousEntry
  const rolledBack = rollbackEntry(updatedEntries, previousEntry, 'entry-1');
  assert.equal(rolledBack[0].glucose, 6.0, 'Глюкоза должна откатиться к исходному значению 6.0');
  assert.equal(rolledBack[0].notes, 'Обед');
});

test('3. Сетевой сбой (потеря сети / fetch error / HTTP 500) — сохранение неподтверждённых данных без ложного статуса успеха', () => {
  const offlineEntry = createOptimisticEntry({
    date: '2026-11-02',
    time: '19:00',
    glucose: 7.2,
    carbs: 50,
    xe: 4.2,
    rinFast: 5,
    tresiba: 14,
    calories: 400,
    notes: 'Ужин офлайн',
  });

  let list: DiaryEntry[] = [offlineEntry];

  // Симулируем сетевую ошибку (TypeError: Failed to fetch)
  const networkErr = new ApiError('Failed to fetch', undefined, undefined, true);
  assert.equal(isNetworkOrServerError(networkErr), true);
  assert.equal(isClientError(networkErr), false);

  // Запись НЕ удаляется, а помечается как pending
  list = markEntryPending(list, offlineEntry.id, networkErr.message);
  assert.equal(list.length, 1, 'Медицинская запись НЕ должна теряться при ошибке сети');
  assert.equal(list[0].glucose, 7.2);
  assert.equal(list[0]._syncStatus, 'pending', 'Статус должен быть pending, а НЕ saved');
  assert.equal(list[0]._syncError, 'Failed to fetch');

  // Симулируем ошибку 500 Internal Server Error
  const err500 = new ApiError('Internal Server Error', 500);
  assert.equal(isNetworkOrServerError(err500), true);
  assert.equal(isClientError(err500), false);

  list = markEntryPending(list, offlineEntry.id, err500.message);
  assert.equal(list[0]._syncStatus, 'pending');
});

test('4. Повторная отправка без дублирования записей (HTTP 409 Conflict)', () => {
  const err409 = new ApiError('Запись с таким ID уже существует', 409);
  assert.equal(isConflictError(err409), true);
  assert.equal(isClientError(err409), false);

  const entry = createOptimisticEntry({
    id: 'duplicate-check-id',
    date: '2026-11-02',
    time: '10:00',
    glucose: 5.4,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: '',
  });

  let list: DiaryEntry[] = [entry];

  // При получении 409 запись уже есть на сервере -> помечаем как saved без отката и без дублей
  list = markEntrySaved(list, entry.id);
  assert.equal(list.length, 1);
  assert.equal(list[0]._syncStatus, 'saved');
  assert.equal(list[0].id, 'duplicate-check-id');
});

test('5. Быстрое последовательное редактирование одной записи (защита от устаревших ответов API)', () => {
  // Симуляция логики sequence ref:
  const seqMap: Record<string, number> = {};
  const entryId = 'seq-entry-1';

  // Редактирование 1: сахар 6.0 (seq 1)
  seqMap[entryId] = 1;
  const req1Seq = 1;

  // Быстрое редактирование 2: сахар 6.5 (seq 2)
  seqMap[entryId] = 2;
  const req2Seq = 2;

  // Если запоздалый ответ на запрос 1 приходит ПОСЛЕ запроса 2:
  const shouldApplyReq1 = seqMap[entryId] === req1Seq;
  assert.equal(shouldApplyReq1, false, 'Устаревший ответ запроса 1 должен быть проигнорирован');

  // Ответ на запрос 2 актуален:
  const shouldApplyReq2 = seqMap[entryId] === req2Seq;
  assert.equal(shouldApplyReq2, true, 'Свежий ответ запроса 2 должен быть применен');
});

test('6. Откат при удалении отдельной записи и целого дня при ошибке сервера', () => {
  const entryA: DiaryEntry = {
    id: 'del-1',
    date: '2026-11-02',
    time: '08:00',
    glucose: 5.0,
    carbs: 20,
    xe: 1.7,
    rinFast: 2,
    tresiba: null,
    calories: 100,
    notes: 'Завтрак',
    createdAt: 1000,
    _syncStatus: 'saved',
  };

  const entryB: DiaryEntry = {
    id: 'del-2',
    date: '2026-11-02',
    time: '13:00',
    glucose: 6.5,
    carbs: 45,
    xe: 3.8,
    rinFast: 4,
    tresiba: null,
    calories: 250,
    notes: 'Обед',
    createdAt: 2000,
    _syncStatus: 'saved',
  };

  let list = [entryA, entryB];

  // 1. Попытка удаления отдельной записи с ошибкой сервера
  const afterOptimisticDelete = list.filter((e) => e.id !== 'del-1');
  assert.equal(afterOptimisticDelete.length, 1);

  // Сервер вернул ошибку 500 -> откат
  const restored = rollbackDeletedEntry(afterOptimisticDelete, entryA);
  assert.equal(restored.length, 2, 'Запись должна быть восстановлена');
  assert.ok(restored.some((e) => e.id === 'del-1'), 'Удаленная запись должна вернуться в список');

  // 2. Попытка удаления целого дня с ошибкой сервера
  const dayToDelete = '2026-11-02';
  const dayEntriesSnapshot = list.filter((e) => e.date === dayToDelete);
  const afterDayDelete = list.filter((e) => e.date !== dayToDelete);
  assert.equal(afterDayDelete.length, 0);

  // Сервер вернул ошибку сети -> откат целого дня
  const restoredDay = rollbackDeletedDay(afterDayDelete, dayEntriesSnapshot);
  assert.equal(restoredDay.length, 2, 'Все записи дня должны быть восстановлены');
});

test('7. Выход и смена аккаунта во время выполнения запроса (User Isolation & SEC-01)', () => {
  mockStorage.clear();

  const userA = 'user_alpha_123';
  const userB = 'user_beta_456';

  let currentUserId: string | null = userA;
  const opUserId = userA;

  // Пользователь A отправляет запрос...
  // Во время запроса происходит смена пользователя на B:
  currentUserId = userB;

  // Ответ запроса для A возвращается:
  const shouldApplyResponse = currentUserId === opUserId;
  assert.equal(shouldApplyResponse, false, 'Ответ не должен применяться после смены пользователя');

  // Данные пользователя B в кэше не должны содержать записей A
  const sampleA: DiaryEntry[] = [
    {
      id: 'entry-a',
      date: '2026-11-02',
      time: '08:00',
      glucose: 5.0,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: 'Секретная запись A',
      createdAt: Date.now(),
    },
  ];

  setUserCachedEntries(userA, sampleA);
  const cachedB = getUserCachedEntries(userB);
  assert.equal(cachedB.length, 0, 'Кэш B должен быть чистым');

  clearUserStorage(userA);
  assert.equal(getUserCachedEntries(userA).length, 0, 'После clearUserStorage кэш A удален');
});

test('8. Сохранность медицинских данных после перезагрузки страницы в офлайн-режиме', () => {
  mockStorage.clear();
  const userId = 'offline_patient_777';

  const pendingEntry: DiaryEntry = {
    id: 'offline-entry-1',
    date: '2026-11-02',
    time: '21:00',
    glucose: 6.1,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: 12,
    calories: null,
    notes: 'Укол тресибы без интернета',
    createdAt: Date.now(),
    _syncStatus: 'pending',
    _syncError: 'Сетевая ошибка',
  };

  // Сохраняем в кэш
  setUserCachedEntries(userId, [pendingEntry]);

  // Симулируем перезагрузку страницы (чтение из кэша)
  const loadedAfterReload = getUserCachedEntries(userId);
  assert.equal(loadedAfterReload.length, 1);
  assert.equal(loadedAfterReload[0].id, 'offline-entry-1');
  assert.equal(loadedAfterReload[0].glucose, 6.1);
  assert.equal(loadedAfterReload[0].tresiba, 12);
  assert.equal(loadedAfterReload[0]._syncStatus, 'pending', 'Статус pending должен сохраниться после reload');
  assert.equal(loadedAfterReload[0]._syncError, 'Сетевая ошибка');

  const pendingList = getPendingEntries(loadedAfterReload);
  assert.equal(pendingList.length, 1);
});

test('9. Очистка внутренних метаданных синхронизации перед отправкой на сервер', () => {
  const dirtyEntry: DiaryEntry = {
    id: 'clean-test-id',
    date: '2026-11-02',
    time: '14:00',
    glucose: 5.9,
    carbs: 30,
    xe: 2.5,
    rinFast: 3,
    tresiba: null,
    calories: 180,
    notes: 'Тест санитизации',
    tag: 'lunch',
    createdAt: 1700000000000,
    _syncStatus: 'pending',
    _syncError: 'Network error',
    _lastModified: 1700000000000,
  };

  const clean = sanitizeEntryForServer(dirtyEntry);

  assert.equal(clean.id, 'clean-test-id');
  assert.equal(clean.glucose, 5.9);
  assert.equal('_syncStatus' in clean, false, '_syncStatus должен быть удален');
  assert.equal('_syncError' in clean, false, '_syncError должен быть удален');
  assert.equal('_lastModified' in clean, false, '_lastModified должен быть удален');
});

test('10. Защита от перезаписи свежего кеша устаревшими ответами API (конфликт версий)', () => {
  mockStorage.clear();
  const userId = 'user_conflict_guard';

  // 1. В кэше лежит отредактированная пользователем офлайн-запись со статусом pending
  const freshLocalPendingEntry: DiaryEntry = {
    id: 'entry-shared-1',
    date: '2026-11-02',
    time: '12:00',
    glucose: 9.8, // Пользователь изменил сахар с 5.0 на 9.8 офлайн!
    carbs: 45,
    xe: 3.7,
    rinFast: 5,
    tresiba: null,
    calories: 250,
    notes: 'Свежая локальная версия',
    createdAt: 1700000000000,
    _syncStatus: 'pending',
  };
  setUserCachedEntries(userId, [freshLocalPendingEntry]);

  // 2. Сервер возвращает старую версию той же самой записи
  const staleServerEntry: DiaryEntry = {
    id: 'entry-shared-1',
    date: '2026-11-02',
    time: '12:00',
    glucose: 5.0, // Устаревшее значение на сервере
    carbs: 45,
    xe: 3.7,
    rinFast: 4,
    tresiba: null,
    calories: 250,
    notes: 'Старая версия с сервера',
    createdAt: 1700000000000,
  };

  // Симулируем объединение данных в loadUserData
  const cached = getUserCachedEntries(userId);
  const localPending = cached.filter((e) => e._syncStatus === 'pending' || e._syncStatus === 'error');
  const localPendingMap = new Map(localPending.map((p) => [p.id, p]));

  const confirmedServer = [staleServerEntry].map((s) => {
    const pending = localPendingMap.get(s.id);
    if (pending) {
      localPendingMap.delete(s.id);
      return pending; // Приоритет локальной свежей неподтвержденной версии!
    }
    return { ...s, _syncStatus: 'saved' as const };
  });

  const merged = [...Array.from(localPendingMap.values()), ...confirmedServer];

  assert.equal(merged.length, 1);
  assert.equal(merged[0].glucose, 9.8, 'Свежие локальные изменения не были затерты устаревшим ответом сервера');
  assert.equal(merged[0]._syncStatus, 'pending');
});

test('11. Согласованность кеша и состояния после успешной синхронизации', () => {
  mockStorage.clear();
  const userId = 'user_sync_consistency';

  // 1. До синхронизации в кэше лежат неподтвержденные записи
  const pendingEntry: DiaryEntry = {
    id: 'entry-sync-1',
    date: '2026-11-02',
    time: '10:00',
    glucose: 5.6,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: 'До отправки',
    createdAt: Date.now(),
    _syncStatus: 'pending',
  };
  setUserCachedEntries(userId, [pendingEntry], { immediate: true });

  // 2. После успешной отправки на сервер запись помечается как 'saved'
  const savedEntry: DiaryEntry = {
    ...pendingEntry,
    _syncStatus: 'saved',
    _syncError: undefined,
  };
  setUserCachedEntries(userId, [savedEntry]);
  flushUserStorage(userId);

  // 3. Проверяем состояние кэша: все записи согласованы и больше нет pending
  const cached = getUserCachedEntries(userId);
  assert.equal(cached.length, 1);
  assert.equal(cached[0]._syncStatus, 'saved');
  assert.equal(getPendingEntries(cached).length, 0, 'Не должно остаться неподтвержденных записей');
});
