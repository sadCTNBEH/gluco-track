import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Database,
} from 'lucide-react';
import { DiaryEntry } from '../types/diabetes';
import type { ExcelImportResult } from '../utils/excelImport';
import { evaluateGlucose } from '../utils/diabetes';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: DiaryEntry[], replaceAll: boolean) => Promise<void>;
  xeRatio?: number;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  xeRatio = 12,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelImportResult | null>(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleReset = () => {
    setFile(null);
    setParseResult(null);
    setError(null);
    setReplaceAll(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleFileProcess = async (selectedFile: File) => {
    const nameLower = selectedFile.name.toLowerCase();
    const isValid =
      nameLower.endsWith('.xlsx') ||
      nameLower.endsWith('.xls') ||
      nameLower.endsWith('.csv') ||
      nameLower.endsWith('.tsv') ||
      nameLower.endsWith('.txt');

    if (!isValid) {
      setError('Пожалуйста, выберите файл с расширением .xlsx, .xls или .csv');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setParsing(true);

    try {
      const { parseExcelDiary } = await import('../utils/excelImport');
      const result = await parseExcelDiary(selectedFile, xeRatio);
      if (result.entries.length === 0) {
        setError(result.errors?.[0] || 'В файле не найдено строк с записями или даты не распознаны.');
      }
      setParseResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка разбора файла Excel / CSV';
      setError(message);
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileProcess(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileProcess(f);
  };

  const handleConfirmImport = async () => {
    if (!parseResult || parseResult.entries.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      await onImport(parseResult.entries, replaceAll);
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка импорта в базу данных';
      setError(message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Импорт из Excel / CSV"
      subtitle="Автоматическое распознавание замеров сахара, РинФаст, Тресиба, ХЕ и питания"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5 text-sm">
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Upload Dropzone */}
        {!parseResult ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500 ${
              isDragOver
                ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 bg-slate-50 dark:bg-slate-950'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>

            {parsing ? (
              <div className="flex items-center justify-center gap-2 text-teal-600 dark:text-teal-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="font-semibold text-sm">Обработка файла таблицы...</span>
              </div>
            ) : (
              <>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Перетащите сюда .xlsx или .csv файл или нажмите для выбора
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Поддерживаются колонки: Дата, Время, Глюкоза / Сахар, РинФаст, Тресиба, ХЕ, Углеводы, Калории, Заметки
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* File Info Card */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">
                    {file?.name}
                  </div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-300 font-mono">
                    Распознано записей: <strong>{parseResult.totalParsed}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline cursor-pointer p-1"
              >
                Выбрать другой
              </button>
            </div>

            {/* Preview Table */}
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Предпросмотр первых 5 записей:
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Дата</th>
                      <th className="py-2 px-3">Время</th>
                      <th className="py-2 px-3">Сахар</th>
                      <th className="py-2 px-3">ХЕ</th>
                      <th className="py-2 px-3">РинФаст</th>
                      <th className="py-2 px-3">Тресиба</th>
                      <th className="py-2 px-3">Заметки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                    {parseResult.entries.slice(0, 5).map((e) => {
                      const evalGl = evaluateGlucose(e.glucose);
                      return (
                        <tr key={e.id}>
                          <td className="py-2 px-3 font-mono tabular-nums">{e.date}</td>
                          <td className="py-2 px-3 font-mono tabular-nums">{e.time}</td>
                          <td className="py-2 px-3">
                            {e.glucose !== null ? (
                              <span
                                className={`font-mono font-bold tabular-nums ${
                                  evalGl ? evalGl.textClass : ''
                                }`}
                              >
                                {e.glucose.toFixed(1)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums">
                            {e.xe !== null ? e.xe : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums font-semibold text-sky-600 dark:text-sky-400">
                            {e.rinFast ?? '—'}
                          </td>
                          <td className="py-2 px-3 font-mono tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                            {e.tresiba ?? '—'}
                          </td>
                          <td className="py-2 px-3 truncate max-w-[150px] text-slate-500">
                            {e.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mode choice */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Режим импорта:
              </div>
              <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer min-h-[32px]">
                <input
                  type="radio"
                  name="importMode"
                  checked={!replaceAll}
                  onChange={() => setReplaceAll(false)}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500 accent-teal-600"
                />
                <span>Добавить записи к существующим в дневнике</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-400 cursor-pointer font-medium min-h-[32px]">
                <input
                  type="radio"
                  name="importMode"
                  checked={replaceAll}
                  onChange={() => setReplaceAll(true)}
                  className="w-4 h-4 text-rose-600 focus:ring-rose-500 accent-rose-600"
                />
                <span>Очистить дневник и загрузить только эти {parseResult.totalParsed} записей</span>
              </label>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" size="md" onClick={handleClose}>
            Отмена
          </Button>

          {parseResult && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleConfirmImport}
              disabled={importing || parseResult.entries.length === 0}
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Импортируем...</span>
                </>
              ) : (
                <>
                  <span>Сохранить в дневник ({parseResult.totalParsed})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
