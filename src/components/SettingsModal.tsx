import React, { useRef, useState } from 'react';
import { UserSettings, DiaryEntry } from '../types/diabetes';
import { exportEntriesToXLSX } from '../utils/excelExport';
import {
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  Loader2,
  Syringe,
  Moon,
  AlertTriangle,
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
  const [showClearConfirm, setShowClearConfirm] = useState(false);

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
      onClose={() => {
        setShowClearConfirm(false);
        onClose();
      }}
      title="Настройки и управление данными"
      subtitle="Параметры ХЕ, инсулины, экспорт и резервные копии"
      maxWidth="max-w-xl"
    >
      <div className="space-y-5 text-xs">
        
        {/* Персональные данные */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Данные пациента и углеводы
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

        {/* Названия используемых инсулинов */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Используемые препараты инсулина
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="settings-bolus-name"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5"
              >
                <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Болюсный (короткий на еду):
              </label>
              <input
                id="settings-bolus-name"
                type="text"
                value={settings.bolusName ?? 'РинФаст'}
                onChange={(e) => onUpdateSettings({ ...settings, bolusName: e.target.value })}
                placeholder="Например: РинФаст, НовоРапид, Хумалог"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                По умолчанию: РинФаст
              </p>
            </div>

            <div>
              <label
                htmlFor="settings-basal-name"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5"
              >
                <Moon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Базальный (длинный на ночь):
              </label>
              <input
                id="settings-basal-name"
                type="text"
                value={settings.basalName ?? 'Тресиба'}
                onChange={(e) => onUpdateSettings({ ...settings, basalName: e.target.value })}
                placeholder="Например: Тресиба, Лантус, Туджео"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                По умолчанию: Тресиба
              </p>
            </div>
          </div>
        </div>

        {/* Экспорт и импорт Excel (.xlsx) */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Таблицы Excel (.xlsx)
            </h4>
            <span className="text-[10px] text-slate-400">Для врача и анализа</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleExportXLSX}
              disabled={exportingXlsx || entries.length === 0}
              className="w-full justify-center border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
            >
              {exportingXlsx ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Формирование...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Экспорт в Excel (.xlsx)</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => {
                onClose();
                onOpenExcelImport();
              }}
              className="w-full justify-center border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
            >
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Импорт из Excel (.xlsx)</span>
            </Button>
          </div>
        </div>

        {/* Экспорт и импорт JSON (Резервная копия) */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Резервные копии JSON
            </h4>
            <span className="text-[10px] text-slate-400">Полный бэкап настроек и данных</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleExportJSON}
              disabled={entries.length === 0}
              className="w-full justify-center border-slate-300 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/30"
            >
              <Download className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Экспорт в JSON</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-center border-slate-300 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/30"
            >
              <Upload className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Импорт из JSON</span>
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

        {/* Очистка данных с подтверждением */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Управление хранилищем
          </h4>

          {!showClearConfirm ? (
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-rose-800 dark:text-rose-300">
                <span className="font-semibold block mb-0.5">Очистить дневник самоконтроля</span>
                Безвозвратное удаление всех {entries.length} записей из базы данных SQLite.
              </div>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setShowClearConfirm(true)}
                disabled={entries.length === 0}
                className="w-full sm:w-auto shrink-0 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100/70 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-4 h-4" />
                <span>Очистить дневник</span>
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/40 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs sm:text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Вы уверены, что хотите удалить все {entries.length} записей?</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                Это действие необратимо. Будут удалены все замеры сахара, дозировки инсулина и история питания.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="danger"
                  size="md"
                  onClick={() => {
                    onClearAll();
                    setShowClearConfirm(false);
                    onClose();
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Да, удалить всё</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              setShowClearConfirm(false);
              onClose();
            }}
          >
            Готово
          </Button>
        </div>

      </div>
    </Modal>
  );
};
