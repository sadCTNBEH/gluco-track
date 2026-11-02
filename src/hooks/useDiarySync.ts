import { useState, useCallback, useRef, useEffect } from 'react';
import { DiaryEntry, UserSettings, EntrySyncStatus, DraftDiaryEntry } from '../types/diabetes';
import { DEFAULT_SETTINGS, deduplicateEntries } from '../utils/diabetes';
import { api, AuthUser, ApiError, sanitizeEntryForServer } from '../api/client';
import {
  getUserCachedEntries,
  setUserCachedEntries,
  getUserCachedSettings,
  setUserCachedSettings,
  removeUserCachedEntries,
  flushUserStorage,
} from '../utils/userStorage';
import {
  isClientError,
  isConflictError,
  isNetworkOrServerError,
  createOptimisticEntry,
  updateOptimisticEntry,
  rollbackEntry,
  markEntrySaved,
  markEntryPending,
  rollbackDeletedEntry,
  rollbackDeletedDay,
  getPendingEntries,
} from '../utils/diarySync';

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
}

function getErrorStatus(err: unknown): number | undefined {
  if (err instanceof ApiError) return err.status;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const s = (err as { status: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return undefined;
}

export interface UseDiarySyncReturn {
  entries: DiaryEntry[];
  setEntries: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  settings: UserSettings;
  setSettings: React.Dispatch<React.SetStateAction<UserSettings>>;
  loadingData: boolean;
  syncError: string | null;
  clearSyncError: () => void;
  isSyncing: boolean;
  pendingCount: number;
  loadUserData: (targetUser: AuthUser) => Promise<void>;
  resetUserData: () => void;
  saveEntry: (data: DraftDiaryEntry) => Promise<boolean>;
  deleteEntry: (id: string) => Promise<boolean>;
  deleteDay: (date: string) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  updateSettings: (newSettings: UserSettings) => Promise<boolean>;
  importEntries: (importedEntries: DiaryEntry[], replaceAll: boolean) => Promise<boolean>;
  retryPending: () => Promise<void>;
}

export function useDiarySync(user: AuthUser | null): UseDiarySyncReturn {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loadingData, setLoadingData] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Ссылки для предотвращения race conditions при смене пользователей и параллельных запросах
  const currentUserIdRef = useRef<string | null>(user?.id || null);
  const loadRequestIdRef = useRef<number>(0);
  const entryRequestSeqRef = useRef<Record<string, number>>({});
  const settingsSeqRef = useRef<number>(0);
  const entriesRef = useRef<DiaryEntry[]>(entries);
  entriesRef.current = entries;

  // Синхронизируем currentUserIdRef при изменении prop user и сбрасываем кэш предыдущего
  useEffect(() => {
    const prevUserId = currentUserIdRef.current;
    if (prevUserId && prevUserId !== user?.id) {
      flushUserStorage(prevUserId);
    }
    currentUserIdRef.current = user?.id || null;
  }, [user]);

  // Сброс отложенных записей при размонтировании
  useEffect(() => {
    return () => {
      if (currentUserIdRef.current) {
        flushUserStorage(currentUserIdRef.current);
      }
    };
  }, []);

  // Число несинхронизированных записей (ожидающих отправки или с ошибкой)
  const pendingCount = getPendingEntries(entries).length;

  const clearSyncError = useCallback(() => {
    setSyncError(null);
  }, []);

  // Сброс данных при выходе
  const resetUserData = useCallback(() => {
    loadRequestIdRef.current++;
    if (currentUserIdRef.current) {
      flushUserStorage(currentUserIdRef.current);
    }
    currentUserIdRef.current = null;
    entryRequestSeqRef.current = {};
    settingsSeqRef.current = 0;
    setEntries([]);
    setSettings(DEFAULT_SETTINGS);
    setSyncError(null);
    setIsSyncing(false);
    setLoadingData(false);
  }, []);

  // Кэширование записей строго по user.id при каждом изменении (с поддержкой immediate и debounce)
  const persistEntries = useCallback((userId: string, currentEntries: DiaryEntry[], immediate = false) => {
    if (userId && currentUserIdRef.current === userId) {
      setUserCachedEntries(userId, currentEntries, { immediate });
    }
  }, []);

  // Кэширование настроек строго по user.id
  const persistSettings = useCallback((userId: string, currentSettings: UserSettings) => {
    if (userId && currentUserIdRef.current === userId) {
      setUserCachedSettings(userId, currentSettings);
    }
  }, []);

  // Загрузка данных пользователя (сервер как источник истины с сохранением локальных pending записей)
  const loadUserData = useCallback(
    async (targetUser: AuthUser) => {
      const targetUserId = targetUser.id;
      currentUserIdRef.current = targetUserId;
      const currentRequestId = ++loadRequestIdRef.current;

      setLoadingData(true);
      setSyncError(null);

      try {
        const [serverEntries, serverSettings] = await Promise.all([
          api.getEntries(),
          api.getSettings(),
        ]);

        // Защита от race condition: если пользователь сменился во время запроса
        if (currentRequestId !== loadRequestIdRef.current || currentUserIdRef.current !== targetUserId) {
          return;
        }

        // 1. Настройки с сервера
        if (serverSettings) {
          const mergedSettings = { ...DEFAULT_SETTINGS, ...serverSettings };
          setSettings(mergedSettings);
          persistSettings(targetUserId, mergedSettings);
        }

        // 2. Записи: объединяем серверные с любыми локальными pending записями, которые еще не ушли на сервер
        // Защита от перезаписи свежего локального кэша устаревшими данными API (Requirement 8):
        const cached = getUserCachedEntries(targetUserId);
        const localPending = cached.filter((e) => e._syncStatus === 'pending' || e._syncStatus === 'error');
        const localPendingMap = new Map(localPending.map((p) => [p.id, p]));

        const rawServer = Array.isArray(serverEntries) ? serverEntries : [];
        const confirmedServer = rawServer.map((serverEntry) => {
          const pending = localPendingMap.get(serverEntry.id);
          if (pending) {
            // Сохраняем свежие локальные изменения пользователя, еще не подтвержденные сервером
            localPendingMap.delete(serverEntry.id);
            return pending;
          }
          return {
            ...serverEntry,
            _syncStatus: 'saved' as EntrySyncStatus,
          };
        });

        // Добавляем новые локальные pending записи, которых еще нет на сервере
        const remainingPending = Array.from(localPendingMap.values());
        const merged = deduplicateEntries([...remainingPending, ...confirmedServer]);
        setEntries(merged);
        persistEntries(targetUserId, merged, false);
      } catch (err: unknown) {
        if (currentRequestId !== loadRequestIdRef.current || currentUserIdRef.current !== targetUserId) {
          return;
        }
        console.error('Ошибка загрузки данных с сервера:', err);

        // При ошибке сети изолированный fallback на локальный кэш пользователя
        const userEntriesCache = getUserCachedEntries(targetUserId);
        const userSettingsCache = getUserCachedSettings(targetUserId);

        setEntries(userEntriesCache);
        if (userSettingsCache) {
          setSettings({ ...DEFAULT_SETTINGS, ...userSettingsCache });
        }

        if (isNetworkOrServerError(err)) {
          setSyncError('Работа в офлайн-режиме: используются локальные данные.');
        } else {
          setSyncError(getErrorMessage(err, 'Не удалось загрузить данные с сервера'));
        }
      } finally {
        if (currentRequestId === loadRequestIdRef.current && currentUserIdRef.current === targetUserId) {
          setLoadingData(false);
        }
      }
    },
    [persistEntries, persistSettings]
  );

  // Сохранение (создание или редактирование) записи
  const saveEntry = useCallback(
    async (data: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }): Promise<boolean> => {
      if (!user) return false;
      const opUserId = user.id;

      if (data.id && entriesRef.current.some((e) => e.id === data.id)) {
        // --- РЕДАКТИРОВАНИЕ СУЩЕСТВУЮЩЕЙ ЗАПИСИ ---
        const entryId = data.id;
        const seq = (entryRequestSeqRef.current[entryId] = (entryRequestSeqRef.current[entryId] || 0) + 1);

        // 1. Оптимистичное обновление
        let previousSnapshot: DiaryEntry | null = null;
        setEntries((prev) => {
          const res = updateOptimisticEntry(prev, entryId, data);
          previousSnapshot = res.previousEntry;
          persistEntries(opUserId, res.updatedEntries, true);
          return res.updatedEntries;
        });

        try {
          const saved = await api.updateEntry(entryId, sanitizeEntryForServer(data));

          // Проверка race condition: аккаунт сменился или отправлена более свежая версия этой записи
          if (currentUserIdRef.current !== opUserId || entryRequestSeqRef.current[entryId] !== seq) {
            return false;
          }

          setEntries((prev) => {
            const confirmed = markEntrySaved(prev, entryId, saved?.id);
            persistEntries(opUserId, confirmed, false);
            return confirmed;
          });
          return true;
        } catch (err: unknown) {
          if (currentUserIdRef.current !== opUserId || entryRequestSeqRef.current[entryId] !== seq) {
            return false;
          }

          console.error('Ошибка обновления записи на сервере:', err);

          if (isClientError(err)) {
            // Откат изменений при явном отказе сервера (400, 403, 404, 422)
            setEntries((prev) => {
              const rolledBack = rollbackEntry(prev, previousSnapshot, entryId);
              persistEntries(opUserId, rolledBack, true);
              return rolledBack;
            });
            const msg = getErrorMessage(err, 'Недопустимые данные');
            setSyncError(`Ошибка сохранения: ${msg}`);
            return false;
          } else {
            // Сетевой сбой: сохраняем изменение локально со статусом 'pending' (без потери данных)
            const errMsg = getErrorMessage(err, 'Ошибка сети');
            setEntries((prev) => {
              const pending = markEntryPending(prev, entryId, errMsg);
              persistEntries(opUserId, pending, true);
              return pending;
            });
            setSyncError('Изменение сохранено локально (офлайн). Отправка на сервер будет повторена.');
            return true;
          }
        }
      } else {
        // --- СОЗДАНИЕ НОВОЙ ЗАПИСИ ---
        const optimistic = createOptimisticEntry(data);
        const tempId = optimistic.id;
        const seq = (entryRequestSeqRef.current[tempId] = 1);

        setEntries((prev) => {
          const next = [optimistic, ...prev];
          persistEntries(opUserId, next, true);
          return next;
        });

        try {
          const saved = await api.createEntry(sanitizeEntryForServer(optimistic));

          if (currentUserIdRef.current !== opUserId || entryRequestSeqRef.current[tempId] !== seq) {
            return false;
          }

          setEntries((prev) => {
            const confirmed = markEntrySaved(prev, tempId, saved?.id);
            persistEntries(opUserId, confirmed, false);
            return confirmed;
          });
          return true;
        } catch (err: unknown) {
          if (currentUserIdRef.current !== opUserId || entryRequestSeqRef.current[tempId] !== seq) {
            return false;
          }

          console.error('Ошибка добавления записи на сервере:', err);

          if (isClientError(err)) {
            // 4xx отказ сервера (валидация, права) -> обязательный откат оптимистичного добавления
            setEntries((prev) => {
              const rolledBack = rollbackEntry(prev, null, tempId);
              persistEntries(opUserId, rolledBack, true);
              return rolledBack;
            });
            const msg = getErrorMessage(err, 'Данные отклонены сервером');
            setSyncError(`Ошибка создания записи: ${msg}`);
            return false;
          } else if (isConflictError(err)) {
            // 409 Conflict: ID уже существует на сервере (запрос успел пройти ранее)
            setEntries((prev) => {
              const confirmed = markEntrySaved(prev, tempId);
              persistEntries(opUserId, confirmed, false);
              return confirmed;
            });
            return true;
          } else {
            // Сетевая ошибка или 5xx -> помечаем как pending, сохраняя замер в дневнике
            const errMsg = getErrorMessage(err, 'Ошибка сети');
            setEntries((prev) => {
              const pending = markEntryPending(prev, tempId, errMsg);
              persistEntries(opUserId, pending, true);
              return pending;
            });
            setSyncError('Запись сохранена в дневнике локально (офлайн). Ожидает отправки на сервер.');
            return true;
          }
        }
      }
    },
    [user, persistEntries]
  );

  // Удаление отдельной записи
  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) return false;
      const opUserId = user.id;

      let deletedSnapshot: DiaryEntry | null = null;

      // Оптимистичное удаление
      setEntries((prev) => {
        deletedSnapshot = prev.find((e) => e.id === id) || null;
        const next = prev.filter((e) => e.id !== id);
        persistEntries(opUserId, next, true);
        return next;
      });

      try {
        await api.deleteEntry(id);
        return true;
      } catch (err: unknown) {
        if (currentUserIdRef.current !== opUserId) return false;

        // Если запись уже была удалена на сервере (404), откат не нужен
        if (getErrorStatus(err) === 404) return true;

        console.error('Ошибка удаления записи на сервере:', err);

        // Откат: восстанавливаем удаленную запись
        if (deletedSnapshot) {
          setEntries((prev) => {
            const restored = rollbackDeletedEntry(prev, deletedSnapshot!);
            persistEntries(opUserId, restored, true);
            return restored;
          });
        }
        const msg = getErrorMessage(err, 'Ошибка сервера');
        setSyncError(`Не удалось удалить запись: ${msg}`);
        return false;
      }
    },
    [user, persistEntries]
  );

  // Удаление целого дня
  const deleteDay = useCallback(
    async (date: string): Promise<boolean> => {
      if (!user) return false;
      const opUserId = user.id;

      let daySnapshot: DiaryEntry[] = [];

      // Оптимистичное удаление
      setEntries((prev) => {
        daySnapshot = prev.filter((e) => e.date === date);
        const next = prev.filter((e) => e.date !== date);
        persistEntries(opUserId, next, true);
        return next;
      });

      try {
        await api.deleteDay(date);
        return true;
      } catch (err: unknown) {
        if (currentUserIdRef.current !== opUserId) return false;

        console.error('Ошибка удаления дня на сервере:', err);

        // Откат: восстанавливаем все записи за этот день
        if (daySnapshot.length > 0) {
          setEntries((prev) => {
            const restored = rollbackDeletedDay(prev, daySnapshot);
            persistEntries(opUserId, restored, true);
            return restored;
          });
        }
        const msg = getErrorMessage(err, 'Ошибка сервера');
        setSyncError(`Не удалось удалить записи за день: ${msg}`);
        return false;
      }
    },
    [user, persistEntries]
  );

  // Очистка всех записей
  const clearAll = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const opUserId = user.id;

    let allSnapshot: DiaryEntry[] = [];

    setEntries((prev) => {
      allSnapshot = [...prev];
      removeUserCachedEntries(opUserId);
      return [];
    });

    try {
      await api.clearEntries();
      return true;
    } catch (err: unknown) {
      if (currentUserIdRef.current !== opUserId) return false;

      console.error('Ошибка очистки на сервере:', err);

      // Откат: восстанавливаем записи в памяти и кэше
      setEntries(allSnapshot);
      persistEntries(opUserId, allSnapshot, true);
      const msg = getErrorMessage(err, 'Ошибка сервера');
      setSyncError(`Не удалось очистить записи: ${msg}`);
      return false;
    }
  }, [user, persistEntries]);

  // Обновление настроек
  const updateSettings = useCallback(
    async (newSettings: UserSettings): Promise<boolean> => {
      if (!user) return false;
      const opUserId = user.id;
      const seq = ++settingsSeqRef.current;

      const previousSettings = { ...settings };
      setSettings(newSettings);
      persistSettings(opUserId, newSettings);

      try {
        const saved = await api.updateSettings(newSettings);

        if (currentUserIdRef.current !== opUserId || settingsSeqRef.current !== seq) {
          return false;
        }

        const merged = { ...DEFAULT_SETTINGS, ...saved };
        setSettings(merged);
        persistSettings(opUserId, merged);
        return true;
      } catch (err: unknown) {
        if (currentUserIdRef.current !== opUserId || settingsSeqRef.current !== seq) {
          return false;
        }

        console.error('Ошибка обновления настроек на сервере:', err);

        if (isClientError(err)) {
          // Откат при недопустимых значениях (например targetLow >= targetHigh)
          setSettings(previousSettings);
          persistSettings(opUserId, previousSettings);
          const msg = getErrorMessage(err, 'Недопустимые параметры');
          setSyncError(`Настройки отклонены сервером: ${msg}`);
          return false;
        } else {
          // Сохраняем локально при сетевой ошибке
          setSyncError('Настройки сохранены локально (офлайн).');
          return true;
        }
      }
    },
    [user, settings, persistSettings]
  );

  // Пакетный импорт записей (из Excel или миграции)
  const importEntries = useCallback(
    async (importedEntries: DiaryEntry[], replaceAll: boolean): Promise<boolean> => {
      if (!user) return false;
      const opUserId = user.id;

      const previousEntries = [...entries];

      try {
        await api.importEntries(importedEntries, replaceAll);

        if (currentUserIdRef.current !== opUserId) return false;

        // Успешный импорт: обновляем записи из подтвержденного пакета
        const updatedEntries = replaceAll
          ? importedEntries.map((e) => ({ ...e, _syncStatus: 'saved' as EntrySyncStatus }))
          : deduplicateEntries([
              ...importedEntries.map((e) => ({ ...e, _syncStatus: 'saved' as EntrySyncStatus })),
              ...entries,
            ]);

        setEntries(updatedEntries);
        persistEntries(opUserId, updatedEntries, true);
        return true;
      } catch (err: unknown) {
        if (currentUserIdRef.current !== opUserId) return false;

        console.error('Ошибка импорта на сервер:', err);

        // Откат к исходному состоянию
        setEntries(previousEntries);
        persistEntries(opUserId, previousEntries, true);
        const msg = getErrorMessage(err, 'Сервер отклонил пакет');
        setSyncError(`Ошибка импорта записей: ${msg}`);
        return false;
      }
    },
    [user, entries, persistEntries]
  );

  // Повторная отправка несинхронизированных записей (при появлении сети или по кнопке)
  const retryPending = useCallback(async () => {
    if (!user || isSyncing) return;
    const opUserId = user.id;

    const pending = getPendingEntries(entries);
    if (pending.length === 0) {
      setSyncError(null);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Отправляем пакет несинхронизированных записей через идемпотентный POST /api/entries/import (replaceAll: false)
      await api.importEntries(
        pending.map((e) => sanitizeEntryForServer(e)),
        false
      );

      if (currentUserIdRef.current !== opUserId) return;

      // Помечаем все отправленные записи как 'saved'
      setEntries((prev) => {
        const pendingIds = new Set(pending.map((p) => p.id));
        const updated = prev.map((item) =>
          pendingIds.has(item.id)
            ? { ...item, _syncStatus: 'saved' as EntrySyncStatus, _syncError: undefined }
            : item
        );
        persistEntries(opUserId, updated, false);
        return updated;
      });

      setSyncError(null);
    } catch (err: unknown) {
      if (currentUserIdRef.current !== opUserId) return;
      console.error('Ошибка повторной синхронизации:', err);
      const msg = getErrorMessage(err, 'Сеть недоступна');
      setSyncError(`Не удалось синхронизировать записи: ${msg}`);
    } finally {
      if (currentUserIdRef.current === opUserId) {
        setIsSyncing(false);
      }
    }
  }, [user, isSyncing, entries, persistEntries]);

  return {
    entries,
    setEntries,
    settings,
    setSettings,
    loadingData,
    syncError,
    clearSyncError,
    isSyncing,
    pendingCount,
    loadUserData,
    resetUserData,
    saveEntry,
    deleteEntry,
    deleteDay,
    clearAll,
    updateSettings,
    importEntries,
    retryPending,
  };
}
