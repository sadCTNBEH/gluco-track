import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { formatDateRussian } from '../utils/diabetes';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

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
  if (!date) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Удаление записей дня"
      subtitle="Необратимая операция очистки замеров"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs sm:text-sm">
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

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            Отмена
          </Button>

          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={onConfirm}
            className="flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Удалить день ({count})</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
