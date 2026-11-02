import React from 'react';
import { ShieldCheck, HeartPulse, FileText, AlertTriangle, Database } from 'lucide-react';

interface FooterProps {
  onOpenPolicy: () => void;
  onOpenMedical: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenPolicy, onOpenMedical }) => {
  return (
    <footer className="print:hidden border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm mt-auto py-6 px-4 sm:px-6 transition-colors">
      <div className="max-w-7xl mx-auto space-y-4 text-xs">
        
        {/* Верхняя строка: Копирайт, локализация РФ и юридические ссылки */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
          
          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>Дневник Диабета &amp; Самоконтроля</span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500 text-[11px]">gluco.zduben.ru</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
            <button
              onClick={onOpenPolicy}
              className="hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
            >
              Политика обработки персональных данных (152-ФЗ)
            </button>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <button
              onClick={onOpenMedical}
              className="hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
            >
              Медицинский дисклеймер (323-ФЗ)
            </button>
          </div>

        </div>

        {/* Информационные плашки */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          
          <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <Database className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Локализация данных в РФ:</span>{' '}
              База данных и сервер размещены на территории Российской Федерации в полном соответствии со ст. 18.5 Федерального закона № 152-ФЗ.
            </div>
          </div>

          <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Медицинское уведомление:</span>{' '}
              Сервис предназначен исключительно для самоконтроля. Не заменяет очный прием врача и не является руководством к изменению доз инсулина.
            </div>
          </div>

        </div>

      </div>
    </footer>
  );
};
