import React, { useMemo } from 'react';
import { DiaryEntry, UserSettings } from '../../types/diabetes';
import { evaluateGlucose } from '../../utils/diabetes';
import { BarChart3 } from 'lucide-react';

export interface TimeOfDayItem {
  label: string;
  period: string;
  sum: number;
  count: number;
  avg: number | null;
}

export function calculateTimeOfDayStats(monthEntries: DiaryEntry[]): TimeOfDayItem[] {
  const buckets: { label: string; period: string; sum: number; count: number }[] = [
    { label: 'Утро', period: '06:00 – 12:00', sum: 0, count: 0 },
    { label: 'День', period: '12:00 – 18:00', sum: 0, count: 0 },
    { label: 'Вечер', period: '18:00 – 23:00', sum: 0, count: 0 },
    { label: 'Ночь', period: '23:00 – 06:00', sum: 0, count: 0 },
  ];

  for (const e of monthEntries) {
    if (e.glucose === null || e.glucose === undefined || e.glucose <= 0) continue;
    const hour = parseInt((e.time || '12:00').split(':')[0], 10);
    const validHour = isNaN(hour) ? 12 : hour;

    if (validHour >= 6 && validHour < 12) {
      buckets[0].sum += e.glucose;
      buckets[0].count++;
    } else if (validHour >= 12 && validHour < 18) {
      buckets[1].sum += e.glucose;
      buckets[1].count++;
    } else if (validHour >= 18 && validHour < 23) {
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
}

export interface TimeOfDayDistributionProps {
  monthEntries: DiaryEntry[];
  settings?: UserSettings;
  basalName?: string;
}

export const TimeOfDayDistribution: React.FC<TimeOfDayDistributionProps> = React.memo(({
  monthEntries,
  settings,
  basalName = 'Тресиба',
}) => {
  const timeOfDayStats = useMemo(() => {
    return calculateTimeOfDayStats(monthEntries);
  }, [monthEntries]);

  return (
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
        Подсказка: Сравните замеры натощак и на ночь для оценки адекватности дозы базального инсулина {basalName}.
      </p>
    </div>
  );
});

TimeOfDayDistribution.displayName = 'TimeOfDayDistribution';
