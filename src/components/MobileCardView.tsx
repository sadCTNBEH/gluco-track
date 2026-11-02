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
  Sparkles,
  Award,
} from 'lucide-react';

interface MobileCardViewProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
  onDeleteDayClick?: (date: string, count: number) => void;
}

const TAG_LABELS: Record<string, { label: string; class: string }> = {
  breakfast: { label: 'Завтрак', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  lunch: { label: 'Обед', class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  dinner: { label: 'Ужин', class: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20' },
  snack: { label: 'Перекус', class: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' },
  fasting: { label: 'Натощак', class: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20' },
  bedtime: { label: 'На ночь', class: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' },
  correction: { label: 'ДПС', class: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
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
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-8 text-center border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-medium">В дневнике пока нет записей</p>
        <button
          onClick={onAddClick}
          className="w-full py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-teal-500/20 active:scale-97 transition cursor-pointer"
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
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white capitalize">
                      {formatDateRussian(date, false)}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {summary.entriesCount} {summary.entriesCount === 1 ? 'замер' : 'замеров'}
                    </span>
                  </div>
                </div>

                {onDeleteDayClick && (
                  <button
                    onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    title="Удалить весь день"
                    aria-label="Удалить день"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Мини-сводка за сутки в виде сетки чипов */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                
                {/* Средний сахар */}
                <div className="bg-slate-50/80 dark:bg-slate-800/60 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Ср. сахар</div>
                  <div className={`font-mono font-extrabold text-sm ${dayGlucoseEval ? dayGlucoseEval.textClass : 'text-slate-800'}`}>
                    {summary.avgGlucose !== null ? `${summary.avgGlucose}` : '—'}
                  </div>
                </div>

                {/* РинФаст */}
                <div className="bg-blue-500/10 dark:bg-blue-950/30 p-2.5 rounded-2xl border border-blue-500/20">
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-semibold">РинФаст</div>
                  <div className="font-mono font-extrabold text-sm text-blue-700 dark:text-blue-300">
                    {summary.totalRinFast} <span className="text-[10px] font-normal">ед</span>
                  </div>
                </div>

                {/* Тресиба */}
                <div className="bg-purple-500/10 dark:bg-purple-950/30 p-2.5 rounded-2xl border border-purple-500/20">
                  <div className="text-[10px] text-purple-600 dark:text-purple-400 uppercase font-semibold">Тресиба</div>
                  <div className="font-mono font-extrabold text-sm text-purple-700 dark:text-purple-300">
                    {summary.totalTresiba > 0 ? (
                      <>{summary.totalTresiba} <span className="text-[10px] font-normal">ед</span></>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>

              </div>

              {/* Нижняя строчка: ХЕ и Калории */}
              {(summary.totalCalories > 0 || summary.totalXE > 0) && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 px-1 font-mono">
                  <span>
                    Всего за день: <strong className="text-teal-600 dark:text-teal-400">{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)
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
                const tagInfo = entry.tag && entry.tag !== 'other' ? TAG_LABELS[entry.tag] : null;

                return (
                  <div
                    key={entry.id}
                    className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-4 border border-slate-200/80 dark:border-slate-800/80 shadow-xs space-y-3 transition-all active:scale-[0.99]"
                  >
                    {/* Верх: Время, тег, глюкоза + оценка */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{entry.time}</span>
                          {tagInfo && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-sans font-medium border ${tagInfo.class}`}>
                              {tagInfo.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Глюкоза с бейджем */}
                      <div className="text-right">
                        {entry.glucose !== null ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`font-mono text-xl font-black ${evalResult ? evalResult.textClass : 'text-slate-800'}`}>
                              {entry.glucose.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">ммоль</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                        {evalResult && (
                          <div className="flex justify-end mt-0.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.2 rounded-full border ${evalResult.badgeClass} font-semibold`}>
                              <span className="w-1 h-1 rounded-full bg-current" />
                              {evalResult.shortLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Средняя строка: Инсулины и ХЕ чипы */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                      {entry.rinFast !== null && entry.rinFast > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 font-bold">
                          💉 РинФаст {entry.rinFast} ед
                        </span>
                      )}

                      {entry.tresiba !== null && entry.tresiba > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold">
                          🌙 Тресиба {entry.tresiba} ед
                        </span>
                      )}

                      {entry.xe !== null && entry.xe > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 font-bold">
                          🍽️ {entry.xe} ХЕ ({entry.carbs} г)
                        </span>
                      )}

                      {entry.calories !== null && entry.calories > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-bold">
                          🔥 {entry.calories} ккал
                        </span>
                      )}
                    </div>

                    {/* Заметки / комментарии */}
                    {entry.notes && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                        {entry.notes}
                      </p>
                    )}

                    {/* Нижняя полоса действий */}
                    <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                      <button
                        onClick={() => onEditClick(entry)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Изменить</span>
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Удалить эту запись?')) {
                            onDeleteClick(entry.id);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-950/40 rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer"
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
