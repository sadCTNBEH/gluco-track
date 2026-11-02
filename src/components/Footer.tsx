import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

interface FooterProps {
  onOpenPolicy: () => void;
  onOpenMedical: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPolicy, onOpenMedical }) => {
  return (
    <footer className="print:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-auto py-6 px-4 sm:px-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-4 text-xs">
        
        {/* Top row: Brand & Legal links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-teal-600 dark:text-teal-400" />
            <span className="font-semibold">GlucoTrack</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Дневник самоконтроля</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
            <button
              type="button"
              onClick={onOpenPolicy}
              className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Политика обработки персональных данных (152-ФЗ)
            </button>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <button
              type="button"
              onClick={onOpenMedical}
              className="text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Медицинский отказ (323-ФЗ)
            </button>
          </div>
        </div>

        {/* Info badges */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Сервер и защита данных:</span>{' '}
              Обеспечивается защита персональных данных в соответствии с Конвенцией Совета Европы ETS № 108, ст. 12 152-ФЗ РФ и GDPR.
            </div>
          </div>

          <div className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Медицинское уведомление:</span>{' '}
              Сервис предназначен исключительно для самоконтроля. Не заменяет очный прием врача и не является указанием к изменению доз инсулина.
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};
