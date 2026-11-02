import React from 'react';
import { UserSettings, DiaryEntry } from '../types/diabetes';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import {
  InsulinTherapySection,
  ClinicalThresholdsSection,
  DataManagementSection,
} from './settings';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  entries: DiaryEntry[];
  onImportData: (imported: DiaryEntry[]) => void;
  onOpenExcelImport: () => void;
  onClearAll: () => void;
  onDeduplicate?: () => Promise<void> | void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  entries,
  onImportData,
  onOpenExcelImport,
  onClearAll,
  onDeduplicate,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Настройки и управление данными"
      subtitle="Параметры ХЕ, инсулины, экспорт и резервные копии"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 text-xs">
        {/* Данные пациента, ХЕ и препараты инсулина */}
        <InsulinTherapySection
          settings={settings}
          onUpdateSettings={onUpdateSettings}
        />

        {/* Целевые уровни сахара в крови и клинические маркеры */}
        <ClinicalThresholdsSection
          settings={settings}
          onUpdateSettings={onUpdateSettings}
        />

        {/* Экспорт, импорт, очистка дубликатов и хранилище */}
        <DataManagementSection
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          entries={entries}
          onImportData={onImportData}
          onOpenExcelImport={onOpenExcelImport}
          onClearAll={onClearAll}
          onDeduplicate={onDeduplicate}
          onClose={onClose}
          isOpen={isOpen}
        />

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onClose}
          >
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
};
