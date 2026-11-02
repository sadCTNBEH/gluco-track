import React from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Syringe,
  Moon,
  Utensils,
  Flame,
  Edit2,
  Trash2,
  Clock,
  Plus,
  Activity,
} from 'lucide-react';

interface MobileCardViewProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
  onDeleteDayClick?: (date: string, count: number) => void;
  bolusName?: string;
  basalName?: string;
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
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
}) => {
  const groupedDays = groupEntriesByDay(entries);

  if (groupedDays.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 mx-auto flex items-center justify-center">
          <Activity className="w-6 h-6" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">В дневнике пока нет записей</p>
        <button
          type="button"
          onClick={onAddClick}
          className="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 active:bg-teal-700 transition cursor-pointer min-h-[44px] shadow-xs"
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
          <div
            key={date}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs space-y-3 p-3.5 sm:p-4"
          >
            {/* Header of the Day */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                  {date.slice(8, 10)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white capitalize leading-tight">
                    {formatDateRussian(date)}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {summary.entriesCount} {summary.entriesCount === 1 ? 'замер' : summary.entriesCount < 5 ? 'замера' : 'замеров'}
                  </span>
                </div>
              </div>

              {onDeleteDayClick && (
                <button
                  type="button"
                  onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Удалить все замеры за день"
                  aria-label="Удалить день"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Daily Aggregates Mini Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              {/* Average Glucose */}
              <div className="bg-slate-50 dark:bg-slate-850 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Ср. сахар</div>
                <div className={`font-mono font-extrabold text-sm tabular-nums mt-0.5 ${dayGlucoseEval ? dayGlucoseEval.textClass : 'text-slate-900 dark:text-white'}`}>
                  {summary.avgGlucose !== null ? `${summary.avgGlucose}` : '—'}
                </div>
              </div>

              {/* Bolus Total */}
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-center">
                <div className="text-[10px] text-blue-700 dark:text-blue-300 font-medium truncate">{bolusName}</div>
                <div className="font-mono font-bold text-sm text-blue-800 dark:text-blue-300 tabular-nums mt-0.5">
                  {summary.totalRinFast > 0 ? `${summary.totalRinFast} ед` : '—'}
                </div>
              </div>

              {/* Basal Total */}
              <div className="bg-purple-50/50 dark:bg-purple-950/20 p-2 rounded-xl border border-purple-200/60 dark:border-purple-900/40 text-center">
                <div className="text-[10px] text-purple-700 dark:text-purple-300 font-medium truncate">{basalName}</div>
                <div className="font-mono font-bold text-sm text-purple-800 dark:text-purple-300 tabular-nums mt-0.5">
                  {summary.totalTresiba > 0 ? `${summary.totalTresiba} ед` : '—'}
                </div>
              </div>
            </div>

            {/* Total XE / Carbs strip if present */}
            {(summary.totalCalories > 0 || summary.totalXE > 0) && (
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono px-1">
                <span>
                  Итого: <strong className="text-slate-800 dark:text-slate-200">{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)
                </span>
                {summary.totalCalories > 0 && (
                  <span>
                    <strong>{summary.totalCalories} ккал</strong>
                  </span>
                )}
              </div>
            )}

            {/* Individual Records as Cards */}
            <div className="space-y-2 pt-1">
              {dayEntries.map((entry) => {
                const evalResult = evaluateGlucose(entry.glucose);
                const tagInfo = entry.tag && entry.tag !== 'other' ? TAG_CONFIG[entry.tag] : null;

                return (
                  <div
                    key={entry.id}
                    className="bg-slate-50/60 dark:bg-slate-850/60 rounded-xl p-3 border border-slate-200/70 dark:border-slate-800 space-y-2"
                  >
                    {/* Top Row: Time, Tag, Glucose with Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono font-bold text-xs text-slate-900 dark:text-white tabular-nums">
                          {entry.time}
                        </span>
                        {tagInfo && (
                          <span className={`text-[10px] px-2 py-0.2 rounded-md font-sans font-medium ${tagInfo.className}`}>
                            {tagInfo.label}
                          </span>
                        )}
                      </div>

                      {/* Glucose Display */}
                      <div className="flex items-center gap-2">
                        {entry.glucose !== null ? (
                          <div className="flex items-baseline gap-1">
                            <span className={`font-mono text-base font-extrabold tabular-nums ${evalResult ? evalResult.textClass : 'text-slate-900 dark:text-white'}`}>
                              {entry.glucose.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans">ммоль</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono text-sm">—</span>
                        )}

                        {evalResult && (
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${evalResult.badgeClass} font-semibold`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                            {evalResult.shortLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Doses & XE Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                      {entry.rinFast !== null && entry.rinFast > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold tabular-nums">
                          <Syringe className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                          {bolusName} {entry.rinFast} ед
                        </span>
                      )}

                      {entry.tresiba !== null && entry.tresiba > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold tabular-nums">
                          <Moon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                          {basalName} {entry.tresiba} ед
                        </span>
                      )}

                      {entry.xe !== null && entry.xe > 0 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold tabular-nums">
                          <Utensils className="w-3 h-3 text-teal-600 dark:text-teal-400 shrink-0" />
                          {entry.xe} ХЕ
                        </span>
                      )}

                      {entry.calories !== null && entry.calories > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 text-[11px] tabular-nums">
                          <Flame className="w-3 h-3 text-rose-500 shrink-0" />
                          {entry.calories} ккал
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Food notes and Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                      <div className="text-slate-600 dark:text-slate-300 text-xs truncate max-w-[200px]">
                        {entry.notes || <span className="text-slate-400 italic text-[11px]">без примечания</span>}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditClick(entry)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                          aria-label="Редактировать"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteClick(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                          aria-label="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
