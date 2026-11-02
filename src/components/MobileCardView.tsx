import React from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Calendar,
  Syringe,
  Utensils,
  Flame,
  Edit2,
  Trash2,
  Clock,
  Plus,
} from 'lucide-react';

interface MobileCardViewProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
}

export const MobileCardView: React.FC<MobileCardViewProps> = ({
  entries,
  onAddClick,
  onEditClick,
  onDeleteClick,
}) => {
  const groupedDays = groupEntriesByDay(entries);

  if (groupedDays.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-500 mb-4">В дневнике пока нет записей</p>
        <button
          onClick={onAddClick}
          className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" /> Добавить первый замер
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedDays.map(({ date, entries: dayEntries, summary }) => {
        const dayGlucoseEval = summary.avgGlucose ? evaluateGlucose(summary.avgGlucose) : null;

        return (
          <div key={date} className="space-y-3">
            {/* Карточка сводки дня */}
            <div className="bg-gradient-to-r from-teal-500/10 via-slate-50 to-slate-100 dark:from-teal-950/30 dark:via-slate-800/60 dark:to-slate-800/80 p-3.5 rounded-2xl border border-teal-500/20 dark:border-teal-800/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                    {formatDateRussian(date, false)}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {summary.entriesCount} зап.
                </span>
              </div>

              {/* Мини-сводка за сутки */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                {/* Средний сахар */}
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  <div className="text-[10px] text-slate-400 uppercase font-medium">Ср. сахар</div>
                  <div className={`font-bold text-sm ${dayGlucoseEval ? dayGlucoseEval.textClass : 'text-slate-800'}`}>
                    {summary.avgGlucose !== null ? `${summary.avgGlucose}` : '—'}
                  </div>
                </div>

                {/* РинФаст */}
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-blue-200/50 dark:border-blue-900/40">
                  <div className="text-[10px] text-blue-500 uppercase font-medium">РинФаст</div>
                  <div className="font-bold text-sm text-blue-700 dark:text-blue-300">
                    {summary.totalRinFast} <span className="text-[10px] font-normal">ед</span>
                  </div>
                </div>

                {/* Тресиба / Ккал */}
                <div className="bg-white/80 dark:bg-slate-900/60 p-2 rounded-xl border border-purple-200/50 dark:border-purple-900/40">
                  <div className="text-[10px] text-purple-500 uppercase font-medium">Тресиба</div>
                  <div className="font-bold text-sm text-purple-700 dark:text-purple-300">
                    {summary.totalTresiba > 0 ? (
                      <>{summary.totalTresiba} <span className="text-[10px] font-normal">ед</span></>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
              </div>

              {/* Нижняя строчка сводки дня: Калории и ХЕ */}
              {(summary.totalCalories > 0 || summary.totalXE > 0) && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 px-1">
                  <span>
                    Всего за день: <strong>{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)
                  </span>
                  <span>
                    <strong>{summary.totalCalories} ккал</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Карточки записей дня */}
            <div className="space-y-2.5">
              {dayEntries.map((entry) => {
                const evalResult = evaluateGlucose(entry.glucose);

                return (
                  <div
                    key={entry.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    {/* Верхняя строка карточки: Время, контекст, глюкоза + оценка */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-mono font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          {entry.time}
                        </div>
                        {entry.tag && entry.tag !== 'other' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {entry.tag === 'breakfast'
                              ? 'Завтрак'
                              : entry.tag === 'lunch'
                              ? 'Обед'
                              : entry.tag === 'dinner'
                              ? 'Ужин'
                              : entry.tag === 'fasting'
                              ? 'Натощак'
                              : entry.tag === 'snack'
                              ? 'Перекус'
                              : entry.tag === 'bedtime'
                              ? 'На ночь'
                              : entry.tag === 'correction'
                              ? 'ДПС'
                              : ''}
                          </span>
                        )}
                      </div>

                      {/* Кнопки действий */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditClick(entry)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Удалить эту запись?')) onDeleteClick(entry.id);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Блок сахара: крупный индикатор */}
                    {entry.glucose !== null ? (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <div className="flex items-baseline gap-1.5">
                          <span className={`text-2xl font-black font-mono tracking-tight ${evalResult ? evalResult.textClass : 'text-slate-800'}`}>
                            {entry.glucose.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-400">ммоль/л</span>
                        </div>
                        {evalResult && (
                          <span className={`px-2.5 py-1 rounded-full text-xs border ${evalResult.badgeClass} flex items-center gap-1`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {evalResult.shortLabel}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Инсулины и Питание */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {/* РинФаст */}
                      {entry.rinFast !== null && entry.rinFast > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 font-bold">
                          <Syringe className="w-3.5 h-3.5" />
                          <span>РинФаст: {entry.rinFast} ед</span>
                        </div>
                      )}

                      {/* Тресиба */}
                      {entry.tresiba !== null && entry.tresiba > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 font-bold">
                          <Syringe className="w-3.5 h-3.5" />
                          <span>Тресиба: {entry.tresiba} ед</span>
                        </div>
                      )}

                      {/* Углеводы и ХЕ */}
                      {((entry.carbs !== null && entry.carbs > 0) || (entry.xe !== null && entry.xe > 0)) && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-300 font-bold">
                          <Utensils className="w-3.5 h-3.5" />
                          <span>
                            {entry.xe ? `${entry.xe} ХЕ` : ''} {entry.carbs ? `(${entry.carbs} г)` : ''}
                          </span>
                        </div>
                      )}

                      {/* Калории */}
                      {entry.calories !== null && entry.calories > 0 && (
                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold">
                          <Flame className="w-3.5 h-3.5" />
                          <span>{entry.calories} ккал</span>
                        </div>
                      )}
                    </div>

                    {/* Заметки */}
                    {entry.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
