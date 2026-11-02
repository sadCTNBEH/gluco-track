import React from 'react';
import { AlertCircle, CloudOff, RefreshCw, X, Loader2 } from 'lucide-react';

interface SyncStatusBannerProps {
  pendingCount: number;
  syncError: string | null;
  isSyncing: boolean;
  onRetry: () => void;
  onDismissError: () => void;
}

export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  pendingCount,
  syncError,
  isSyncing,
  onRetry,
  onDismissError,
}) => {
  if (!syncError && pendingCount === 0) {
    return null;
  }

  // 1. Отображение ошибки синхронизации
  if (syncError) {
    return (
      <div
        role="alert"
        className="mb-4 p-3.5 sm:p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn"
      >
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-medium leading-relaxed">{syncError}</span>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>{isSyncing ? 'Синхронизация...' : 'Повторить'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onDismissError}
            className="p-1.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition cursor-pointer"
            aria-label="Закрыть уведомление"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Отображение наличия несинхронизированных локальных записей (офлайн-режим)
  const entryWord =
    pendingCount === 1
      ? 'запись сохранена'
      : pendingCount < 5
      ? 'записи сохранены'
      : 'записей сохранено';

  return (
    <div
      role="status"
      className="mb-4 p-3 sm:p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 animate-fadeIn"
    >
      <div className="flex items-center gap-2 text-xs sm:text-sm">
        <CloudOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="font-medium">
          Офлайн-режим: <strong>{pendingCount}</strong> {entryWord} локально в дневнике.
        </span>
      </div>

      <button
        type="button"
        onClick={onRetry}
        disabled={isSyncing}
        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer self-end sm:self-auto shrink-0"
      >
        {isSyncing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        <span>{isSyncing ? 'Синхронизация...' : 'Синхронизировать'}</span>
      </button>
    </div>
  );
};
