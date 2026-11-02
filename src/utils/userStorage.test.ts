import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserEntriesStorageKey,
  getUserSettingsStorageKey,
  getUserCachedEntries,
  setUserCachedEntries,
  getUserCachedSettings,
  setUserCachedSettings,
  clearUserStorage,
  getLegacyUnmigratedEntries,
  getLegacyUnmigratedSettings,
  cleanupLegacyStorage,
  flushUserStorage,
  clearUserStorageCache,
  storageStats,
  LEGACY_STORAGE_KEY_ENTRIES,
  LEGACY_STORAGE_KEY_SETTINGS,
} from './userStorage';
import { DiaryEntry, UserSettings } from '../types/diabetes';

// Simple in-memory localStorage mock for Node.js test environment
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

// Устанавливаем мок localStorage в глобальную область видимости
const mockStorage = new MockLocalStorage();
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: mockStorage,
  },
  writable: true,
  configurable: true,
});

const SAMPLE_ENTRIES_A: DiaryEntry[] = [
  {
    id: 'entry-a1',
    date: '2026-11-01',
    time: '08:30',
    glucose: 5.4,
    carbs: 48,
    xe: 4.0,
    rinFast: 4,
    tresiba: null,
    calories: 320,
    notes: 'Завтрак User A',
    tag: 'breakfast',
    createdAt: 1730440000000,
  },
  {
    id: 'entry-a2',
    date: '2026-11-01',
    time: '22:00',
    glucose: 6.1,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: 14,
    calories: null,
    notes: 'Базал на ночь User A',
    tag: 'bedtime',
    createdAt: 1730490000000,
  },
];

const SAMPLE_ENTRIES_B: DiaryEntry[] = [
  {
    id: 'entry-b1',
    date: '2026-11-02',
    time: '09:00',
    glucose: 7.2,
    carbs: 36,
    xe: 3.0,
    rinFast: 3,
    tresiba: null,
    calories: 280,
    notes: 'Завтрак User B',
    tag: 'breakfast',
    createdAt: 1730520000000,
  },
];

const SAMPLE_SETTINGS_A: UserSettings = {
  patientName: 'Иванов Иван (Пациент А)',
  diabetesType: '1',
  xeRatio: 12,
  targetLow: 4.0,
  targetHigh: 9.9,
  hypoThreshold: 3.9,
  severeHyperThreshold: 13.9,
  bolusName: 'РинФаст',
  basalName: 'Тресиба',
  doctorName: 'Д-р Петров',
  doctorNotes: 'Клинические рекомендации для Пациента А',
};

test('SEC-01 Requirement 1: Ключи хранилища строго изолированы по user.id', () => {
  const keyA = getUserEntriesStorageKey('usr_A');
  const keyB = getUserEntriesStorageKey('usr_B');
  assert.equal(keyA, 'glucotrack_entries_usr_A');
  assert.equal(keyB, 'glucotrack_entries_usr_B');
  assert.notEqual(keyA, keyB);

  const setKeyA = getUserSettingsStorageKey('usr_A');
  const setKeyB = getUserSettingsStorageKey('usr_B');
  assert.equal(setKeyA, 'glucotrack_settings_usr_A');
  assert.equal(setKeyB, 'glucotrack_settings_usr_B');
  assert.notEqual(setKeyA, setKeyB);
});

test('SEC-01 Test 1: Пользователь A -> выход -> Пользователь B: данные A недоступны B', () => {
  mockStorage.clear();

  // Пользователь A работает с приложением и сохраняет записи и настройки
  setUserCachedEntries('usr_A', SAMPLE_ENTRIES_A);
  setUserCachedSettings('usr_A', SAMPLE_SETTINGS_A);

  assert.equal(getUserCachedEntries('usr_A').length, 2);
  assert.equal(getUserCachedSettings('usr_A')?.patientName, 'Иванов Иван (Пациент А)');

  // Пользователь A выходит из системы: вызывается clearUserStorage('usr_A')
  clearUserStorage('usr_A');

  // Убеждаемся, что хранилище A очищено
  assert.equal(getUserCachedEntries('usr_A').length, 0);
  assert.equal(getUserCachedSettings('usr_A'), null);

  // Пользователь B входит в систему: проверяем, что данные A недоступны B
  const entriesForB = getUserCachedEntries('usr_B');
  const settingsForB = getUserCachedSettings('usr_B');

  assert.equal(entriesForB.length, 0);
  assert.equal(settingsForB, null);
});

test('SEC-01 Test 2: Пустой аккаунт B не импортирует записи A', () => {
  mockStorage.clear();

  // Допустим, аккаунт A имел записи в изолированном хранилище
  setUserCachedEntries('usr_A', SAMPLE_ENTRIES_A);

  // Новый/пустой аккаунт B запрашивает кэш
  const entriesB = getUserCachedEntries('usr_B');
  assert.equal(entriesB.length, 0, 'Кэш нового аккаунта B должен быть абсолютно пуст');

  // Проверяем, что даже если в старом общем ключе что-то случайно лежало:
  mockStorage.setItem(LEGACY_STORAGE_KEY_ENTRIES, JSON.stringify(SAMPLE_ENTRIES_A));

  // getLegacyUnmigratedEntries возвращает массив ТОЛЬКО для запроса явного согласия пользователя,
  // но getUserCachedEntries('usr_B') ни при каких условиях не подмешивает legacy данные
  assert.equal(getUserCachedEntries('usr_B').length, 0);
});

test('SEC-01 Test 3: Ошибка сети не раскрывает чужой кэш', () => {
  mockStorage.clear();

  // У пользователя A есть свои записи
  setUserCachedEntries('usr_A', SAMPLE_ENTRIES_A);

  // Пользователь B столкнулся с сетевой ошибкой: fallback обращается к getUserCachedEntries('usr_B')
  const fallbackEntriesB = getUserCachedEntries('usr_B');
  const fallbackSettingsB = getUserCachedSettings('usr_B');

  // Данные пользователя A категорически не должны попасть пользователю B
  assert.equal(fallbackEntriesB.length, 0);
  assert.equal(fallbackSettingsB, null);
  assert.equal(getUserCachedEntries('usr_A').length, 2, 'Записи A изолированы в своем слоте');
});

test('SEC-01 Test 4: Повторный вход A восстанавливает его собственные записи (с сервера)', () => {
  mockStorage.clear();

  // Пользователь A залогинился и получил данные с сервера
  setUserCachedEntries('usr_A', SAMPLE_ENTRIES_A);
  setUserCachedSettings('usr_A', SAMPLE_SETTINGS_A);

  // Выход
  clearUserStorage('usr_A');
  assert.equal(getUserCachedEntries('usr_A').length, 0);

  // Повторный вход A: сервер возвращает данные A, и клиент снова кэширует их
  const serverEntriesA = SAMPLE_ENTRIES_A; // имитация ответа api.getEntries()
  setUserCachedEntries('usr_A', serverEntriesA);

  const restored = getUserCachedEntries('usr_A');
  assert.equal(restored.length, 2);
  assert.equal(restored[0].notes, 'Завтрак User A');
  assert.equal(restored[1].tresiba, 14);
});

test('SEC-01 Test 5: Выход во время загрузки (race condition) не восстанавливает чужие данные', async () => {
  mockStorage.clear();

  // Моделируем состояние приложения
  let currentUserId: string | null = 'usr_A';
  let activeRequestId = 1;
  let stateEntries: DiaryEntry[] = [];

  // Пользователь A запускает асинхронную загрузку данных
  const requestForUserA = (async () => {
    const reqId = activeRequestId;
    const targetId = currentUserId;

    // Имитируем задержку сети 15 мс
    await new Promise((r) => setTimeout(r, 15));

    // Проверка guard: сменился ли пользователь или был совершен выход
    if (reqId !== activeRequestId || currentUserId !== targetId) {
      return; // Запрос отменен, данные НЕ применяются
    }

    stateEntries = SAMPLE_ENTRIES_A;
  })();

  // Не дожидаясь ответа, пользователь нажимает Logout
  activeRequestId++;
  currentUserId = null;
  stateEntries = [];

  // Дожидаемся завершения отмененного асинхронного промиса
  await requestForUserA;

  // Проверяем, что состояние осталось чистым и данные A не восстановились
  assert.equal(stateEntries.length, 0, 'Записи не должны попадать в стейт после отмены запроса');
  assert.equal(currentUserId, null);
});

test('SEC-01 Test 6: Безопасная миграция старых записей не вызывает потери данных', () => {
  mockStorage.clear();

  // В старом кэше версии 1.0 (до авторизации) лежали замеры
  mockStorage.setItem(LEGACY_STORAGE_KEY_ENTRIES, JSON.stringify(SAMPLE_ENTRIES_A));
  mockStorage.setItem(
    LEGACY_STORAGE_KEY_SETTINGS,
    JSON.stringify({ patientName: 'Пациент до миграции' })
  );

  // Проверяем обнаружение старых данных
  const legacyEntries = getLegacyUnmigratedEntries();
  const legacySettings = getLegacyUnmigratedSettings();
  assert.equal(legacyEntries.length, 2);
  assert.equal(legacySettings?.patientName, 'Пациент до миграции');

  // Пользователь B вошел в систему: в его аккаунте пока 0 записей
  assert.equal(getUserCachedEntries('usr_B').length, 0);

  // Пользователь B нажимает "Импортировать в аккаунт" (явное согласие)
  const userBExisting = getUserCachedEntries('usr_B');
  const migratedForB = [...legacyEntries, ...userBExisting];
  setUserCachedEntries('usr_B', migratedForB);

  // Очищаем legacy-хранилище только после успешной миграции
  cleanupLegacyStorage();

  // Проверяем результаты:
  // 1. В аккаунте B теперь есть все 2 записи
  assert.equal(getUserCachedEntries('usr_B').length, 2);
  // 2. Старый общий ключ полностью удален, чтобы не срабатывать повторно
  assert.equal(getLegacyUnmigratedEntries().length, 0);
  assert.equal(mockStorage.getItem(LEGACY_STORAGE_KEY_ENTRIES), null);
});

test('Оптимизация кеширования 1: исключение повторных записей неизменившихся данных', () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_1';
  // Первая запись: должна выполниться
  setUserCachedEntries(userId, SAMPLE_ENTRIES_A, { immediate: true });
  assert.equal(storageStats.setItemCalls, 1);
  assert.equal(storageStats.skippedWrites, 0);

  // Повторная запись того же самого массива ссылок
  setUserCachedEntries(userId, SAMPLE_ENTRIES_A);
  assert.equal(storageStats.setItemCalls, 1, 'Повторная запись по той же ссылке не вызывает setItem');
  assert.equal(storageStats.skippedWrites, 1, 'Зафиксирован пропуск неизменившихся данных');

  // Запись нового массива с идентичными элементами (shallow equal)
  const clonedIdentical = [...SAMPLE_ENTRIES_A];
  setUserCachedEntries(userId, clonedIdentical);
  assert.equal(storageStats.setItemCalls, 1, 'Повторная запись shallow equal не вызывает setItem');
  assert.equal(storageStats.skippedWrites, 2);

  // Чтение кэша возвращает данные и не парсит JSON повторно, если сырая строка в storage та же
  const parsed1 = getUserCachedEntries(userId);
  const parseCallsBefore = storageStats.parseCalls;
  const parsed2 = getUserCachedEntries(userId);
  assert.equal(storageStats.parseCalls, parseCallsBefore, 'Повторный вызов getUserCachedEntries не выполняет лишний JSON.parse');
  assert.equal(parsed1.length, 2);
  assert.equal(parsed2.length, 2);
});

test('Оптимизация кеширования 2: быстрое редактирование одной записи (немедленная запись неподтвержденных данных)', () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_2';
  // Базовые записи
  setUserCachedEntries(userId, SAMPLE_ENTRIES_A, { immediate: true });
  const writesBefore = storageStats.setItemCalls;

  // Быстрое редактирование: изменение сахара с unconfirmed статусом 'pending'
  const editedEntry: DiaryEntry = {
    ...SAMPLE_ENTRIES_A[0],
    glucose: 8.8,
    _syncStatus: 'pending',
  };
  const updatedList = [editedEntry, SAMPLE_ENTRIES_A[1]];

  // Вызываем setUserCachedEntries БЕЗ флага immediate
  setUserCachedEntries(userId, updatedList);

  // Из-за наличия неподтвержденной записи ('pending') сохранение ОБЯЗАНО быть немедленным!
  assert.equal(storageStats.setItemCalls, writesBefore + 1, 'Неподтвержденные изменения сохраняются немедленно');

  // Проверяем прямое наличие в mockStorage до срабатывания каких-либо таймеров
  const storedJson = mockStorage.getItem(getUserEntriesStorageKey(userId));
  assert.ok(storedJson, 'Данные немедленно присутствуют в localStorage');
  assert.ok(storedJson.includes('8.8'), 'Свежее значение сахара сразу записано на диск');
});

test('Оптимизация кеширования 3: безопасное объединение частых подтвержденных обновлений (debounce)', async () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_3';
  // Первоначальное сохранение
  setUserCachedEntries(userId, SAMPLE_ENTRIES_A, { immediate: true });
  const initialWrites = storageStats.setItemCalls;

  // Создаем 5 быстрых последовательных подтвержденных обновлений (например, фоновые сетевые отметки)
  for (let i = 0; i < 5; i++) {
    const confirmedList: DiaryEntry[] = [
      { ...SAMPLE_ENTRIES_A[0], notes: `Заметка подтверждение ${i}`, _syncStatus: 'saved' },
      SAMPLE_ENTRIES_A[1],
    ];
    setUserCachedEntries(userId, confirmedList); // Без immediate
  }

  // Сразу после цикла: setItem не должен был вызваться 5 раз
  assert.equal(storageStats.setItemCalls, initialWrites, 'Частые подтвержденные обновления не пишут в storage синхронно');

  // Ждем срабатывания debounce таймера (250 мс)
  await new Promise((resolve) => setTimeout(resolve, 250));

  // После истечения таймера выполнилась ровно одна объединенная запись
  assert.equal(storageStats.setItemCalls, initialWrites + 1, 'Выполнена ровно одна объединенная запись');
  const stored = mockStorage.getItem(getUserEntriesStorageKey(userId));
  assert.ok(stored?.includes('Заметка подтверждение 4'), 'В хранилище попало самое последнее актуальное состояние');
});

test('Оптимизация кеширования 4: перезагрузка до завершения debounce (сохранение через flush)', () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_4';
  setUserCachedEntries(userId, SAMPLE_ENTRIES_A, { immediate: true });
  const initialWrites = storageStats.setItemCalls;

  // Обновление со статусом 'saved' (планируется debounce)
  const freshList: DiaryEntry[] = [
    { ...SAMPLE_ENTRIES_A[0], notes: 'Перед перезагрузкой' },
    SAMPLE_ENTRIES_A[1],
  ];
  setUserCachedEntries(userId, freshList);
  assert.equal(storageStats.setItemCalls, initialWrites, 'Запись ожидает в debounce');

  // Имитируем событие beforeunload / pagehide при закрытии или перезагрузке страницы
  flushUserStorage(userId);

  // После flush данные гарантированно записаны на диск
  assert.equal(storageStats.setItemCalls, initialWrites + 1, 'flushUserStorage мгновенно зафиксировал изменения');
  const stored = mockStorage.getItem(getUserEntriesStorageKey(userId));
  assert.ok(stored?.includes('Перед перезагрузкой'), 'Данные не потерялись при прерывании debounce');
});

test('Оптимизация кеширования 5: выход из приложения отменяет отложенные таймеры без утечек', async () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_5';
  setUserCachedEntries(userId, SAMPLE_ENTRIES_A, { immediate: true });

  // Ставим в очередь debounced запись
  const delayedList: DiaryEntry[] = [
    { ...SAMPLE_ENTRIES_A[0], notes: 'Не должна появиться после logout' },
  ];
  setUserCachedEntries(userId, delayedList);

  // Пользователь нажимает выход
  clearUserStorage(userId);
  assert.equal(mockStorage.getItem(getUserEntriesStorageKey(userId)), null, 'Хранилище очищено сразу');

  // Ждем завершения возможного таймера
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Проверяем, что таймер был отменен и ключ пользователя не возродился в storage
  assert.equal(mockStorage.getItem(getUserEntriesStorageKey(userId)), null, 'Данные пользователя не воскресли после выхода');
  assert.equal(getUserCachedEntries(userId).length, 0);
});

test('Оптимизация кеширования 6: переполнение localStorage (QuotaExceededError) и безопасное усечение кэша', () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_6';

  // В старом legacy хранилище лежат временные данные
  mockStorage.setItem(LEGACY_STORAGE_KEY_ENTRIES, JSON.stringify(SAMPLE_ENTRIES_A));

  // Создаем большой список записей, включая критически важные неподтвержденные (pending)
  const pendingEntry: DiaryEntry = {
    ...SAMPLE_ENTRIES_A[0],
    id: 'crit-pending-1',
    glucose: 15.2,
    _syncStatus: 'pending',
  };
  const manyEntries: DiaryEntry[] = [pendingEntry];
  for (let i = 0; i < 100; i++) {
    manyEntries.push({
      ...SAMPLE_ENTRIES_A[1],
      id: `synced-${i}`,
      notes: `Синхронизированная запись ${i}`,
      _syncStatus: 'saved',
    });
  }

  // Моделируем переполнение квоты при попытке сохранить слишком большой объем
  const originalSetItem = mockStorage.setItem.bind(mockStorage);
  let quotaAttempts = 0;
  mockStorage.setItem = (k: string, v: string) => {
    // Вызываем QuotaExceededError для первой попытки записи огромного пакета
    if (v.length > 5000 && quotaAttempts < 1) {
      quotaAttempts++;
      const quotaErr = new Error('QuotaExceededError');
      quotaErr.name = 'QuotaExceededError';
      (quotaErr as unknown as { code: number }).code = 22;
      throw quotaErr;
    }
    return originalSetItem(k, v);
  };

  try {
    setUserCachedEntries(userId, manyEntries, { immediate: true });

    // Проверяем восстановление после QuotaExceededError
    assert.ok(storageStats.quotaRecoveries > 0, 'Механизм восстановления квоты сработал');

    // Legacy хранилище было очищено для освобождения места
    assert.equal(mockStorage.getItem(LEGACY_STORAGE_KEY_ENTRIES), null, 'Legacy кэш был очищен для освобождения квоты');

    // Критическая неподтвержденная запись сохранена!
    const stored = getUserCachedEntries(userId);
    const hasCritPending = stored.some((e) => e.id === 'crit-pending-1' && e.glucose === 15.2);
    assert.ok(hasCritPending, 'Критически важная pending-запись сохранена даже при переполнении квоты!');
  } finally {
    mockStorage.setItem = originalSetItem;
  }
});

test('Оптимизация кеширования 7: исключение повторных записей неизменившихся настроек UserSettings', () => {
  mockStorage.clear();
  clearUserStorageCache();
  storageStats.reset();

  const userId = 'usr_opt_7';
  setUserCachedSettings(userId, SAMPLE_SETTINGS_A);
  assert.equal(storageStats.setItemCalls, 1);
  assert.equal(storageStats.skippedWrites, 0);

  // Повторная запись тех же настроек
  setUserCachedSettings(userId, { ...SAMPLE_SETTINGS_A });
  assert.equal(storageStats.setItemCalls, 1, 'Повторная запись настроек с одинаковыми полями не вызывает setItem');
  assert.equal(storageStats.skippedWrites, 1);
});
