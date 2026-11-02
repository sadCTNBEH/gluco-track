import React, { useRef } from 'react';
import { UserSettings, DiaryEntry } from '../types/diabetes';
import {
  X,
  Settings,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Server,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
  entries: DiaryEntry[];
  onImportData: (imported: DiaryEntry[]) => void;
  onOpenExcelImport: () => void;
  onResetToSample: () => void;
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
  onResetToSample,
  onClearAll,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                Настройки и управление данными
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Параметры ХЕ, резервная копия и запуск на сервере
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {/* Персональные данные */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Данные пациента
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                  ФИО пациента:
                </label>
                <input
                  type="text"
                  value={settings.patientName}
                  onChange={(e) => onUpdateSettings({ ...settings, patientName: e.target.value })}
                  placeholder="Иванов И.И."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500/40"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">
                  Грамм углеводов в 1 ХЕ:
                </label>
                <input
                  type="number"
                  step="1"
                  min="8"
                  max="15"
                  value={settings.xeRatio}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, xeRatio: Number(e.target.value) || 12 })
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500/40 font-mono font-bold"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Стандарт РФ: 12 г (в некоторых школах диабета 10 г или 11 г)
                </p>
              </div>
            </div>
          </div>

          {/* Резервное копирование и синхронизация */}
          <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Резервная копия и экспорт / импорт
            </h4>
            <p className="text-slate-500 leading-relaxed">
              Все записи сохраняются в защищенной базе данных на сервере и дублируются ежедневным бэкапом. Вы также можете вручную выгрузить копию или загрузить записи из таблицы Excel.
            </p>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  onClose();
                  onOpenExcelImport();
                }}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-97 text-white font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Импорт из Excel (.xlsx)</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 active:scale-97 text-white font-bold flex items-center gap-2 shadow-xs transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Экспорт в JSON</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Импорт из JSON</span>
              </button>
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
          <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Управление записями
            </h4>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  if (confirm('Восстановить демонстрационные данные дневника за 14 дней?')) {
                    onResetToSample();
                    onClose();
                  }
                }}
                className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> <span>Загрузить демо-данные</span>
              </button>

              <button
                onClick={() => {
                  if (confirm('ВНИМАНИЕ: Вы действительно хотите удалить ВСЕ записи из дневника? Это действие необратимо.')) {
                    onClearAll();
                    onClose();
                  }
                }}
                className="px-3.5 py-2 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> <span>Очистить дневник</span>
              </button>
            </div>
          </div>

          {/* Docker и Хостинг на сервере */}
          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
              <Server className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Развертывание на сервере (Docker)</span>
            </div>
            <p className="text-slate-500">
              Для обновления контейнера на сервере VPS выполните:
            </p>
            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-2xl select-all overflow-x-auto border border-slate-800">
              docker compose down &amp;&amp; docker compose up -d --build
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Внутренний порт приложения: 4999 (проксируется через Nginx на https://gluco.zduben.ru)
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold hover:from-teal-500 hover:to-emerald-500 shadow-md shadow-teal-500/25 transition cursor-pointer"
          >
            Готово
          </button>
        </div>

      </div>
    </div>
  );
};
