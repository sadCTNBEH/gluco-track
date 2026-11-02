import { DiaryEntry, EntrySyncStatus, UserSettings } from '../types/diabetes';
import { ApiError } from '../api/client';

/**
 * Проверяет, является ли ошибка явным отказом сервера (клиентской ошибкой 4xx),
 * требующей обязательного отката оптимистичных изменений (кроме 409 Conflict).
 */
export function isClientError(err: unknown): boolean {
  if (err instanceof ApiError && typeof err.status === 'number') {
    return err.status >= 400 && err.status < 500 && err.status !== 409;
  }
  if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (typeof status === 'number') {
      return status >= 400 && status < 500 && status !== 409;
    }
  }
  return false;
}

/**
 * Проверяет, является ли ошибка конфликтом 409 (запись с таким ID уже существует на сервере).
 * Это означает, что запись была успешно создана на сервере при предыдущей попытке.
 */
export function isConflictError(err: unknown): boolean {
  if (err instanceof ApiError && err.status === 409) return true;
  if (typeof err === 'object' && err !== null && 'status' in err) {
    return (err as { status: unknown }).status === 409;
  }
  return false;
}

/**
 * Проверяет, вызвана ли ошибка потерей сети или временным сбоем сервера (5xx).
 */
export function isNetworkOrServerError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.isNetworkError || !err.status || err.status >= 500;
  }
  return true;
}

/**
 * Создает оптимистичную запись со статусом 'saving'
 */
export function createOptimisticEntry(
  data: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }
): DiaryEntry {
  const id = data.id || crypto.randomUUID();
  const now = Date.now();
  return {
    ...data,
    id,
    createdAt: now,
    _syncStatus: 'saving',
    _lastModified: now,
  };
}

/**
 * Применяет оптимистичное обновление записи, сохраняя снимок предыдущей версии для отката.
 */
export function updateOptimisticEntry(
  entries: DiaryEntry[],
  id: string,
  patch: Partial<DiaryEntry>
): { updatedEntries: DiaryEntry[]; previousEntry: DiaryEntry | null } {
  let previousEntry: DiaryEntry | null = null;
  const now = Date.now();

  const updatedEntries = entries.map((item) => {
    if (item.id === id) {
      previousEntry = { ...item };
      return {
        ...item,
        ...patch,
        id,
        _syncStatus: 'saving' as EntrySyncStatus,
        _lastModified: now,
      };
    }
    return item;
  });

  return { updatedEntries, previousEntry };
}

/**
 * Откатывает создание или обновление записи.
 * Если previousEntry === null, удаляет добавленную запись.
 * Иначе восстанавливает исходную версию.
 */
export function rollbackEntry(
  entries: DiaryEntry[],
  previousEntry: DiaryEntry | null,
  entryId: string
): DiaryEntry[] {
  if (!previousEntry) {
    return entries.filter((e) => e.id !== entryId);
  }
  return entries.map((e) => (e.id === entryId ? previousEntry : e));
}

/**
 * Помечает запись как успешно сохраненную на сервере.
 */
export function markEntrySaved(
  entries: DiaryEntry[],
  id: string,
  confirmedId?: string
): DiaryEntry[] {
  return entries.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        id: confirmedId || item.id,
        _syncStatus: 'saved' as EntrySyncStatus,
        _syncError: undefined,
      };
    }
    return item;
  });
}

/**
 * Помечает запись как ожидающую синхронизации (офлайн/сетевой сбой).
 * Медицинские данные не теряются.
 */
export function markEntryPending(
  entries: DiaryEntry[],
  id: string,
  errorMessage?: string
): DiaryEntry[] {
  return entries.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        _syncStatus: 'pending' as EntrySyncStatus,
        _syncError: errorMessage || 'Ожидает отправки на сервер',
      };
    }
    return item;
  });
}

/**
 * Помечает запись как ошибочную.
 */
export function markEntryError(
  entries: DiaryEntry[],
  id: string,
  errorMessage: string
): DiaryEntry[] {
  return entries.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        _syncStatus: 'error' as EntrySyncStatus,
        _syncError: errorMessage,
      };
    }
    return item;
  });
}

/**
 * Восстанавливает удаленную запись при ошибке сервера.
 */
export function rollbackDeletedEntry(
  entries: DiaryEntry[],
  deletedEntry: DiaryEntry
): DiaryEntry[] {
  if (entries.some((e) => e.id === deletedEntry.id)) {
    return entries;
  }
  const restored: DiaryEntry = {
    ...deletedEntry,
    _syncStatus: 'saved',
  };
  return [restored, ...entries].sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    return (a.time || '').localeCompare(b.time || '');
  });
}

/**
 * Восстанавливает удаленные за день записи при ошибке сервера.
 */
export function rollbackDeletedDay(
  entries: DiaryEntry[],
  dayEntries: DiaryEntry[]
): DiaryEntry[] {
  const existingIds = new Set(entries.map((e) => e.id));
  const toAdd = dayEntries.filter((e) => !existingIds.has(e.id)).map((e) => ({
    ...e,
    _syncStatus: 'saved' as EntrySyncStatus,
  }));
  return [...toAdd, ...entries].sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    return (a.time || '').localeCompare(b.time || '');
  });
}

/**
 * Возвращает список всех несинхронизированных записей (ожидающих или с ошибкой).
 */
export function getPendingEntries(entries: DiaryEntry[]): DiaryEntry[] {
  return entries.filter(
    (e) => e._syncStatus === 'pending' || e._syncStatus === 'error'
  );
}
