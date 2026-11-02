import React from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Calendar,
  Syringe,
  Moon,
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
  onDeleteDayClick?: (date: string, count: number) => void;
}

const TAG_CONFIG: Record<string, { label: string; className: string }> = {
  fasting: { label: 'Натощак', className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  breakfast: { label: 'Завтрак', className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
  lunch: { label: 'Обед', className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  dinner: { label: 'Ужин', className: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
  snack: { label: 'Перекус', className: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800' },
  bedtime: { label: 'На ночь', className: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800' },
  correction: { label: 'Коррекция (ДПС)', className: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
  other: { label: 'Другое', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
};

export const MobileCardView: React.FC<MobileCardViewProps> = ({
  entries,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onDeleteDayClick,
}) => {
  const groupedDays = groupEntriesByDay(entries);

  if (groupedDays.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-xs">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">В дневнике пока нет записей</p>
        <button
          onClick={onAddClick}
          className="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 active:bg-teal-700 transition cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" /> Добавить первое измерение
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupedDays.map(({ date, entries: dayEntries, summary }) => {
        const dayGlucoseEval = summary.avgGlucose ? evaluateGlucose(summary.avgGlucose) : null;

        return (
          <div key={date} className="space-y-2.5">
            
            {/* Карточка сводки дня */}
            <div className="bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 capitalize">
                    {formatDateRussian(date, false)}
                  </h4>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ({summary.entriesCount})
                  </span>
                </div>

                {onDeleteDayClick && (
                  <button
                    onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Удалить весь день"
                    aria-label="Удалить день"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Мини-сводка за сутки */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                
                {/* Средний сахар */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Ср. сахар</div>
                  <div className={`font-mono font-bold text-sm ${dayGlucoseEval ? dayGlucoseEval.textClass : 'text-slate-800 dark:text-slate-200'}`}>
                    {summary.avgGlucose !== null ? `${summary.avgGlucose}` : '—'}
                  </div>
                </div>

                {/* РинФаст */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-blue-200/60 dark:border-blue-900/40">
                  <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">РинФаст</div>
                  <div className="font-mono font-bold text-sm text-blue-800 dark:text-blue-300">
                    {summary.totalRinFast} <span className="text-xs font-normal">ед</span>
                  </div>
                </div>

                {/* Тресиба */}
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-purple-200/60 dark:border-purple-900/40">
                  <div className="text-xs text-purple-700 dark:text-purple-300 font-medium">Тресиба</div>
                  <div className="font-mono font-bold text-sm text-purple-800 dark:text-purple-300">
                    {summary.totalTresiba > 0 ? (
                      <>{summary.totalTresiba} <span className="text-xs font-normal">ед</span></>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>

              </div>

              {/* Нижняя строчка: ХЕ и Калории */}
              {(summary.totalCalories > 0 || summary.totalXE > 0) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 font-mono px-1">
                  <span>
                    Всего: <strong className="text-slate-900 dark:text-slate-100">{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)
                  </span>
                  <span>
                    <strong>{summary.totalCalories} ккал</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Карточки записей дня */}
            <div className="space-y-2">
              {dayEntries.map((entry) => {
                const evalResult = evaluateGlucose(entry.glucose);
                const tagInfo = entry.tag && entry.tag !== 'other' ? TAG_CONFIG[entry.tag] : null;

                return (
                  <div
                    key={entry.id}
                    className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5"
                  >
                    {/* Верх: Время, тег, глюкоза + оценка */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{entry.time}</span>
                          {tagInfo && (
                            <span className={`text-xs px-2 py-0.5 rounded-md font-sans font-medium ${tagInfo.className}`}>
                              {tagInfo.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Глюкоза с бейджем */}
                      <div className="text-right">
                        {entry.glucose !== null ? (
                          <div className="flex items-center gap-1">
                            <span className={`font-mono text-lg font-bold ${evalResult ? evalResult.textClass : 'text-slate-900 dark:text-slate-100'}`}>
                              {entry.glucose.toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-400 font-sans">ммоль</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                        )}
                        {evalResult && (
                          <div className="flex justify-end mt-0.5">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.2 rounded-md border ${evalResult.badgeClass} font-medium`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                              {evalResult.shortLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Средняя строка: Инсулины и ХЕ чипы */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                      {entry.rinFast !== null && entry.rinFast > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                          <Syringe className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                          РинФаст {entry.rinFast} ед
                        </span>
                      )}

                      {entry.tresiba !== null && entry.tresiba > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                          <Moon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                          Тресиба {entry.tresiba} ед
                        </span>
                      )}

                      {entry.xe !== null && entry.xe > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold">
                          <Utensils className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                          {entry.xe} ХЕ ({entry.carbs} г)
                        </span>
                      )}

                      {entry.calories !== null && entry.calories > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold">
                          <Flame className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                          {entry.calories} ккал
                        </span>
                      )}
                    </div>

                    {/* Заметки / комментарии */}
                    {entry.notes && (
                      <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed">
                        {entry.notes}
                      </p>
                    )}

                    {/* Нижняя полоса действий */}
                    <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => onEditClick(entry)}
                        className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>Изменить</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Удалить эту запись?')) {
                            onDeleteClick(entry.id);
                          }
                        }}
                        className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Удалить</span>
                      </button>
                    </div>

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
