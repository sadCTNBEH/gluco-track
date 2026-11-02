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
  Activity,
  FlaskConical,
  Sparkles,
  Copy,
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

        {/* Целевые уровни сахара в крови */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Целевой диапазон сахара в крови
            </h4>
            <span className="text-[10px] text-slate-400">Границы нормы и гипо</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="settings-hypo-threshold"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
              >
                Порог гипогликемии (низкий сахар ≤):
              </label>
              <div className="relative">
                <input
                  id="settings-hypo-threshold"
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="6.0"
                  value={settings.hypoThreshold ?? 3.9}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateSettings({
                        ...settings,
                        hypoThreshold: val,
                        targetLow: Number((val + 0.1).toFixed(1)),
                      });
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-16"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  ммоль/л
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                По умолчанию: 3.9 (значения ≤ этого порога считаются гипогликемией)
              </p>
            </div>

            <div>
              <label
                htmlFor="settings-target-high"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
              >
                Верхний порог (высокий сахар &gt;):
              </label>
              <div className="relative">
                <input
                  id="settings-target-high"
                  type="number"
                  step="0.1"
                  min="6.0"
                  max="15.0"
                  value={settings.targetHigh ?? 9.9}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      onUpdateSettings({ ...settings, targetHigh: val });
                    }
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-16"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  ммоль/л
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                По умолчанию: 9.9 (значения &gt; этого порога считаются повышенными)
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between">
            <span className="font-medium">Целевой диапазон нормы:</span>
            <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
              {settings.targetLow ?? Number(((settings.hypoThreshold ?? 3.9) + 0.1).toFixed(1))} – {settings.targetHigh ?? 9.9} ммоль/л
            </span>
          </div>
        </div>

        {/* Клинические маркеры (eHbA1c и ACR) для отчета врача */}
        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Клинические маркеры (для отчета врача)
            </h4>
            <span className="text-[10px] text-slate-400">Лабораторные анализы</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="settings-ehba1c"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
              >
                eHbA1c (гликированный гемоглобин):
              </label>
              <div className="relative">
                <input
                  id="settings-ehba1c"
                  type="number"
                  step="0.1"
                  min="3.0"
                  max="16.0"
                  value={settings.eHbA1c ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                    onUpdateSettings({ ...settings, eHbA1c: val });
                  }}
                  placeholder="Например: 6.5"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-12"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  %
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Лабораторное или целевое значение (отображается в отчете)
              </p>
            </div>

            <div>
              <label
                htmlFor="settings-acr"
                className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
              >
                ACR (альбумин/креатинин мочи):
              </label>
              <div className="relative">
                <input
                  id="settings-acr"
                  type="number"
                  step="0.1"
                  min="0.0"
                  max="50.0"
                  value={settings.acr ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : parseFloat(e.target.value);
                    onUpdateSettings({ ...settings, acr: val });
                  }}
                  placeholder="Например: 2.1"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-22"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  мг/ммоль
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Соотношение альбумин/креатинин в утренней порции мочи (норма &lt; 3.0)
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
                  alert('Дубликаты успешно объединены и удалены!');
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
