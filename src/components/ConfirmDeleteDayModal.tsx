import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatDateRussian } from '../utils/diabetes';
import { ConfirmDialog } from './ui/ConfirmDialog';

interface ConfirmDeleteDayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
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
  if (!date) return null;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Удаление записей дня"
      subtitle="Необратимая операция очистки замеров"
      confirmText={`Удалить день (${count})`}
      cancelText="Отмена"
      isDestructive
      icon={<Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
      maxWidth="md"
    >
      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
        Вы действительно хотите удалить <strong>все замеры</strong> за выбранную дату?
      </p>

      <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="font-semibold text-sm text-slate-900 dark:text-white capitalize">
          {formatDateRussian(date)}
        </div>
        <div className="text-xs text-rose-600 dark:text-rose-400 font-mono mt-1">
          Будет удалено записей: <strong>{count}</strong>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Все замеры гликемии, дозы РинФаст и Тресиба, данные по ХЕ и заметки за этот день будут безвозвратно удалены из базы данных.
      </p>
    </ConfirmDialog>
  );
};
