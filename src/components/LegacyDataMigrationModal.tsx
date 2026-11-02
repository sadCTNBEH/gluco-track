import React, { useState } from 'react';
import { Database, Download, Upload, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { exportLegacyDataBackup } from '../utils/userStorage';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface LegacyDataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  legacyEntries: DiaryEntry[];
  legacySettings: Partial<UserSettings> | null;
  onConfirmMigration: () => Promise<void>;
  onDiscardLegacy: () => void;
}

export const LegacyDataMigrationModal: React.FC<LegacyDataMigrationModalProps> = ({
  isOpen,
  onClose,
  username,
  legacyEntries,
  legacySettings,
  onConfirmMigration,
  onDiscardLegacy,
}) => {
  const [migrating, setMigrating] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [downloadedBackup, setDownloadedBackup] = useState(false);

  const handleDownloadBackup = () => {
    exportLegacyDataBackup(legacyEntries, legacySettings);
    setDownloadedBackup(true);
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      await onConfirmMigration();
      onClose();
    } catch (err) {
      console.error('Ошибка миграции данных:', err);
    } finally {
      setMigrating(false);
    }
  };

  const handleDiscard = () => {
    onDiscardLegacy();
    setShowDiscardConfirm(false);
    onClose();
  };

  if (!isOpen || legacyEntries.length === 0) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Локальные данные без авторизации"
      subtitle="Безопасная миграция ранее сохраненных замеров"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs sm:text-sm">
        <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 flex items-start gap-3">
          <Database className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-slate-900 dark:text-white text-xs">
              На этом устройстве найдено записей: <strong>{legacyEntries.length}</strong>
            </div>
            <p className="text-[11px] text-teal-900 dark:text-teal-200 leading-relaxed">
              Обнаружены замеры сахара и дозы инсулина, созданные в офлайн-режиме или в предыдущей версии приложения.
              В целях безопасности они <strong>не добавляются автоматически</strong>, чтобы исключить смешивание с чужими данными.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Вы хотите перенести эти записи в защищенный аккаунт <strong>{username}</strong>?
        </p>

        {downloadedBackup && (
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Резервная копия успешно загружена в файл JSON.</span>
          </div>
        )}

        {showDiscardConfirm ? (
          <div className="p-3.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 space-y-2">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-semibold text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Вы уверены, что хотите удалить эти локальные записи?</span>
            </div>
            <p className="text-[11px] text-rose-700 dark:text-rose-300">
              Если это не ваши замеры (например, на общем компьютере), вы можете безопасно удалить их. Это действие необратимо.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={handleDiscard}
                className="text-xs"
              >
                Да, удалить старый кэш
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardConfirm(false)}
                className="text-xs"
              >
                Отмена
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadBackup}
              title="Скачать файл перед любыми действиями"
              className="text-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-teal-600" />
              <span>Скачать копию</span>
            </Button>
            {!showDiscardConfirm && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowDiscardConfirm(true)}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={migrating}
              className="text-xs"
            >
              Напомнить позже
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleMigrate}
              disabled={migrating}
              className="text-xs flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{migrating ? 'Импортируем...' : 'Импортировать в аккаунт'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
