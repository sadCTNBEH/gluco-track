import React, { useRef, useState, useEffect } from 'react';
import { UserSettings, DiaryEntry } from '../../types/diabetes';
import {
  Download,
  Upload,
  Trash2,
  FileSpreadsheet,
  Loader2,
  AlertTriangle,
  Copy,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { getTodayDateString } from '../../utils/dateTime';

export interface DataManagementSectionProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  entries: DiaryEntry[];
  onImportData: (imported: DiaryEntry[]) => void;
  onOpenExcelImport: () => void;
  onClearAll: () => void;
  onDeduplicate?: () => Promise<void> | void;
  onClose: () => void;
  isOpen?: boolean;
}

export const DataManagementSection: React.FC<DataManagementSectionProps> = React.memo(({
  settings,
  onUpdateSettings,
  entries,
  onImportData,
  onOpenExcelImport,
  onClearAll,
  onDeduplicate,
  onClose,
  isOpen = true,
}) => {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Сбрасываем режим подтверждения очистки при закрытии модального окна
  useEffect(() => {
    if (!isOpen) {
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  // Экспорт данных в файл Excel (.xlsx) с динамической загрузкой модуля
  const handleExportXLSX = async () => {
    try {
      setExportingXlsx(true);
      const { exportEntriesToXLSX } = await import('../../utils/excelExport');
      await exportEntriesToXLSX(entries, settings);
    } catch (err) {
      console.error('Ошибка экспорта в Excel:', err);
      toast.error('Ошибка при экспорте в Excel');
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
    a.download = `diabetes_diary_backup_${getTodayDateString()}.json`;
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
          toast.success(`Успешно импортировано ${parsed.entries.length} записей!`);
        } else if (Array.isArray(parsed)) {
          onImportData(parsed);
          toast.success(`Успешно импортировано ${parsed.length} записей!`);
        } else {
          toast.error('Некорректный формат файла резервной копии.');
        }
      } catch (err) {
        toast.error('Ошибка при чтении файла JSON: поврежденные данные.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
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

      {/* Дедупликация повторов */}
      {onDeduplicate && (
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Очистка дубликатов
            </h4>
            <span className="text-[10px] text-slate-400">Объединение повторов на одно время</span>
          </div>
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Найти и объединить дублирующиеся записи</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Сохраняет наиболее полные данные по сахару, дозам и заметкам</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await onDeduplicate();
                toast.success('Дубликаты успешно объединены и удалены!');
              }}
              className="whitespace-nowrap shrink-0 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-300 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Удалить дубликаты</span>
            </Button>
          </div>
        </div>
      )}

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
              className="w-full sm:w-auto shrink-0 whitespace-nowrap border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100/70 dark:hover:bg-rose-950/40 flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span className="shrink-0">Очистить дневник</span>
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
                className="whitespace-nowrap shrink-0 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="shrink-0">Да, удалить всё</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setShowClearConfirm(false)}
                className="whitespace-nowrap shrink-0"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
});

DataManagementSection.displayName = 'DataManagementSection';
