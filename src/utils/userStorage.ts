import { DiaryEntry, UserSettings } from '../types/diabetes';

export const LEGACY_STORAGE_KEY_ENTRIES = 'diabetes_diary_entries_v1';
export const LEGACY_STORAGE_KEY_SETTINGS = 'diabetes_diary_settings_v1';

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
 * Получить кэшированные медицинские записи строго для указанного пользователя.
 */
export function getUserCachedEntries(userId: string): DiaryEntry[] {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getUserEntriesStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Ошибка чтения локального кэша записей пользователя:', err);
    return [];
  }
}

/**
 * Сохранить кэшированные медицинские записи строго для указанного пользователя.
 */
export function setUserCachedEntries(userId: string, entries: DiaryEntry[]): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(getUserEntriesStorageKey(userId), JSON.stringify(entries));
  } catch (err) {
    console.error('Ошибка записи локального кэша записей пользователя:', err);
  }
}

/**
 * Удалить кэшированные записи пользователя.
 */
export function removeUserCachedEntries(userId: string): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
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
  try {
    const raw = window.localStorage.getItem(getUserSettingsStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
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
  try {
    window.localStorage.setItem(getUserSettingsStorageKey(userId), JSON.stringify(settings));
  } catch (err) {
    console.error('Ошибка записи локального кэша настроек пользователя:', err);
  }
}

/**
 * Удалить кэшированные настройки пользователя.
 */
export function removeUserCachedSettings(userId: string): void {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return;
  }
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
  a.download = `glucotrack_legacy_backup_${new Date().toISOString().slice(0, 10)}.json`;
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
