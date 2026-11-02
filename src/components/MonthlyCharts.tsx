import React, { useState, useMemo } from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import {
  calculateMonthlyStats,
  evaluateGlucose,
  formatMonthYearRussian,
} from '../utils/diabetes';
import {
  TrendingUp,
  Activity,
  Syringe,
  ChevronLeft,
  ChevronRight,
  PieChart,
  BarChart3,
  Award,
  Moon,
} from 'lucide-react';

interface MonthlyChartsProps {
  entries: DiaryEntry[];
  bolusName?: string;
  basalName?: string;
  settings?: UserSettings;
}

export const MonthlyCharts: React.FC<MonthlyChartsProps> = ({
  entries,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
  settings,
}) => {
  // Список доступных месяцев
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const nowMonth = new Date().toISOString().slice(0, 7);
    monthsSet.add(nowMonth);

    for (const e of entries) {
      if (e.date) {
        monthsSet.add(e.date.slice(0, 7));
      }
    }
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0] || new Date().toISOString().slice(0, 7)
  );

  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    entry: DiaryEntry;
  } | null>(null);

  // Статистика за выбранный месяц
  const stats = useMemo(() => {
    return calculateMonthlyStats(entries, selectedMonth, settings);
  }, [entries, selectedMonth, settings]);

  // Записи за выбранный месяц с замерами сахара
  const monthEntries = useMemo(() => {
    return entries
      .filter((e) => e.date.startsWith(selectedMonth) && e.glucose !== null && e.glucose > 0)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [entries, selectedMonth]);

  // Распределение по времени суток (Утро, День, Вечер, Ночь)
  const timeOfDayStats = useMemo(() => {
    const buckets: { label: string; period: string; sum: number; count: number }[] = [
      { label: 'Утро', period: '06:00 – 12:00', sum: 0, count: 0 },
      { label: 'День', period: '12:00 – 18:00', sum: 0, count: 0 },
      { label: 'Вечер', period: '18:00 – 23:00', sum: 0, count: 0 },
      { label: 'Ночь', period: '23:00 – 06:00', sum: 0, count: 0 },
    ];

    for (const e of monthEntries) {
      if (!e.glucose) continue;
      const hour = parseInt(e.time.split(':')[0], 10);
      if (hour >= 6 && hour < 12) {
        buckets[0].sum += e.glucose;
        buckets[0].count++;
      } else if (hour >= 12 && hour < 18) {
        buckets[1].sum += e.glucose;
        buckets[1].count++;
      } else if (hour >= 18 && hour < 23) {
        buckets[2].sum += e.glucose;
        buckets[2].count++;
      } else {
        buckets[3].sum += e.glucose;
        buckets[3].count++;
      }
    }

    return buckets.map((b) => ({
      ...b,
      avg: b.count > 0 ? Number((b.sum / b.count).toFixed(1)) : null,
    }));
  }, [monthEntries]);

  // Суточные данные для графика инсулинов
  const dailyInsulinData = useMemo(() => {
    const dayMap: Record<string, { rinFast: number; tresiba: number; carbs: number; date: string }> = {};

    const allMonthEntries = entries.filter((e) => e.date.startsWith(selectedMonth));
    for (const e of allMonthEntries) {
      if (!dayMap[e.date]) {
        dayMap[e.date] = { rinFast: 0, tresiba: 0, carbs: 0, date: e.date };
      }
      if (e.rinFast) dayMap[e.date].rinFast += e.rinFast;
      if (e.tresiba) dayMap[e.date].tresiba += e.tresiba;
      if (e.carbs) dayMap[e.date].carbs += e.carbs;
    }

    return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, selectedMonth]);

  const handlePrevMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    }
  };

  const handleNextMonth = () => {
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    }
  };

  // SVG Chart Dimensions
  const chartWidth = 900;
  const chartHeight = 320;
  const padding = { top: 25, right: 30, bottom: 40, left: 65 };

  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const minGlucoseY = 2.0;
  const maxGlucoseY = 18.0;

  const getY = (val: number) => {
    const clamped = Math.max(minGlucoseY, Math.min(maxGlucoseY, val));
    return padding.top + innerHeight - ((clamped - minGlucoseY) / (maxGlucoseY - minGlucoseY)) * innerHeight;
  };

  const daysInMonth = 31;
  const getX = (dateStr: string, timeStr: string) => {
    const dayNum = parseInt(dateStr.slice(8, 10), 10) || 1;
    const [hh, mm] = (timeStr || '12:00').split(':').map(Number);
    const fraction = (dayNum - 1 + (hh + (mm || 0) / 60) / 24) / daysInMonth;
    return padding.left + fraction * innerWidth;
  };

  // Координаты целевого коридора
  const targetLow = settings?.targetLow ?? 4.0;
  const targetHigh = settings?.targetHigh ?? 9.9;
  const hypoThreshold = settings?.hypoThreshold ?? 3.9;
  const yLowTarget = getY(targetLow);
  const yHighTarget = getY(targetHigh);

  return (
    <div className="space-y-6">
      {/* Селектор месяца и заголовок */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
              Аналитика: {formatMonthYearRussian(selectedMonth)}
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
            disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
            className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-700 dark:text-slate-300"
            title="Предыдущий месяц"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={selectedMonth}
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
            disabled={availableMonths.indexOf(selectedMonth) <= 0}
            className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-700 dark:text-slate-300"
            title="Следующий месяц"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Метрики месяца */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Средняя глюкоза */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Средняя глюкоза</span>
            <Activity className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {stats.avgGlucose !== null ? stats.avgGlucose : '—'}{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">ммоль/л</span>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            {stats.totalEntries} замеров • {stats.activeDaysCount} дн.
          </div>
        </div>

        {/* Доля в целевом диапазоне (TIR) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">В норме (TIR)</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 font-mono">
            TIR: {stats.tir.normalPercent}%
          </div>
          <div className="text-xs text-slate-400">
            Доля измерений в целевом диапазоне ({targetLow}–{targetHigh} ммоль/л)
          </div>
        </div>

        {/* Оценочный eHbA1c */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Расчетный eHbA1c</span>
            <PieChart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {stats.estimatedHbA1c !== null ? `~${stats.estimatedHbA1c}%` : '—'}
          </div>
          <div className="text-xs text-slate-400">
            Ориентировочно (не заменяет лабораторию)
          </div>
        </div>

        {/* Суточный инсулин */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Инсулин в среднем</span>
            <Syringe className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            <span className="text-blue-700 dark:text-blue-400">{stats.avgDailyRinFast}</span> +{' '}
            <span className="text-purple-700 dark:text-purple-400">{stats.avgDailyTresiba}</span>{' '}
            <span className="text-xs font-normal text-slate-400 font-sans">ед/сут</span>
          </div>
          <div className="text-xs text-slate-400">
            {bolusName} (болюс) + {basalName} (базал)
          </div>
        </div>
      </div>

      {/* 1. График динамики глюкозы */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Динамика измерений глюкозы
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Зеленая зона — целевой коридор ({targetLow} – {targetHigh} ммоль/л). Нажмите на точку для просмотра данных.
            </p>
          </div>

          {/* Легенда */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>≤ {hypoThreshold} Низкий</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span>{targetLow} – {targetHigh} Норма</span>
            </span>
            <span className="flex items-center gap-1 text-orange-700 dark:text-orange-400">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span>&gt; {targetHigh} Высокий</span>
            </span>
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600" />
              <span>&gt; 13.9 Критический</span>
            </span>
          </div>
        </div>

        {/* SVG Полотно графика */}
        <div className="relative overflow-x-auto">
          {monthEntries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              В выбранном месяце нет измерений сахара
            </div>
          ) : (
            <div className="min-w-[700px]">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible select-none">
                {/* Фоновая сетка по Y */}
                {[3.9, 6.0, 8.0, 10.0, 14.0, 18.0].map((level) => {
                  const y = getY(level);
                  return (
                    <g key={level}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#e2e8f0"
                        strokeDasharray={level === 3.9 || level === 10.0 || level === 14.0 ? '4 4' : undefined}
                        className="dark:stroke-slate-800"
                        strokeWidth="1"
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 4}
                        textAnchor="end"
                        className="text-xs fill-slate-400 font-mono"
                      >
                        {level === 3.9 ? '3.9' : level}
                      </text>
                    </g>
                  );
                })}

                {/* Целевой коридор (4.0 - 9.9) */}
                <rect
                  x={padding.left}
                  y={yHighTarget}
                  width={innerWidth}
                  height={Math.abs(yLowTarget - yHighTarget)}
                  fill="#10b981"
                  fillOpacity="0.08"
                />

                {/* Линия нормы 4.0 */}
                <line
                  x1={padding.left}
                  y1={yLowTarget}
                  x2={chartWidth - padding.right}
                  y2={yLowTarget}
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />

                {/* Линия нормы 9.9 */}
                <line
                  x1={padding.left}
                  y1={yHighTarget}
                  x2={chartWidth - padding.right}
                  y2={yHighTarget}
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />

                {/* Подписи дней по оси X */}
                {[1, 5, 10, 15, 20, 25, 30].map((d) => {
                  const fraction = (d - 1) / daysInMonth;
                  const x = padding.left + fraction * innerWidth;
                  return (
                    <g key={d}>
                      <line
                        x1={x}
                        y1={padding.top}
                        x2={x}
                        y2={chartHeight - padding.bottom}
                        stroke="#f1f5f9"
                        className="dark:stroke-slate-800/60"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={chartHeight - padding.bottom + 16}
                        textAnchor="middle"
                        className="text-xs fill-slate-400 font-mono"
                      >
                        {d}
                      </text>
                    </g>
                  );
                })}

                {/* Линия тренда */}
                <path
                  d={monthEntries
                    .map((e, i) => {
                      const x = getX(e.date, e.time);
                      const y = getY(e.glucose || 5.5);
                      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.8"
                />

                {/* Точки замеров с поддержкой клавиатуры */}
                {monthEntries.map((e) => {
                  const x = getX(e.date, e.time);
                  const y = getY(e.glucose || 5.5);
                  const ev = evaluateGlucose(e.glucose, settings);

                  const fillColor =
                    ev?.status === 'low'
                      ? '#d97706'
                      : ev?.status === 'normal'
                      ? '#059669'
                      : ev?.status === 'high'
                      ? '#ea580c'
                      : '#e11d48';

                  const isHovered = hoveredPoint?.entry.id === e.id;

                  return (
                    <g
                      key={e.id}
                      className="cursor-pointer focus:outline-none"
                      tabIndex={0}
                      role="button"
                      aria-label={`${e.date} ${e.time}: глюкоза ${e.glucose} ммоль/л, статус ${ev?.shortLabel}`}
                      onMouseEnter={() => setHoveredPoint({ x, y, entry: e })}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => setHoveredPoint({ x, y, entry: e })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setHoveredPoint({ x, y, entry: e });
                        }
                      }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 7 : 4}
                        fill={fillColor}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2 : 1}
                        className="transition-all duration-100"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Тултип */}
              {hoveredPoint && (
                <div
                  className="absolute z-20 pointer-events-none p-3 rounded-lg bg-slate-900 text-white text-xs shadow-lg border border-slate-700 space-y-1 max-w-[240px]"
                  style={{
                    left: `${Math.min(chartWidth - 210, Math.max(20, hoveredPoint.x - 80))}px`,
                    top: `${Math.max(10, hoveredPoint.y - 120)}px`,
                  }}
                >
                  <div className="font-mono font-bold flex items-center justify-between gap-3 text-slate-300">
                    <span>{hoveredPoint.entry.date}</span>
                    <span>{hoveredPoint.entry.time}</span>
                  </div>
                  <div className="text-sm font-bold flex items-center gap-1.5 font-mono text-white">
                    <span>{hoveredPoint.entry.glucose} ммоль/л</span>
                    <span className="text-xs font-sans font-medium px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700">
                      {evaluateGlucose(hoveredPoint.entry.glucose, settings)?.shortLabel}
                    </span>
                  </div>
                  {hoveredPoint.entry.rinFast && (
                    <div className="text-blue-300 font-mono">{bolusName}: {hoveredPoint.entry.rinFast} ед</div>
                  )}
                  {hoveredPoint.entry.tresiba && (
                    <div className="text-purple-300 font-mono">{basalName}: {hoveredPoint.entry.tresiba} ед</div>
                  )}
                  {hoveredPoint.entry.xe && (
                    <div className="text-teal-300 font-mono">ХЕ: {hoveredPoint.entry.xe} ({hoveredPoint.entry.carbs} г)</div>
                  )}
                  {hoveredPoint.entry.notes && (
                    <div className="text-slate-400 italic truncate text-xs pt-0.5 border-t border-slate-800">
                      {hoveredPoint.entry.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Доли в целевом диапазоне и профиль по времени суток */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Доли диапазонов */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Доля измерений в диапазонах
            </h3>
            <span className="text-xs text-slate-400 font-mono">Всего замеров: {stats.totalEntries}</span>
          </div>

          {/* Сегментированная полоса */}
          <div className="h-4 w-full rounded-md overflow-hidden flex bg-slate-100 dark:bg-slate-800">
            {stats.tir.lowPercent > 0 && (
              <div
                style={{ width: `${stats.tir.lowPercent}%` }}
                className="bg-amber-500 h-full flex items-center justify-center text-xs font-bold text-white"
                title={`Низкий: ${stats.tir.lowPercent}%`}
              >
                {stats.tir.lowPercent >= 8 ? `${stats.tir.lowPercent}%` : ''}
              </div>
            )}
            {stats.tir.normalPercent > 0 && (
              <div
                style={{ width: `${stats.tir.normalPercent}%` }}
                className="bg-emerald-600 h-full flex items-center justify-center text-xs font-bold text-white"
                title={`В норме: ${stats.tir.normalPercent}%`}
              >
                {stats.tir.normalPercent >= 8 ? `${stats.tir.normalPercent}%` : ''}
              </div>
            )}
            {stats.tir.highPercent > 0 && (
              <div
                style={{ width: `${stats.tir.highPercent}%` }}
                className="bg-orange-500 h-full flex items-center justify-center text-xs font-bold text-white"
                title={`Высокий: ${stats.tir.highPercent}%`}
              >
                {stats.tir.highPercent >= 8 ? `${stats.tir.highPercent}%` : ''}
              </div>
            )}
            {stats.tir.veryHighPercent > 0 && (
              <div
                style={{ width: `${stats.tir.veryHighPercent}%` }}
                className="bg-rose-600 h-full flex items-center justify-center text-xs font-bold text-white"
                title={`Очень высокий: ${stats.tir.veryHighPercent}%`}
              >
                {stats.tir.veryHighPercent >= 8 ? `${stats.tir.veryHighPercent}%` : ''}
              </div>
            )}
          </div>

          {/* Детализация категорий */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-300">Целевой диапазон ({targetLow} – {targetHigh})</span>
              </div>
              <div className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                {stats.tir.normalCount} ({stats.tir.normalPercent}%)
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                <span className="font-semibold text-orange-900 dark:text-orange-300">Высокий (&gt; {targetHigh})</span>
              </div>
              <div className="font-mono font-bold text-orange-800 dark:text-orange-300">
                {stats.tir.highCount} ({stats.tir.highPercent}%)
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
                <span className="font-semibold text-rose-900 dark:text-rose-300">Очень высокий (&gt; 13.9)</span>
              </div>
              <div className="font-mono font-bold text-rose-800 dark:text-rose-300">
                {stats.tir.veryHighCount} ({stats.tir.veryHighPercent}%)
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                <span className="font-semibold text-amber-900 dark:text-amber-300">Низкий (&lt; 3.9)</span>
              </div>
              <div className="font-mono font-bold text-amber-800 dark:text-amber-300">
                {stats.tir.lowCount} ({stats.tir.lowPercent}%)
              </div>
            </div>
          </div>
        </div>

        {/* Средний сахар по времени суток */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Распределение по времени суток
            </h3>
            <span className="text-xs text-slate-400">Средние значения</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {timeOfDayStats.map((item) => {
              const evalRes = item.avg ? evaluateGlucose(item.avg, settings) : null;

              return (
                <div
                  key={item.label}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col justify-between space-y-1.5"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{item.period}</span>
                    </div>
                    <div className="text-lg font-bold font-mono mt-0.5">
                      {item.avg !== null ? (
                        <span className={evalRes?.textClass}>{item.avg} ммоль/л</span>
                      ) : (
                        <span className="text-slate-400 text-xs font-normal">нет замеров</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>{item.count} замеров</span>
                    {evalRes && (
                      <span className={`px-1.5 py-0.2 rounded border text-xs ${evalRes.badgeClass} font-medium`}>
                        {evalRes.shortLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
            Подсказка: Сравните замеры натощак и на ночь для оценки адекватности дозы базального инсулина Тресиба.
          </p>
        </div>

      </div>

      {/* 3. Суточные дозы инсулинов */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Syringe className="w-4 h-4 text-slate-400" />
              Суточные дозировки инсулинов ({bolusName} vs {basalName})
            </h3>
            <p className="text-xs text-slate-400">
              Соотношение болюсного ({bolusName}) и базального ({basalName}) инсулина по дням
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
              <span className="w-3 h-3 rounded bg-blue-600" />
              <span>{bolusName} (болюс)</span>
            </span>
            <span className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400">
              <span className="w-3 h-3 rounded bg-purple-600" />
              <span>{basalName} (базал)</span>
            </span>
          </div>
        </div>

        {dailyInsulinData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-xs text-slate-400">
            Нет данных об инъекциях за этот месяц
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[650px] flex items-end gap-2 h-40 pt-4 px-2 border-b border-slate-200 dark:border-slate-800">
              {dailyInsulinData.map((d) => {
                const maxVal = 45;
                const rfHeight = Math.min(100, (d.rinFast / maxVal) * 100);
                const trHeight = Math.min(100, (d.tresiba / maxVal) * 100);

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Тултип */}
                    <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-slate-900 text-white text-xs p-2 rounded-lg whitespace-nowrap shadow-md border border-slate-700 font-mono">
                      <div className="font-bold">{d.date}</div>
                      <div>{bolusName}: {d.rinFast} ед • {basalName}: {d.tresiba} ед</div>
                    </div>

                    <div className="w-full flex items-end justify-center gap-0.5 h-28">
                      <div
                        style={{ height: `${rfHeight}%` }}
                        className="w-1/2 bg-blue-600 rounded-t-sm"
                        title={`${d.date} - ${bolusName}: ${d.rinFast} ед`}
                      />
                      <div
                        style={{ height: `${trHeight}%` }}
                        className="w-1/2 bg-purple-600 rounded-t-sm"
                        title={`${d.date} - ${basalName}: ${d.tresiba} ед`}
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-mono">
                      {d.date.slice(8, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
