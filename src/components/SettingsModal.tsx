import React, { useRef, useState } from 'react';
import { UserSettings, DiaryEntry } from '../types/diabetes';
import { exportEntriesToXLSX } from '../utils/excelExport';
import {
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  entries: DiaryEntry[];
  onImportData: (imported: DiaryEntry[]) => void;
  onOpenExcelImport: () => void;
  onClearAll: () => void;
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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // Экспорт данных в файл Excel (.xlsx)
  const handleExportXLSX = async () => {
    try {
      setExportingXlsx(true);
      await exportEntriesToXLSX(entries, settings);
    } catch (err) {
      console.error('Ошибка экспорта в Excel:', err);
      alert('Ошибка при экспорте в Excel');
    } finally {
      setExportingXlsx(false);
    }
  };

  // Экспорт данных в JSON файл
  const handleExportJSON = () => {
    const payload = {
      app: 'DiabetesSelfMonitoringDiary',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings,
      entries,
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diabetes_diary_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Импорт данных из JSON файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.entries)) {
          onImportData(parsed.entries);
          if (parsed.settings) {
            onUpdateSettings({ ...settings, ...parsed.settings });
          }
          alert(`Успешно импортировано ${parsed.entries.length} записей!`);
        } else if (Array.isArray(parsed)) {
          onImportData(parsed);
          alert(`Успешно импортировано ${parsed.length} записей!`);
        } else {
          alert('Некорректный формат файла резервной копии.');
        }
      } catch (err) {
        alert('Ошибка при чтении файла JSON: поврежденные данные.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Настройки и управление данными"
      subtitle="Параметры ХЕ, экспорт в Excel и резервные копии"
      maxWidth="max-w-xl"
    >
      <div className="space-y-6 text-xs">
        {/* Персональные данные */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Данные пациента
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="settings-patient-name"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
              >
                ФИО пациента:
              </label>
              <input
                id="settings-patient-name"
                type="text"
                value={settings.patientName}
                onChange={(e) => onUpdateSettings({ ...settings, patientName: e.target.value })}
                placeholder="Иванов И.И."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="settings-xe-ratio"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
              >
                Грамм углеводов в 1 ХЕ:
              </label>
              <input
                id="settings-xe-ratio"
                type="number"
                step="1"
                min="8"
                max="15"
                value={settings.xeRatio}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, xeRatio: Number(e.target.value) || 12 })
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Клинический стандарт РФ: 12 г (в некоторых школах 10 г или 11 г)
              </p>
            </div>
          </div>
        </div>

        {/* Экспорт и импорт в Excel / JSON */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Экспорт и импорт данных
          </h4>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
            Выгружайте записи в формате Excel (.xlsx) для врача или резервной копии, а также загружайте сохраненные файлы.
          </p>

          <div className="flex flex-wrap gap-2.5">
            {/* Экспорт в Excel (.xlsx) */}
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleExportXLSX}
              disabled={exportingXlsx || entries.length === 0}
              className="text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            >
              {exportingXlsx ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Формирование Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>Экспорт в Excel (.xlsx)</span>
                </>
              )}
            </Button>

            {/* Импорт из Excel (.xlsx) */}
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                onClose();
                onOpenExcelImport();
              }}
              className="text-slate-700 dark:text-slate-300"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Импорт из Excel</span>
            </Button>

            {/* Экспорт в JSON */}
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={handleExportJSON}
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Экспорт JSON</span>
            </Button>

            {/* Импорт из JSON */}
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Импорт JSON</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Быстрые действия с базой */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Очистка данных
          </h4>
          <div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                if (
                  confirm(
                    'ВНИМАНИЕ: Вы действительно хотите удалить ВСЕ записи из дневника? Это действие необратимо.'
                  )
                ) {
                  onClearAll();
                  onClose();
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистить дневник</span>
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="primary" size="md" onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
    </Modal>
  );
};
