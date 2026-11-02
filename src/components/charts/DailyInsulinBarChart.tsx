import React, { useMemo } from 'react';
import { DiaryEntry } from '../../types/diabetes';
import { Syringe } from 'lucide-react';

export interface DailyInsulinData {
  date: string;
  rinFast: number;
  tresiba: number;
  carbs: number;
}

export function calculateDailyInsulinData(entries: DiaryEntry[], selectedMonth: string): DailyInsulinData[] {
  const dayMap: Record<string, DailyInsulinData> = {};

  const allMonthEntries = entries.filter((e) => e.date && e.date.startsWith(selectedMonth));
  for (const e of allMonthEntries) {
    if (!dayMap[e.date]) {
      dayMap[e.date] = { rinFast: 0, tresiba: 0, carbs: 0, date: e.date };
    }
    if (e.rinFast) dayMap[e.date].rinFast += e.rinFast;
    if (e.tresiba) dayMap[e.date].tresiba += e.tresiba;
    if (e.carbs) dayMap[e.date].carbs += e.carbs;
  }

  return Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
}

export interface DailyInsulinBarChartProps {
  entries: DiaryEntry[];
  selectedMonth: string;
  bolusName?: string;
  basalName?: string;
}

export const DailyInsulinBarChart: React.FC<DailyInsulinBarChartProps> = React.memo(({
  entries,
  selectedMonth,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
}) => {
  const dailyInsulinData = useMemo(() => {
    return calculateDailyInsulinData(entries, selectedMonth);
  }, [entries, selectedMonth]);

  return (
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
  );
});

DailyInsulinBarChart.displayName = 'DailyInsulinBarChart';
