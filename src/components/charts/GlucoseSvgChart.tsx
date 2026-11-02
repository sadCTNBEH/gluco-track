import React, { useState } from 'react';
import { DiaryEntry, UserSettings } from '../../types/diabetes';
import { evaluateGlucose } from '../../utils/diabetes';
import { Activity } from 'lucide-react';

export const CHART_DIMENSIONS = {
  chartWidth: 900,
  chartHeight: 320,
  padding: { top: 25, right: 30, bottom: 40, left: 65 },
  minGlucoseY: 2.0,
  maxGlucoseY: 18.0,
  daysInMonth: 31,
};

export function getSvgCoordinates(
  val: number,
  dateStr: string,
  timeStr: string,
  dims = CHART_DIMENSIONS
) {
  const innerWidth = dims.chartWidth - dims.padding.left - dims.padding.right;
  const innerHeight = dims.chartHeight - dims.padding.top - dims.padding.bottom;

  const clamped = Math.max(dims.minGlucoseY, Math.min(dims.maxGlucoseY, val));
  const y =
    dims.padding.top +
    innerHeight -
    ((clamped - dims.minGlucoseY) / (dims.maxGlucoseY - dims.minGlucoseY)) * innerHeight;

  const dayNum = parseInt((dateStr || '').slice(8, 10), 10) || 1;
  const [hh, mm] = (timeStr || '12:00').split(':').map(Number);
  const validHh = isNaN(hh) ? 12 : hh;
  const validMm = isNaN(mm) ? 0 : mm;
  const fraction = (dayNum - 1 + (validHh + validMm / 60) / 24) / dims.daysInMonth;
  const x = dims.padding.left + fraction * innerWidth;

  return { x, y };
}

export interface GlucoseSvgChartProps {
  monthEntries: DiaryEntry[];
  settings?: UserSettings;
  bolusName?: string;
  basalName?: string;
}

export const GlucoseSvgChart: React.FC<GlucoseSvgChartProps> = React.memo(({
  monthEntries,
  settings,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    entry: DiaryEntry;
  } | null>(null);

  const { chartWidth, chartHeight, padding, daysInMonth } = CHART_DIMENSIONS;
  const innerWidth = chartWidth - padding.left - padding.right;

  const targetLow = settings?.targetLow ?? 4.0;
  const targetHigh = settings?.targetHigh ?? 9.9;
  const hypoThreshold = settings?.hypoThreshold ?? 3.9;

  const { y: yLowTarget } = getSvgCoordinates(targetLow, '2026-01-01', '12:00');
  const { y: yHighTarget } = getSvgCoordinates(targetHigh, '2026-01-01', '12:00');

  return (
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
                const { y } = getSvgCoordinates(level, '2026-01-01', '12:00');
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
                    const { x, y } = getSvgCoordinates(e.glucose || 5.5, e.date, e.time);
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
                const { x, y } = getSvgCoordinates(e.glucose || 5.5, e.date, e.time);
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
                {hoveredPoint.entry.rinFast ? (
                  <div className="text-blue-300 font-mono">{bolusName}: {hoveredPoint.entry.rinFast} ед</div>
                ) : null}
                {hoveredPoint.entry.tresiba ? (
                  <div className="text-purple-300 font-mono">{basalName}: {hoveredPoint.entry.tresiba} ед</div>
                ) : null}
                {hoveredPoint.entry.xe ? (
                  <div className="text-teal-300 font-mono">
                    ХЕ: {hoveredPoint.entry.xe} ({hoveredPoint.entry.carbs} г)
                  </div>
                ) : null}
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
  );
});

GlucoseSvgChart.displayName = 'GlucoseSvgChart';
