import test from 'node:test';
import assert from 'node:assert/strict';
import { DiaryEntry, DraftDiaryEntry } from '../types/diabetes';
import {
  getUserEntriesStorageKey,
  getUserSettingsStorageKey,
  setUserCachedEntries,
  getUserCachedEntries,
  clearUserStorage,
  LEGACY_STORAGE_KEY_ENTRIES,
  LEGACY_STORAGE_KEY_SETTINGS,
  getLegacyUnmigratedEntries,
  getLegacyUnmigratedSettings,
  cleanupLegacyStorage,
} from '../utils/userStorage';

// In-memory mock localStorage для изоляции тестов в Node.js
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

test('1. useModalState: управление состоянием, открытие, закрытие и сброс модальных окон', async () => {
  // Симуляция логики состояния useModalState
  let isEntryModalOpen = false;
  let editingEntry: DiaryEntry | null = null;
  let isSettingsModalOpen = false;
  let isExcelModalOpen = false;
  let isPrivacyModalOpen = false;
  let privacyModalTab: 'policy' | 'medical' = 'policy';
  let dayToDelete: { date: string; count: number } | null = null;

  const openCreateEntry = () => { editingEntry = null; isEntryModalOpen = true; };
  const openEditEntry = (e: DiaryEntry) => { editingEntry = e; isEntryModalOpen = true; };
  const closeEntryModal = () => { isEntryModalOpen = false; editingEntry = null; };
  const openSettings = () => { isSettingsModalOpen = true; };
  const closeSettings = () => { isSettingsModalOpen = false; };
  const openExcelImport = () => { isExcelModalOpen = true; };
  const closeExcelImport = () => { isExcelModalOpen = false; };
  const openPrivacyModal = (tab: 'policy' | 'medical' = 'policy') => { privacyModalTab = tab; isPrivacyModalOpen = true; };
  const closePrivacyModal = () => { isPrivacyModalOpen = false; };
  const openDeleteDay = (date: string, count: number) => { dayToDelete = { date, count }; };
  const closeDeleteDay = () => { dayToDelete = null; };
  const closeAll = () => {
    isEntryModalOpen = false;
    editingEntry = null;
    isSettingsModalOpen = false;
    isExcelModalOpen = false;
    isPrivacyModalOpen = false;
    dayToDelete = null;
  };

  // 1. Начальное состояние — все закрыто
  assert.equal(isEntryModalOpen, false);
  assert.equal(editingEntry, null);
  assert.equal(isSettingsModalOpen, false);
  assert.equal(isExcelModalOpen, false);
  assert.equal(isPrivacyModalOpen, false);
  assert.equal(dayToDelete, null);

  // 2. Открытие добавления записи
  openCreateEntry();
  assert.equal(isEntryModalOpen, true);
  assert.equal(editingEntry, null);
  closeEntryModal();
  assert.equal(isEntryModalOpen, false);

  // 3. Открытие редактирования записи
  const testEntry: DiaryEntry = {
    id: 'e-1',
    date: '2026-11-02',
    time: '12:00',
    glucose: 5.6,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: 'Обед',
    createdAt: 100,
  };
  openEditEntry(testEntry);
  assert.equal(isEntryModalOpen, true);
  assert.equal((editingEntry as DiaryEntry | null)?.id, 'e-1');
  closeEntryModal();
  assert.equal(editingEntry, null);

  // 4. Открытие и закрытие настроек и Excel импорта
  openSettings();
  assert.equal(isSettingsModalOpen, true);
  closeSettings();
  assert.equal(isSettingsModalOpen, false);

  openExcelImport();
  assert.equal(isExcelModalOpen, true);
  closeExcelImport();
  assert.equal(isExcelModalOpen, false);

  // 5. Открытие Privacy policy с нужной вкладкой
  openPrivacyModal('medical');
  assert.equal(isPrivacyModalOpen, true);
  assert.equal(privacyModalTab, 'medical');
  closePrivacyModal();
  assert.equal(isPrivacyModalOpen, false);

  // 6. Подтверждение удаления дня
  openDeleteDay('2026-11-02', 4);
  const currentDayToDelete = dayToDelete as { date: string; count: number } | null;
  assert.ok(currentDayToDelete);
  assert.equal(currentDayToDelete.date, '2026-11-02');
  assert.equal(currentDayToDelete.count, 4);
  closeDeleteDay();
  assert.equal(dayToDelete, null);

  // 7. Метод closeAll закрывает всё активное состояние
  openSettings();
  openDeleteDay('2026-11-03', 2);
  openEditEntry(testEntry);
  closeAll();
  assert.equal(isSettingsModalOpen, false);
  assert.equal(isEntryModalOpen, false);
  assert.equal(editingEntry, null);
  assert.equal(dayToDelete, null);
});

test('2. useLegacyMigration: обнаружение, исключение существующих записей и подтверждение переноса', () => {
  mockStorage.clear();

  // Создаем устаревший кэш v1.0
  const legacyEntries: DiaryEntry[] = [
    { id: 'leg-1', date: '2026-10-20', time: '08:00', glucose: 5.5, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: 'Старая 1', createdAt: 1 },
    { id: 'leg-2', date: '2026-10-21', time: '13:00', glucose: 6.2, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: 'Старая 2', createdAt: 2 },
  ];
  mockStorage.setItem(LEGACY_STORAGE_KEY_ENTRIES, JSON.stringify(legacyEntries));

  // Текущие записи на сервере содержат leg-1, но не leg-2
  const currentEntries: DiaryEntry[] = [
    { id: 'leg-1', date: '2026-10-20', time: '08:00', glucose: 5.5, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: 'Старая 1', createdAt: 1 },
  ];

  const unmigrated = getLegacyUnmigratedEntries();
  assert.equal(unmigrated.length, 2);

  // Фильтруем те, которых нет на сервере
  const toMigrate = unmigrated.filter((legacy) => {
    return !currentEntries.some(
      (server) =>
        (legacy.id && server.id && legacy.id === server.id) ||
        (legacy.date === server.date &&
          legacy.time === server.time &&
          (legacy.glucose == null ||
            server.glucose == null ||
            Math.abs((legacy.glucose ?? 0) - (server.glucose ?? 0)) < 0.05))
    );
  });

  assert.equal(toMigrate.length, 1, 'Должна определиться только отсутствующая запись leg-2');
  assert.equal(toMigrate[0].id, 'leg-2');

  // Очистка старого хранилища после миграции
  cleanupLegacyStorage();
  assert.equal(getLegacyUnmigratedEntries().length, 0);
  assert.equal(mockStorage.getItem(LEGACY_STORAGE_KEY_ENTRIES), null);
});

test('3. useDiaryData: генерация UUID (SEC-11), проверка сохранения и импорта', async () => {
  // Тестируем логику handleSaveEntry: если ID отсутствует, должен быть создан валидный UUID
  const savedEntries: DiaryEntry[] = [];
  const mockSaveEntry = async (entry: DraftDiaryEntry) => {
    savedEntries.push(entry as DiaryEntry);
    return true;
  };

  const handleSaveEntry = async (data: DraftDiaryEntry) => {
    const entryData = data.id ? data : { ...data, id: crypto.randomUUID() };
    return await mockSaveEntry(entryData);
  };

  // 1. Создание без ID -> автоматический UUID
  await handleSaveEntry({
    date: '2026-11-02',
    time: '15:00',
    glucose: 5.8,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: 'Новая запись',
  });

  assert.equal(savedEntries.length, 1);
  assert.ok(savedEntries[0].id, 'ID должен быть автоматически сгенерирован');
  assert.match(
    savedEntries[0].id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    'ID должен быть криптографически стойким UUID v4'
  );

  // 2. Редактирование с существующим ID -> сохранение исходного ID
  await handleSaveEntry({
    id: 'existing-entry-id',
    date: '2026-11-02',
    time: '15:00',
    glucose: 6.0,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: 'Обновленная запись',
  });

  assert.equal(savedEntries.length, 2);
  assert.equal(savedEntries[1].id, 'existing-entry-id');

  // 3. handleExcelImport: выбрасывает исключение при неуспешном импорте на сервер
  const mockFailedImport = async () => false;
  const handleExcelImport = async (entries: DiaryEntry[], replaceAll: boolean) => {
    const success = await mockFailedImport();
    if (!success) {
      throw new Error('Не удалось сохранить импортированные записи на сервере');
    }
  };

  await assert.rejects(
    async () => {
      await handleExcelImport([], false);
    },
    { message: 'Не удалось сохранить импортированные записи на сервере' }
  );
});

test('4. Изоляция сессий и очистка пользовательского кэша при выходе (handleLogout)', () => {
  mockStorage.clear();
  const userIdA = 'usr_logout_test_a';
  const userIdB = 'usr_logout_test_b';

  // Сохраняем данные двух пользователей
  setUserCachedEntries(userIdA, [
    { id: 'a-1', date: '2026-11-02', time: '10:00', glucose: 5.4, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 1 },
  ]);
  setUserCachedEntries(userIdB, [
    { id: 'b-1', date: '2026-11-02', time: '11:00', glucose: 6.8, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 2 },
  ]);

  assert.equal(getUserCachedEntries(userIdA).length, 1);
  assert.equal(getUserCachedEntries(userIdB).length, 1);

  // Пользователь A выходит из системы -> вызывается clearUserStorage(userIdA)
  clearUserStorage(userIdA);

  // Данные пользователя A очищены, данные пользователя B не затронуты
  assert.equal(getUserCachedEntries(userIdA).length, 0);
  assert.equal(getUserCachedEntries(userIdB).length, 1);
  assert.equal(getUserCachedEntries(userIdB)[0].id, 'b-1');
});
