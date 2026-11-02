import React, { useState } from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Search,
  Plus,
  Syringe,
  Moon,
  Utensils,
  Flame,
  X,
  Edit2,
  Trash2,
  Activity,
  Filter,
} from 'lucide-react';

interface DiaryTableProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
  onDeleteDayClick?: (date: string, count: number) => void;
  bolusName?: string;
  basalName?: string;
  settings?: UserSettings;
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

export const DiaryTable: React.FC<DiaryTableProps> = ({
  entries,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onDeleteDayClick,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
  settings,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '14d' | '30d'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'normal' | 'high' | 'very_high'>('all');

  // Фильтрация записей
  const filteredEntries = entries.filter((entry) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNote = entry.notes?.toLowerCase().includes(q);
      const matchDate = entry.date.includes(q);
      const matchTime = entry.time.includes(q);
      if (!matchNote && !matchDate && !matchTime) return false;
    }

    if (periodFilter !== 'all') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (periodFilter === 'today' && entry.date !== todayStr) return false;

      const daysCount = periodFilter === '7d' ? 7 : periodFilter === '14d' ? 14 : 30;
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysCount);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
      if (entry.date < cutoffStr) return false;
    }

    if (statusFilter !== 'all') {
      const evalGl = evaluateGlucose(entry.glucose, settings);
      if (!evalGl || evalGl.status !== statusFilter) return false;
    }

    return true;
  });

  const groupedDays = groupEntriesByDay(filteredEntries);

  return (
    <div className="space-y-4">
      
      {/* Modern Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по дате, времени, еде или заметкам..."
            className="w-full h-10 pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Segmented Filter */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            {[
              { id: 'all', label: 'Все' },
              { id: 'today', label: 'Сегодня' },
              { id: '7d', label: '7 дней' },
              { id: '14d', label: '14 дней' },
              { id: '30d', label: '30 дней' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodFilter(p.id as any)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer min-h-[32px] ${
                  periodFilter === p.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              <option value="all">Все статусы</option>
              <option value="normal">В норме (4.0–9.9)</option>
              <option value="low">Низкий (&lt;3.9)</option>
              <option value="high">Высокий (10.0–13.9)</option>
              <option value="very_high">Очень высокий (&gt;13.9)</option>
            </select>
          </div>
        </div>

      </div>

      {/* Main Records List / Table */}
      {groupedDays.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 mx-auto flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Нет записей по выбранным критериям</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Попробуйте сбросить фильтры или добавить новое измерение глюкозы и инсулина
            </p>
          </div>
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить измерение</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDays.map(({ date, entries: dayEntries, summary }) => {
            const dayGlucoseEval = summary.avgGlucose ? evaluateGlucose(summary.avgGlucose, settings) : null;

            return (
              <div
                key={date}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs transition-all"
              >
                {/* Day Header Bar */}
                <div className="bg-slate-50 dark:bg-slate-850/80 px-4 sm:px-5 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  
                  {/* Left: Date & Entries Count */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-sm text-slate-800 dark:text-slate-200 shadow-2xs">
                      {date.slice(8, 10)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white capitalize">
                        {formatDateRussian(date)}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {summary.entriesCount} {summary.entriesCount === 1 ? 'замер' : summary.entriesCount < 5 ? 'замера' : 'замеров'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Daily Totals Chips & Delete Day Button */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    
                    {/* Average Glucose */}
                    {summary.avgGlucose !== null && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs font-mono">
                        <span className="text-slate-400 text-[11px] font-sans">Ср:</span>
                        <span className={`font-bold tabular-nums ${dayGlucoseEval?.textClass}`}>
                          {summary.avgGlucose}
                        </span>
                        {dayGlucoseEval && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${dayGlucoseEval.badgeClass}`}>
                            {dayGlucoseEval.shortLabel}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Bolus Total */}
                    {summary.totalRinFast > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-semibold shadow-2xs font-mono">
                        <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{bolusName}: <strong className="tabular-nums">{summary.totalRinFast} ед</strong></span>
                      </div>
                    )}

                    {/* Basal Total */}
                    {summary.totalTresiba > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-semibold shadow-2xs font-mono">
                        <Moon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>{basalName}: <strong className="tabular-nums">{summary.totalTresiba} ед</strong></span>
                      </div>
                    )}

                    {/* XE Total */}
                    {summary.totalXE > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-semibold shadow-2xs font-mono">
                        <Utensils className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span><strong className="tabular-nums">{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)</span>
                      </div>
                    )}

                    {/* Calories Total */}
                    {summary.totalCalories > 0 && (
                      <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold shadow-2xs font-mono">
                        <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span><strong className="tabular-nums">{summary.totalCalories}</strong> ккал</span>
                      </div>
                    )}

                    {/* Delete Whole Day Button */}
                    {onDeleteDayClick && (
                      <button
                        type="button"
                        onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[32px]"
                        title={`Удалить все записи за ${formatDateRussian(date)}`}
                        aria-label="Удалить день"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold hidden sm:inline">Удалить день</span>
                      </button>
                    )}

                  </div>
                </div>

                {/* Day Table Records */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-[10px] border-b border-slate-100 dark:border-slate-800">
                        <th className="py-2.5 px-4 w-24">Время</th>
                        <th className="py-2.5 px-4 w-32 text-right">Глюкоза</th>
                        <th className="py-2.5 px-4 w-36">Статус</th>
                        <th className="py-2.5 px-3 w-24 text-center">Углеводы</th>
                        <th className="py-2.5 px-3 w-24 text-center">ХЕ (÷12)</th>
                        <th className="py-2.5 px-3 w-28 text-center text-blue-700 dark:text-blue-300">{bolusName}</th>
                        <th className="py-2.5 px-3 w-28 text-center text-purple-700 dark:text-purple-300">{basalName}</th>
                        <th className="py-2.5 px-3 w-20 text-center text-rose-700 dark:text-rose-300">Ккал</th>
                        <th className="py-2.5 px-4">Еда / примечания</th>
                        <th className="py-2.5 px-3 w-20 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {dayEntries.map((entry) => {
                        const evalResult = evaluateGlucose(entry.glucose, settings);
                        const tagInfo = entry.tag && entry.tag !== 'other' ? TAG_CONFIG[entry.tag] : null;

                        return (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                          >
                            {/* Время и контекстный тег */}
                            <td className="py-3 px-4">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs tabular-nums">
                                  {entry.time}
                                </span>
                                {tagInfo && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans font-medium w-fit ${tagInfo.className}`}>
                                    {tagInfo.label}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Глюкоза */}
                            <td className="py-3 px-4 text-right">
                              {entry.glucose !== null ? (
                                <div className="inline-flex items-baseline gap-1">
                                  <span className={`font-mono text-base font-extrabold tabular-nums ${evalResult ? evalResult.textClass : 'text-slate-900 dark:text-white'}`}>
                                    {entry.glucose.toFixed(1)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-sans">ммоль</span>
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Статус с индикаторной точкой */}
                            <td className="py-3 px-4">
                              {evalResult ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${evalResult.badgeClass}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                  <span>{evalResult.shortLabel}</span>
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Углеводы */}
                            <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300 tabular-nums">
                              {entry.carbs !== null && entry.carbs > 0 ? (
                                <span>{entry.carbs} г</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* ХЕ */}
                            <td className="py-3 px-3 text-center">
                              {entry.xe !== null && entry.xe > 0 ? (
                                <span className="font-mono font-bold px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tabular-nums">
                                  {entry.xe} ХЕ
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Болюс */}
                            <td className="py-3 px-3 text-center">
                              {entry.rinFast !== null && entry.rinFast > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 tabular-nums">
                                  <Syringe className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                  {entry.rinFast} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Базал */}
                            <td className="py-3 px-3 text-center">
                              {entry.tresiba !== null && entry.tresiba > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-mono font-bold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 tabular-nums">
                                  <Moon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                  {entry.tresiba} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Калории */}
                            <td className="py-3 px-3 text-center font-mono tabular-nums">
                              {entry.calories !== null && entry.calories > 0 ? (
                                <span className="text-rose-700 dark:text-rose-300 font-semibold">
                                  {entry.calories}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Примечания / Еда */}
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs break-words leading-relaxed text-xs">
                              {entry.notes ? (
                                <span>{entry.notes}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 italic">нет пометок</span>
                              )}
                            </td>

                            {/* Действия */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => onEditClick(entry)}
                                  className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Редактировать запись"
                                  aria-label="Редактировать"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteClick(entry.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Удалить запись"
                                  aria-label="Удалить"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
