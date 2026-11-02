import { useCallback } from 'react';
import { DiaryEntry, UserSettings, DraftDiaryEntry } from '../types/diabetes';
import { AuthUser, api } from '../api/client';
import { deduplicateEntries } from '../utils/diabetes';
import { useDiarySync, UseDiarySyncReturn } from './useDiarySync';

export interface UseDiaryDataReturn extends UseDiarySyncReturn {
  handleSaveEntry: (data: DraftDiaryEntry) => Promise<boolean>;
  handleDeleteEntry: (id: string) => Promise<boolean>;
  handleClearAll: () => Promise<boolean>;
  handleUpdateSettings: (newSettings: UserSettings) => Promise<boolean>;
  handleExcelImport: (importedEntries: DiaryEntry[], replaceAll: boolean) => Promise<void>;
  handleDeduplicate: () => Promise<void>;
}

/**
 * Высокоуровневый хук управления данными медицинского дневника.
 * Объединяет синхронизацию с сервером (useDiarySync), безопасную генерацию UUID (SEC-11),
 * пакетный импорт, дедупликацию и управление настройками пользователя.
 */
export function useDiaryData(user: AuthUser | null): UseDiaryDataReturn {
  const sync = useDiarySync(user);
  const {
    saveEntry,
    deleteEntry,
    clearAll,
    updateSettings,
    importEntries,
    loadUserData,
    setEntries,
  } = sync;

  // Добавление или сохранение записи с безопасным криптографическим UUID (SEC-11)
  const handleSaveEntry = useCallback(
    async (data: DraftDiaryEntry): Promise<boolean> => {
      const entryData = data.id ? data : { ...data, id: crypto.randomUUID() };
      return await saveEntry(entryData);
    },
    [saveEntry]
  );

  const handleDeleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      return await deleteEntry(id);
    },
    [deleteEntry]
  );

  const handleClearAll = useCallback(async (): Promise<boolean> => {
    return await clearAll();
  }, [clearAll]);

  const handleUpdateSettings = useCallback(
    async (newSettings: UserSettings): Promise<boolean> => {
      return await updateSettings(newSettings);
    },
    [updateSettings]
  );

  // Импорт из файла Excel / CSV с проверкой подтверждения сохранения
  const handleExcelImport = useCallback(
    async (importedEntries: DiaryEntry[], replaceAll: boolean): Promise<void> => {
      const success = await importEntries(importedEntries, replaceAll);
      if (!success) {
        throw new Error('Не удалось сохранить импортированные записи на сервере');
      }
    },
    [importEntries]
  );

  // Ручная или фоновая дедупликация записей
  const handleDeduplicate = useCallback(async (): Promise<void> => {
    try {
      await api.deduplicateEntries();
      if (user) await loadUserData(user);
    } catch (err) {
      console.error('Ошибка дедупликации:', err);
      setEntries((prev) => deduplicateEntries(prev));
    }
  }, [user, loadUserData, setEntries]);

  return {
    ...sync,
    handleSaveEntry,
    handleDeleteEntry,
    handleClearAll,
    handleUpdateSettings,
    handleExcelImport,
    handleDeduplicate,
  };
}
