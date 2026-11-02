import { DiaryEntry, UserSettings, EntrySyncStatus } from '../types/diabetes';
import { getTodayDateString } from './dateTime';

export const LEGACY_STORAGE_KEY_ENTRIES = 'diabetes_diary_entries_v1';
export const LEGACY_STORAGE_KEY_SETTINGS = 'diabetes_diary_settings_v1';

export interface SetUserCachedEntriesOptions {
  immediate?: boolean;
}

interface EntriesCacheRecord {
  entries: DiaryEntry[];
  json: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

interface SettingsCacheRecord {
  settings: Partial<UserSettings>;
  json: string | null;
}

// In-memory cache for fast equality checks and debouncing
const entriesCache = new Map<string, EntriesCacheRecord>();
const settingsCache = new Map<string, SettingsCacheRecord>();

// Performance and diagnostic counters for regression testing
export const storageStats = {
  setItemCalls: 0,
  stringifyCalls: 0,
  getItemCalls: 0,
  parseCalls: 0,
  skippedWrites: 0,
  quotaRecoveries: 0,
  reset() {
    this.setItemCalls = 0;
    this.stringifyCalls = 0;
    this.getItemCalls = 0;
    this.parseCalls = 0;
    this.skippedWrites = 0;
    this.quotaRecoveries = 0;
  },
};

/**
 * Возвращает изолированный ключ хранилища для записей конкретного пользователя.
 */
export function getUserEntriesStorageKey(userId: string): string {
  return `glucotrack_entries_${userId}`;
}

/**
 * Возвращает изолированный ключ хранилища для настроек конкретного пользователя.
 */
export function getUserSettingsStorageKey(userId: string): string {
  return `glucotrack_settings_${userId}`;
}

/**
 * Проверяет, является ли ошибка ошибкой переполнения квоты localStorage.
 */
export function isQuotaExceededError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = 'name' in err ? String((err as { name: unknown }).name) : '';
  const code = 'code' in err ? Number((err as { code: unknown }).code) : 0;
  const number = 'number' in err ? Number((err as { number: unknown }).number) : 0;

  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014 ||
    number === -2147024882
  );
}

/**
 * Проверяет наличие неподтвержденных сервером записей (pending, saving, error).
 */
export function hasUnconfirmedEntries(entries: DiaryEntry[]): boolean {
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i]._syncStatus;
    if (status === 'pending' || status === 'saving' || status === 'error') {
      return true;
    }
  }
  return false;
}

/**
 * Быстрое O(N) сравнение ссылок на элементы массивов без сериализации.
 */
function areEntriesShallowEqual(a: DiaryEntry[], b: DiaryEntry[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Сравнение скалярных параметров настроек.
 */
function areSettingsEqual(a: Partial<UserSettings> | null | undefined, b: UserSettings): boolean {
  if (!a) return false;
  return (
    a.patientName === b.patientName &&
    a.diabetesType === b.diabetesType &&
    a.xeRatio === b.xeRatio &&
    a.targetLow === b.targetLow &&
    a.targetHigh === b.targetHigh &&
    a.hypoThreshold === b.hypoThreshold &&
    a.severeHyperThreshold === b.severeHyperThreshold &&
    a.bolusName === b.bolusName &&
    a.basalName === b.basalName &&
    a.doctorName === b.doctorName &&
    a.doctorNotes === b.doctorNotes
  );
}

/**
 * Безопасная запись в localStorage с обработкой QuotaExceededError.
 */
function writeToStorageWithQuotaHandling(
  key: string,
  jsonStr: string,
  entries: DiaryEntry[]
): boolean {
  try {
    storageStats.setItemCalls++;
    window.localStorage.setItem(key, jsonStr);
    return true;
  } catch (err: unknown) {
    if (isQuotaExceededError(err)) {
      console.warn('Превышена квота localStorage, выполняем освобождение памяти...');
      storageStats.quotaRecoveries++;

      // 1. Очистить устаревшие legacy данные
      cleanupLegacyStorage();
      try {
        storageStats.setItemCalls++;
        window.localStorage.setItem(key, jsonStr);
        return true;
      } catch (err2: unknown) {
        if (!isQuotaExceededError(err2)) {
          console.error('Ошибка записи после очистки legacy:', err2);
          return false;
        }
      }

      // 2. Безопасное усечение кэша: сохраняем ВСЕ unconfirmed (pending/saving/error)
      // и только N самых свежих confirmed (saved)
      try {
        const pending = entries.filter((e) => hasUnconfirmedEntries([e]));
        const saved = entries.filter((e) => !hasUnconfirmedEntries([e]));
        const prunedSaved = saved.slice(0, 50);
        const prunedEntries = [...pending, ...prunedSaved];
        storageStats.stringifyCalls++;
        const prunedJson = JSON.stringify(prunedEntries);
        storageStats.setItemCalls++;
        window.localStorage.setItem(key, prunedJson);
        console.warn('Кэш успешно усечен для сохранения в рамках квоты');
        return true;
      } catch (err3) {
        console.error('Критическое переполнение квоты localStorage:', err3);
        return false;
      }
    } else {
      console.error('Ошибка записи локального кэша записей пользователя:', err);
      return false;
    }
  }
}

/**
 * Сброс отложенного кэша для конкретного пользователя.
 */
export function flushUserEntries(userId: string): void {
  const cached = entriesCache.get(userId);
  if (!cached || !cached.timer) return;

  clearTimeout(cached.timer);
  cached.timer = null;

  if (typeof window === 'undefined' || !window.localStorage) return;

  const key = getUserEntriesStorageKey(userId);
  try {
    storageStats.stringifyCalls++;
    const jsonStr = JSON.stringify(cached.entries);
    if (cached.json !== jsonStr) {
      writeToStorageWithQuotaHandling(key, jsonStr, cached.entries);
      cached.json = jsonStr;
    } else {
      storageStats.skippedWrites++;
    }
  } catch (err) {
    console.error('Ошибка при сбросе отложенного кэша записей на диск:', err);
  }
}

/**
 * Немедленный синхронный сброс всех отложенных операций записи на диск.
 */
export function flushUserStorage(userId?: string): void {
  if (userId) {
    flushUserEntries(userId);
  } else {
    for (const id of entriesCache.keys()) {
      flushUserEntries(id);
    }
  }
}

/**
 * Очистка внутреннего оперативного кэша (для сброса состояния в тестах).
 */
export function clearUserStorageCache(): void {
  for (const record of entriesCache.values()) {
    if (record.timer) clearTimeout(record.timer);
  }
  entriesCache.clear();
  settingsCache.clear();
  storageStats.reset();
}

/**
 * Получить кэшированные медицинские записи строго для указанного пользователя.
 */
export function getUserCachedEntries(userId: string): DiaryEntry[] {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return [];
  }

  // 1. Сначала сбрасываем любые отложенные записи для этого пользователя
  flushUserEntries(userId);

  const key = getUserEntriesStorageKey(userId);
  try {
    storageStats.getItemCalls++;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      entriesCache.delete(userId);
      return [];
    }

    const cached = entriesCache.get(userId);
    // Если сырая строка не изменилась, возвращаем уже распарсенный массив (без лишнего JSON.parse)
    if (cached && cached.json === raw && cached.entries) {
      return cached.entries;
    }

    storageStats.parseCalls++;
    const parsed = JSON.parse(raw);
    const validEntries = Array.isArray(parsed) ? parsed : [];
    entriesCache.set(userId, {
      entries: validEntries,
      json: raw,
      timer: null,
    });
    return validEntries;
  } catch (err) {
    console.error('Ошибка чтения локального кэша записей пользователя:', err);
    return [];
  }
}

/**
 * Сохранить кэшированные медицинские записи строго для указанного пользователя.
 */
export function setUserCachedEntries(
  userId: string,
  entries: DiaryEntry[],
  options?: SetUserCachedEntriesOptions
): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const key = getUserEntriesStorageKey(userId);
  let cached = entriesCache.get(userId);

  // Проверяем, существует ли ключ в хранилище (вдруг было внешнее localStorage.clear())
  const rawInStorage = window.localStorage.getItem(key);
  if (rawInStorage === null && !cached?.timer) {
    cached = undefined;
    entriesCache.delete(userId);
  }

  // 1. Быстрая проверка на неизменившиеся данные по ссылкам элементов (O(N) ссылок вместо O(N) сериализации)
  if (cached && !cached.timer && areEntriesShallowEqual(cached.entries, entries)) {
    storageStats.skippedWrites++;
    return;
  }

  const isUnconfirmed = hasUnconfirmedEntries(entries);
  const mustWriteImmediate = options?.immediate === true || isUnconfirmed;

  if (mustWriteImmediate) {
    // Немедленная запись: неподтвержденные медицинские изменения должны надежно пережить перезагрузку
    if (cached?.timer) {
      clearTimeout(cached.timer);
      cached.timer = null;
    }

    try {
      storageStats.stringifyCalls++;
      const jsonStr = JSON.stringify(entries);

      // Проверка на совпадение сериализованной строки
      if (!cached || cached.json !== jsonStr || rawInStorage !== jsonStr) {
        writeToStorageWithQuotaHandling(key, jsonStr, entries);
      } else {
        storageStats.skippedWrites++;
      }

      entriesCache.set(userId, {
        entries,
        json: jsonStr,
        timer: null,
      });
    } catch (err) {
      console.error('Ошибка сериализации или записи локального кэша записей:', err);
    }
  } else {
    // Подтвержденные сервером данные: безопасный debounce
    if (cached?.timer) {
      clearTimeout(cached.timer);
    }

    const timer = setTimeout(() => {
      flushUserEntries(userId);
    }, 200);

    entriesCache.set(userId, {
      entries,
      json: cached?.json ?? null,
      timer,
    });
  }
}

/**
 * Удалить кэшированные записи пользователя.
 */
export function removeUserCachedEntries(userId: string): void {
  if (!userId) return;

  const cached = entriesCache.get(userId);
  if (cached?.timer) {
    clearTimeout(cached.timer);
  }
  entriesCache.delete(userId);

  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.removeItem(getUserEntriesStorageKey(userId));
  } catch {}
}

/**
 * Получить кэшированные настройки строго для указанного пользователя.
 */
export function getUserCachedSettings(userId: string): Partial<UserSettings> | null {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  const key = getUserSettingsStorageKey(userId);
  try {
    storageStats.getItemCalls++;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      settingsCache.delete(userId);
      return null;
    }

    const cached = settingsCache.get(userId);
    if (cached && cached.json === raw) {
      return cached.settings;
    }

    storageStats.parseCalls++;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      settingsCache.set(userId, { settings: parsed, json: raw });
      return parsed;
    }
    return null;
  } catch (err) {
    console.error('Ошибка чтения локального кэша настроек пользователя:', err);
    return null;
  }
}

/**
 * Сохранить кэшированные настройки строго для указанного пользователя.
 */
export function setUserCachedSettings(userId: string, settings: UserSettings): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const cached = settingsCache.get(userId);
  if (cached && areSettingsEqual(cached.settings, settings)) {
    storageStats.skippedWrites++;
    return; // Никакой повторной записи неизменившихся настроек
  }

  const key = getUserSettingsStorageKey(userId);
  try {
    storageStats.stringifyCalls++;
    const jsonStr = JSON.stringify(settings);
    if (!cached || cached.json !== jsonStr) {
      storageStats.setItemCalls++;
      window.localStorage.setItem(key, jsonStr);
    } else {
      storageStats.skippedWrites++;
    }
    settingsCache.set(userId, { settings, json: jsonStr });
  } catch (err) {
    console.error('Ошибка записи локального кэша настроек пользователя:', err);
  }
}

/**
 * Удалить кэшированные настройки пользователя.
 */
export function removeUserCachedSettings(userId: string): void {
  if (!userId) return;
  settingsCache.delete(userId);

  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    window.localStorage.removeItem(getUserSettingsStorageKey(userId));
  } catch {}
}

/**
 * Очистить все чувствительные данные пользователя из локального хранилища (вызывается при logout).
 */
export function clearUserStorage(userId: string): void {
  if (!userId) return;
  removeUserCachedEntries(userId);
  removeUserCachedSettings(userId);
}

/**
 * Проверить наличие немигрированных устаревших записей из общего кэша (версии 1.0 без авторизации).
 */
export function getLegacyUnmigratedEntries(): DiaryEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY_ENTRIES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Проверить наличие устаревших настроек из общего кэша.
 */
export function getLegacyUnmigratedSettings(): Partial<UserSettings> | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY_SETTINGS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Экспорт устаревших данных в JSON для создания резервной копии перед миграцией или удалением.
 */
export function exportLegacyDataBackup(entries: DiaryEntry[], settings: Partial<UserSettings> | null): void {
  const payload = {
    app: 'GlucoTrackPro_LegacyBackup',
    version: '1.0-unmigrated',
    exportedAt: new Date().toISOString(),
    entries,
    settings: settings || null,
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `glucotrack_legacy_backup_${getTodayDateString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Завершение миграции старого кэша: удаление старых общих ключей после явного согласия и импорта.
 */
export function cleanupLegacyStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_ENTRIES);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY_SETTINGS);
  } catch {}
}

// Автоматический сброс отложенных записей при перезагрузке страницы или закрытии вкладки
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('beforeunload', () => {
    flushUserStorage();
  });
  window.addEventListener('pagehide', () => {
    flushUserStorage();
  });
}
