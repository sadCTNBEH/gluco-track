import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { formatDateRussian } from '../utils/diabetes';

interface ConfirmDeleteDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  date: string;
  count: number;
}

export const ConfirmDeleteDayModal: React.FC<ConfirmDeleteDayModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  date,
  count,
}) => {
  if (!isOpen || !date) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Удаление дня
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs sm:text-sm">
          <p className="text-slate-700 dark:text-slate-300">
            Вы действительно хотите удалить <strong>все записи</strong> за день:
          </p>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="font-bold text-sm text-slate-900 dark:text-white capitalize">
              {formatDateRussian(date)}
            </div>
            <div className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1">
              Будет удалено записей: <strong>{count}</strong>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Это действие необратимо. Все замеры сахара, дозы инсулинов и данные по питанию за эту дату будут стёрты из базы данных.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Удалить весь день</span>
          </button>
        </div>

      </div>
    </div>
  );
};
