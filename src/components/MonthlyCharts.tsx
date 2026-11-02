import React, { useState, useMemo } from 'react';
import { DiaryEntry } from '../types/diabetes';
import {
  calculateMonthlyStats,
  evaluateGlucose,
  formatMonthYearRussian,
  RUSSIAN_MONTHS,
} from '../utils/diabetes';
import {
  TrendingUp,
  Calendar,
  Activity,
  Syringe,
  Utensils,
  ChevronLeft,
  ChevronRight,
  PieChart,
  BarChart3,
  Flame,
  Award,
} from 'lucide-react';

interface MonthlyChartsProps {
  entries: DiaryEntry[];
}

export const MonthlyCharts: React.FC<MonthlyChartsProps> = ({ entries }) => {
  // Получаем список доступных месяцев из записей
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
    return calculateMonthlyStats(entries, selectedMonth);
  }, [entries, selectedMonth]);

  // Записи за выбранный месяц
  const monthEntries = useMemo(() => {
    return entries
      .filter((e) => e.date.startsWith(selectedMonth) && e.glucose !== null && e.glucose > 0)
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }, [entries, selectedMonth]);

  // Распределение по времени суток (Утро, День, Вечер, Ночь)
  const timeOfDayStats = useMemo(() => {
    const buckets: { label: string; period: string; sum: number; count: number }[] = [
      { label: 'Утро', period: '06:00 - 12:00', sum: 0, count: 0 },
      { label: 'День', period: '12:00 - 18:00', sum: 0, count: 0 },
      { label: 'Вечер', period: '18:00 - 23:00', sum: 0, count: 0 },
      { label: 'Ночь', period: '23:00 - 06:00', sum: 0, count: 0 },
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

  // Суточные данные для графика инсулинов и углеводов
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

  // Навигация по месяцам
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

  const daysInMonth = 31; // нормализация для сетки месяца
  const getX = (dateStr: string, timeStr: string) => {
    const dayNum = parseInt(dateStr.slice(8, 10), 10) || 1;
    const [hh, mm] = (timeStr || '12:00').split(':').map(Number);
    const fraction = (dayNum - 1 + (hh + (mm || 0) / 60) / 24) / daysInMonth;
    return padding.left + fraction * innerWidth;
  };

  // Координаты целевого коридора (4.0 - 9.9)
  const yLowTarget = getY(4.0);
  const yHighTarget = getY(9.9);
  const yHypoAlert = getY(3.9);
  const ySevereHyper = getY(13.9);

  return (
    <div className="space-y-6">
      {/* Селектор месяца и заголовок */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Динамика показателей за {formatMonthYearRussian(selectedMonth)}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Анализ гликемического профиля, времени в целевом диапазоне (TIR) и доз инсулина
          </p>
        </div>

        {/* Переключатель месяца */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            disabled={availableMonths.indexOf(selectedMonth) >= availableMonths.length - 1}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            title="Предыдущий месяц"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 rounded-xl font-semibold text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {formatMonthYearRussian(m)}
              </option>
            ))}
          </select>
          <button
            onClick={handleNextMonth}
            disabled={availableMonths.indexOf(selectedMonth) <= 0}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition"
            title="Следующий месяц"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Клинические ключевые метрики месяца (TIR, Средний сахар, HbA1c, Дозы) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Средний сахар */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Средний сахар</span>
            <Activity className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {stats.avgGlucose !== null ? stats.avgGlucose : '—'}{' '}
            <span className="text-xs font-normal text-slate-400">ммоль/л</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Замеров: {stats.totalEntries} за {stats.activeDaysCount} дн.
          </div>
        </div>

        {/* TIR (Время в диапазоне 4.0 - 9.9) */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Время в норме (TIR)</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {stats.tir.normalPercent}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Цель врачей: &gt; 70% в норме
          </div>
        </div>

        {/* Расчетный HbA1c / GMI */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Расчетный HbA1c</span>
            <PieChart className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
            {stats.estimatedHbA1c !== null ? `${stats.estimatedHbA1c}%` : '—'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Оценка по формуле DCCT/GMI
          </div>
        </div>

        {/* Инсулины РинФаст и Тресиба в среднем за сутки */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Инсулин / день</span>
            <Syringe className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white">
            <span className="text-blue-600">{stats.avgDailyRinFast}</span> +{' '}
            <span className="text-purple-600">{stats.avgDailyTresiba}</span>{' '}
            <span className="text-xs font-normal text-slate-400">ед</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            РинФаст (болюс) + Тресиба (базал)
          </div>
        </div>
      </div>

      {/* 1. Интерактивный График Динамики Глюкозы с Целевым Зеленым Коридором */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              График динамики гликемии за месяц
            </h3>
            <p className="text-xs text-slate-500">
              Зеленый коридор — целевой диапазон 4.0 – 9.9 ммоль/л. Точки окрашены согласно статусу.
            </p>
          </div>

          {/* Легенда */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span>&lt; 3.9 Низкий</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>4.0 – 9.9 Норма</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span>10.0 – 13.9 Высокий</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-600" />
              <span>&gt; 13.9 Очень высокий</span>
            </span>
          </div>
        </div>

        {/* SVG Полотно графика */}
        <div className="relative overflow-x-auto">
          {monthEntries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-slate-400">
              В выбранном месяце нет данных замеров сахара
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
                        className="text-[10px] fill-slate-400 font-mono"
                      >
                        {level === 3.9 ? '3.9 гипо' : level}
                      </text>
                    </g>
                  );
                })}

                {/* Целевой Зеленый Коридор (Норма: 4.0 - 9.9) */}
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
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                />

                {/* Линия нормы 9.9 */}
                <line
                  x1={padding.left}
                  y1={yHighTarget}
                  x2={chartWidth - padding.right}
                  y2={yHighTarget}
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeOpacity="0.5"
                />

                {/* Подписи дней по X */}
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
                        className="text-[10px] fill-slate-400 font-medium"
                      >
                        {d} числ.
                      </text>
                    </g>
                  );
                })}

                {/* Соединительная линия тренда между точками */}
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
                  opacity="0.65"
                />

                {/* Точки замеров */}
                {monthEntries.map((e) => {
                  const x = getX(e.date, e.time);
                  const y = getY(e.glucose || 5.5);
                  const ev = evaluateGlucose(e.glucose);

                  const fillColor =
                    ev?.status === 'low'
                      ? '#ef4444'
                      : ev?.status === 'normal'
                      ? '#10b981'
                      : ev?.status === 'high'
                      ? '#f59e0b'
                      : '#e11d48';

                  const isHovered = hoveredPoint?.entry.id === e.id;

                  return (
                    <g
                      key={e.id}
                      className="cursor-pointer transition-transform"
                      onMouseEnter={() => setHoveredPoint({ x, y, entry: e })}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => setHoveredPoint({ x, y, entry: e })}
                    >
                      {/* Увеличенный круг при наведении */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 8 : 4.5}
                        fill={fillColor}
                        stroke="#ffffff"
                        strokeWidth={isHovered ? 2.5 : 1.5}
                        className="transition-all duration-150 shadow-md"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Всплывающая подсказка над точкой */}
              {hoveredPoint && (
                <div
                  className="absolute z-20 pointer-events-none p-3 rounded-xl bg-slate-900/95 text-white text-xs shadow-xl backdrop-blur-md border border-slate-700 space-y-1"
                  style={{
                    left: `${Math.min(chartWidth - 180, Math.max(20, hoveredPoint.x - 70))}px`,
                    top: `${Math.max(10, hoveredPoint.y - 110)}px`,
                  }}
                >
                  <div className="font-bold flex items-center justify-between gap-3 text-teal-300">
                    <span>{hoveredPoint.entry.date}</span>
                    <span>{hoveredPoint.entry.time}</span>
                  </div>
                  <div className="text-base font-extrabold flex items-center gap-1.5">
                    <span>{hoveredPoint.entry.glucose} ммоль/л</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/20">
                      {evaluateGlucose(hoveredPoint.entry.glucose)?.shortLabel}
                    </span>
                  </div>
                  {hoveredPoint.entry.rinFast && (
                    <div className="text-blue-300">💉 РинФаст: {hoveredPoint.entry.rinFast} ед</div>
                  )}
                  {hoveredPoint.entry.tresiba && (
                    <div className="text-purple-300">🌙 Тресиба: {hoveredPoint.entry.tresiba} ед</div>
                  )}
                  {hoveredPoint.entry.xe && (
                    <div className="text-amber-300">🍞 ХЕ: {hoveredPoint.entry.xe} ({hoveredPoint.entry.carbs} г)</div>
                  )}
                  {hoveredPoint.entry.notes && (
                    <div className="text-slate-300 italic max-w-[200px] truncate">
                      {hoveredPoint.entry.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Распределение TIR и Профиль по времени суток */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Время в целевом диапазоне (TIR Breakdown) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-emerald-500" />
              Целевой диапазон (Time in Range - TIR)
            </h3>
            <span className="text-xs text-slate-400">Всего замеров: {stats.totalEntries}</span>
          </div>

          {/* Мульти-полоса прогресса TIR */}
          <div className="h-6 w-full rounded-xl overflow-hidden flex shadow-inner bg-slate-100 dark:bg-slate-800">
            {stats.tir.lowPercent > 0 && (
              <div
                style={{ width: `${stats.tir.lowPercent}%` }}
                className="bg-red-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                title={`Низкий: ${stats.tir.lowPercent}%`}
              >
                {stats.tir.lowPercent >= 6 ? `${stats.tir.lowPercent}%` : ''}
              </div>
            )}
            {stats.tir.normalPercent > 0 && (
              <div
                style={{ width: `${stats.tir.normalPercent}%` }}
                className="bg-emerald-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                title={`Норма: ${stats.tir.normalPercent}%`}
              >
                {stats.tir.normalPercent >= 6 ? `${stats.tir.normalPercent}%` : ''}
              </div>
            )}
            {stats.tir.highPercent > 0 && (
              <div
                style={{ width: `${stats.tir.highPercent}%` }}
                className="bg-amber-500 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                title={`Высокий: ${stats.tir.highPercent}%`}
              >
                {stats.tir.highPercent >= 6 ? `${stats.tir.highPercent}%` : ''}
              </div>
            )}
            {stats.tir.veryHighPercent > 0 && (
              <div
                style={{ width: `${stats.tir.veryHighPercent}%` }}
                className="bg-rose-700 h-full flex items-center justify-center text-[10px] font-bold text-white transition-all"
                title={`Очень высокий: ${stats.tir.veryHighPercent}%`}
              >
                {stats.tir.veryHighPercent >= 6 ? `${stats.tir.veryHighPercent}%` : ''}
              </div>
            )}
          </div>

          {/* Детализация TIR категорий */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/40">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-semibold text-emerald-900 dark:text-emerald-300">Целевой диапазон (4.0 – 9.9)</span>
              </div>
              <div className="font-bold text-emerald-700 dark:text-emerald-400">
                {stats.tir.normalCount} замеров ({stats.tir.normalPercent}%)
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-semibold text-amber-900 dark:text-amber-300">Высокий (10.0 – 13.9)</span>
              </div>
              <div className="font-bold text-amber-700 dark:text-amber-400">
                {stats.tir.highCount} замеров ({stats.tir.highPercent}%)
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-700" />
                <span className="font-semibold text-rose-900 dark:text-rose-300">Очень высокий (&gt; 13.9)</span>
              </div>
              <div className="font-bold text-rose-700 dark:text-rose-400">
                {stats.tir.veryHighCount} замеров ({stats.tir.veryHighPercent}%)
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-200/50 dark:border-red-900/40">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="font-semibold text-red-900 dark:text-red-300">Низкий / Гипогликемия (&lt; 3.9)</span>
              </div>
              <div className="font-bold text-red-700 dark:text-red-400">
                {stats.tir.lowCount} замеров ({stats.tir.lowPercent}%)
              </div>
            </div>
          </div>
        </div>

        {/* Средний сахар по времени суток (Утро / День / Вечер / Ночь) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              Распределение по времени суток
            </h3>
            <span className="text-xs text-slate-400">Средние значения</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {timeOfDayStats.map((item) => {
              const evalRes = item.avg ? evaluateGlucose(item.avg) : null;

              return (
                <div
                  key={item.label}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{item.period}</span>
                    </div>
                    <div className="text-xl font-black font-mono mt-1">
                      {item.avg !== null ? (
                        <span className={evalRes?.textClass}>{item.avg} ммоль/л</span>
                      ) : (
                        <span className="text-slate-400 text-sm">нет замеров</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{item.count} замеров</span>
                    {evalRes && (
                      <span className={`px-1.5 py-0.2 rounded ${evalRes.badgeClass}`}>
                        {evalRes.shortLabel}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Аналитическая справка */}
          <div className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200">
            💡 <strong>Подсказка для врача:</strong> Обратите внимание на разницу между утренними (натощак) и вечерними замерами для точной подборки дозы базального инсулина <em>Тресиба</em>.
          </div>
        </div>

      </div>

      {/* 3. Суточные дозы инсулинов (РинФаст и Тресиба) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Syringe className="w-4 h-4 text-purple-600" />
              Суточные дозировки инсулинов (РинФаст vs Тресиба)
            </h3>
            <p className="text-xs text-slate-400">
              Соотношение базального (Тресиба) и болюсного (РинФаст) инсулина по дням
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-blue-600">
              <span className="w-3 h-3 rounded bg-blue-500" />
              <span>РинФаст (болюс)</span>
            </span>
            <span className="flex items-center gap-1.5 text-purple-600">
              <span className="w-3 h-3 rounded bg-purple-500" />
              <span>Тресиба (базал)</span>
            </span>
          </div>
        </div>

        {dailyInsulinData.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-xs text-slate-400">
            Нет данных об инъекциях за этот месяц
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[650px] flex items-end gap-2 h-44 pt-6 px-2 border-b border-slate-200 dark:border-slate-800">
              {dailyInsulinData.map((d) => {
                const maxVal = 45; // верхний предел шкалы
                const rfHeight = Math.min(100, (d.rinFast / maxVal) * 100);
                const trHeight = Math.min(100, (d.tresiba / maxVal) * 100);

                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    {/* Тултип */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-slate-900 text-white text-[10px] p-1.5 rounded-lg whitespace-nowrap shadow-md">
                      <div>{d.date}</div>
                      <div>РинФаст: {d.rinFast} ед</div>
                      <div>Тресиба: {d.tresiba} ед</div>
                    </div>

                    <div className="w-full flex items-end justify-center gap-0.5 h-32">
                      {/* РинФаст столбик */}
                      <div
                        style={{ height: `${rfHeight}%` }}
                        className="w-1/2 bg-blue-500 rounded-t-sm hover:brightness-110 transition-all"
                      />
                      {/* Тресиба столбик */}
                      <div
                        style={{ height: `${trHeight}%` }}
                        className="w-1/2 bg-purple-500 rounded-t-sm hover:brightness-110 transition-all"
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
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
