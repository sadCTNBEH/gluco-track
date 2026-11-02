import React, { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { DiaryEntry } from '../types/diabetes';
import { parseExcelDiary, ExcelImportResult } from '../utils/excelImport';
import { evaluateGlucose } from '../utils/diabetes';

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

  if (!isOpen) return null;

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
      const result = await parseExcelDiary(selectedFile, xeRatio);
      if (result.entries.length === 0) {
        setError('В файле не найдено строк с записями или дата не распознана.');
      }
      setParseResult(result);
    } catch (err: any) {
      setError(err?.message || 'Ошибка разбора файла Excel / CSV');
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
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Ошибка импорта в базу данных');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Импорт из Excel / CSV (.xlsx, .csv)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Автоматическое распознавание замеров сахара, РинФаст, Тресиба, ХЕ и питания
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
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
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
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-teal-500 bg-slate-50 dark:bg-slate-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 mx-auto flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>

              {parsing ? (
                <div className="flex items-center justify-center gap-2 text-teal-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-semibold text-sm">Чтение и парсинг файла таблицы...</span>
                </div>
              ) : (
                <>
                  <p className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                    Перетащите сюда .xlsx или .csv файл или нажмите для выбора
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Поддерживаются таблицы с колонками: Дата, Время, Глюкоза / Сахар, РинФаст, Тресиба, ХЕ, Углеводы, Калории, Заметки
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info Card */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-xs">
                      {file?.name}
                    </div>
                    <div className="text-[11px] text-teal-700 dark:text-teal-300">
                      Распознано записей: <strong>{parseResult.totalParsed}</strong>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setParseResult(null);
                    setFile(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline cursor-pointer"
                >
                  Выбрать другой файл
                </button>
              </div>

              {/* Preview Table */}
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Предпросмотр первых 5 записей:
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-48">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold sticky top-0">
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
                            <td className="py-2 px-3 font-mono">{e.date}</td>
                            <td className="py-2 px-3 font-mono">{e.time}</td>
                            <td className="py-2 px-3">
                              {e.glucose !== null ? (
                                <span className={`px-1.5 py-0.5 rounded font-bold ${evalGl?.textClass || ''}`}>
                                  {e.glucose}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="py-2 px-3">{e.xe !== null ? e.xe : '—'}</td>
                            <td className="py-2 px-3 font-bold text-blue-600">{e.rinFast ?? '—'}</td>
                            <td className="py-2 px-3 font-bold text-purple-600">{e.tresiba ?? '—'}</td>
                            <td className="py-2 px-3 truncate max-w-[150px]">{e.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mode choice */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Режим импорта:
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={!replaceAll}
                    onChange={() => setReplaceAll(false)}
                    className="accent-teal-600"
                  />
                  <span>Добавить записи к существующим в дневнике</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name="importMode"
                    checked={replaceAll}
                    onChange={() => setReplaceAll(true)}
                    className="accent-rose-600"
                  />
                  <span>Очистить дневник и загрузить только эти {parseResult.totalParsed} записей</span>
                </label>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 cursor-pointer"
          >
            Отмена
          </button>

          {parseResult && (
            <button
              onClick={handleConfirmImport}
              disabled={importing || parseResult.entries.length === 0}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-teal-600/20 cursor-pointer transition"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Импортируем в базу...</span>
                </>
              ) : (
                <>
                  <span>Сохранить в дневник ({parseResult.totalParsed})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
