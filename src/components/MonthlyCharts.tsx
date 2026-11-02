import React, { useState, useMemo } from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { calculateMonthlyStats, formatMonthYearRussian, getCurrentMonthString } from '../utils/diabetes';
import { TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  MonthlySummaryCards,
  GlucoseSvgChart,
  TirDetailedCard,
  TimeOfDayDistribution,
  DailyInsulinBarChart,
} from './charts';

export interface MonthlyChartsProps {
  entries: DiaryEntry[];
  bolusName?: string;
  basalName?: string;
  settings?: UserSettings;
}

/**
 * Извлекает уникальные месяцы (YYYY-MM) из записей,
 * гарантируя наличие текущего месяца и сортировку по убыванию.
 */
export function calculateAvailableMonths(entries: DiaryEntry[], fallbackMonth?: string): string[] {
  const monthsSet = new Set<string>();
  const defaultMonth = fallbackMonth || getCurrentMonthString();
  monthsSet.add(defaultMonth);

  for (const e of entries) {
    if (e.date) {
      monthsSet.add(e.date.slice(0, 7));
    }
  }
  return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
}

export const MonthlyCharts: React.FC<MonthlyChartsProps> = ({
  entries,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
  settings,
}) => {
  // Список доступных месяцев
  const availableMonths = useMemo(() => {
    return calculateAvailableMonths(entries);
  }, [entries]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0] || getCurrentMonthString()
  );

  // Безопасный активный месяц (защита от устаревшего значения при смене набора данных)
  const activeMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : availableMonths[0] || getCurrentMonthString();

  // Статистика за выбранный месяц
  const stats = useMemo(() => {
    return calculateMonthlyStats(entries, activeMonth, settings);
  }, [entries, activeMonth, settings]);

  // Записи за выбранный месяц с замерами сахара для графиков
  const monthEntries = useMemo(() => {
    return entries
      .filter((e) => e.date && e.date.startsWith(activeMonth) && e.glucose !== null && e.glucose > 0)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [entries, activeMonth]);

  const handlePrevMonth = () => {
    const idx = availableMonths.indexOf(activeMonth);
    if (idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    }
  };

  const handleNextMonth = () => {
    const idx = availableMonths.indexOf(activeMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };

  const targetLow = settings?.targetLow ?? 4.0;
  const targetHigh = settings?.targetHigh ?? 9.9;

  return (
    <div className="space-y-6">
      {/* Селектор месяца и заголовок */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
              Аналитика: {formatMonthYearRussian(activeMonth)}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Статистика измерений гликемии и дозировок инсулина за выбранный календарный месяц
          </p>
        </div>

        {/* Переключатель месяца */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={handlePrevMonth}
            disabled={availableMonths.indexOf(activeMonth) >= availableMonths.length - 1}
            className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-700 dark:text-slate-300"
            title="Предыдущий месяц"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={activeMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-2.5 py-1 rounded font-semibold text-xs bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer h-9"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                {formatMonthYearRussian(m)}
              </option>
            ))}
          </select>
          <button
            onClick={handleNextMonth}
            disabled={availableMonths.indexOf(activeMonth) <= 0}
            className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-700 dark:text-slate-300"
            title="Следующий месяц"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Метрики месяца */}
      <MonthlySummaryCards
        stats={stats}
        targetLow={targetLow}
        targetHigh={targetHigh}
        bolusName={bolusName}
        basalName={basalName}
      />

      {/* 1. График динамики глюкозы */}
      <GlucoseSvgChart
        monthEntries={monthEntries}
        settings={settings}
        bolusName={bolusName}
        basalName={basalName}
      />

      {/* 2. Доли в целевом диапазоне и профиль по времени суток */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TirDetailedCard
          tir={stats.tir}
          totalEntries={stats.totalEntries}
          targetLow={targetLow}
          targetHigh={targetHigh}
        />
        <TimeOfDayDistribution
          monthEntries={monthEntries}
          settings={settings}
          basalName={basalName}
        />
      </div>

      {/* 3. Суточные дозы инсулинов */}
      <DailyInsulinBarChart
        entries={entries}
        selectedMonth={activeMonth}
        bolusName={bolusName}
        basalName={basalName}
      />
    </div>
  );
};
