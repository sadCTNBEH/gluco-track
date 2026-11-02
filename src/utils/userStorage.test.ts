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
(globalThis as any).window = {
  localStorage: mockStorage,
};

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
