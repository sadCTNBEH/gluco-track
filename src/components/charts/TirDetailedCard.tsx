import React from 'react';
import { MonthlyStats } from '../../types/diabetes';
import { PieChart } from 'lucide-react';

export interface TirDetailedCardProps {
  tir: MonthlyStats['tir'];
  totalEntries: number;
  targetLow: number;
  targetHigh: number;
}

export const TirDetailedCard: React.FC<TirDetailedCardProps> = React.memo(({
  tir,
  totalEntries,
  targetLow,
  targetHigh,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Доля измерений в диапазонах
        </h3>
        <span className="text-xs text-slate-400 font-mono">Всего замеров: {totalEntries}</span>
      </div>

      {/* Сегментированная полоса */}
      <div className="h-4 w-full rounded-md overflow-hidden flex bg-slate-100 dark:bg-slate-800">
        {tir.lowPercent > 0 && (
          <div
            style={{ width: `${tir.lowPercent}%` }}
            className="bg-amber-500 h-full flex items-center justify-center text-xs font-bold text-white"
            title={`Низкий: ${tir.lowPercent}%`}
          >
            {tir.lowPercent >= 8 ? `${tir.lowPercent}%` : ''}
          </div>
        )}
        {tir.normalPercent > 0 && (
          <div
            style={{ width: `${tir.normalPercent}%` }}
            className="bg-emerald-600 h-full flex items-center justify-center text-xs font-bold text-white"
            title={`В норме: ${tir.normalPercent}%`}
          >
            {tir.normalPercent >= 8 ? `${tir.normalPercent}%` : ''}
          </div>
        )}
        {tir.highPercent > 0 && (
          <div
            style={{ width: `${tir.highPercent}%` }}
            className="bg-orange-500 h-full flex items-center justify-center text-xs font-bold text-white"
            title={`Высокий: ${tir.highPercent}%`}
          >
            {tir.highPercent >= 8 ? `${tir.highPercent}%` : ''}
          </div>
        )}
        {tir.veryHighPercent > 0 && (
          <div
            style={{ width: `${tir.veryHighPercent}%` }}
            className="bg-rose-600 h-full flex items-center justify-center text-xs font-bold text-white"
            title={`Очень высокий: ${tir.veryHighPercent}%`}
          >
            {tir.veryHighPercent >= 8 ? `${tir.veryHighPercent}%` : ''}
          </div>
        )}
      </div>

      {/* Детализация категорий */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
            <span className="font-semibold text-emerald-900 dark:text-emerald-300">
              Целевой диапазон ({targetLow} – {targetHigh})
            </span>
          </div>
          <div className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
            {tir.normalCount} ({tir.normalPercent}%)
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
            <span className="font-semibold text-orange-900 dark:text-orange-300">
              Высокий (&gt; {targetHigh})
            </span>
          </div>
          <div className="font-mono font-bold text-orange-800 dark:text-orange-300">
            {tir.highCount} ({tir.highPercent}%)
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 shrink-0" />
            <span className="font-semibold text-rose-900 dark:text-rose-300">
              Очень высокий (&gt; 13.9)
            </span>
          </div>
          <div className="font-mono font-bold text-rose-800 dark:text-rose-300">
            {tir.veryHighCount} ({tir.veryHighPercent}%)
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-semibold text-amber-900 dark:text-amber-300">
              Низкий (&lt; 3.9)
            </span>
          </div>
          <div className="font-mono font-bold text-amber-800 dark:text-amber-300">
            {tir.lowCount} ({tir.lowPercent}%)
          </div>
        </div>
      </div>
    </div>
  );
});

TirDetailedCard.displayName = 'TirDetailedCard';
