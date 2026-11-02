import { useState, useCallback, useEffect } from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { AuthUser } from '../api/client';
import {
  getLegacyUnmigratedEntries,
  getLegacyUnmigratedSettings,
  cleanupLegacyStorage,
} from '../utils/userStorage';

export interface UseLegacyMigrationProps {
  user: AuthUser | null;
  loadingData: boolean;
  entries: DiaryEntry[];
  importEntries: (importedEntries: DiaryEntry[], replaceAll: boolean) => Promise<boolean>;
}

/**
 * Хук обнаружения и безопасной миграции устаревшего кэша версии 1.0 (SEC-01).
 * Проверяет наличие старых записей в localStorage, сравнивает их с текущими данными
 * и предлагает пользователю подтвердить их перенос в изолированное хранилище аккаунта.
 */
export function useLegacyMigration({
  user,
  loadingData,
  entries,
  importEntries,
}: UseLegacyMigrationProps) {
  const [legacyMigrationOpen, setLegacyMigrationOpen] = useState(false);
  const [legacyEntriesToMigrate, setLegacyEntriesToMigrate] = useState<DiaryEntry[]>([]);
  const [legacySettingsToMigrate, setLegacySettingsToMigrate] = useState<Partial<UserSettings> | null>(null);

  // Проверка наличия немигрированного старого локального кэша
  const checkLegacyMigration = useCallback((currentEntries: DiaryEntry[]) => {
    const unmigrated = getLegacyUnmigratedEntries();
    const newToMigrate = unmigrated.filter((legacy) => {
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

    if (newToMigrate.length > 0) {
      setLegacyEntriesToMigrate(newToMigrate);
      setLegacySettingsToMigrate(getLegacyUnmigratedSettings());
      setLegacyMigrationOpen(true);
    } else if (unmigrated.length > 0) {
      // Если все старые записи уже присутствуют в дневнике, безопасно очищаем старый ключ
      cleanupLegacyStorage();
    }
  }, []);

  // Запуск проверки после успешной загрузки данных пользователя
  useEffect(() => {
    if (user && !loadingData && entries.length >= 0) {
      checkLegacyMigration(entries);
    }
  }, [user, loadingData, entries, checkLegacyMigration]);

  // Подтвержденная пользователем безопасная миграция старых записей
  const handleConfirmLegacyMigration = useCallback(async () => {
    if (!user || legacyEntriesToMigrate.length === 0) return;
    const toMigrate = [...legacyEntriesToMigrate];
    const success = await importEntries(toMigrate, false);
    if (success) {
      cleanupLegacyStorage();
      setLegacyEntriesToMigrate([]);
      setLegacySettingsToMigrate(null);
      setLegacyMigrationOpen(false);
    }
  }, [user, legacyEntriesToMigrate, importEntries]);

  // Отклонение и удаление старого кэша
  const handleDiscardLegacy = useCallback(() => {
    cleanupLegacyStorage();
    setLegacyEntriesToMigrate([]);
    setLegacySettingsToMigrate(null);
    setLegacyMigrationOpen(false);
  }, []);

  // Сброс состояния при выходе или смене пользователя
  const resetLegacy = useCallback(() => {
    setLegacyMigrationOpen(false);
    setLegacyEntriesToMigrate([]);
    setLegacySettingsToMigrate(null);
  }, []);

  const closeLegacyModal = useCallback(() => {
    setLegacyMigrationOpen(false);
  }, []);

  return {
    legacyMigrationOpen,
    legacyEntriesToMigrate,
    legacySettingsToMigrate,
    checkLegacyMigration,
    handleConfirmLegacyMigration,
    handleDiscardLegacy,
    resetLegacy,
    closeLegacyModal,
  };
}

export type LegacyMigrationReturn = ReturnType<typeof useLegacyMigration>;
