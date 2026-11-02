import React from 'react';
import { MonthlyStats } from '../../types/diabetes';
import { Activity, Award, PieChart, Syringe } from 'lucide-react';

export interface MonthlySummaryCardsProps {
  stats: MonthlyStats;
  targetLow: number;
  targetHigh: number;
  bolusName?: string;
  basalName?: string;
}

export const MonthlySummaryCards: React.FC<MonthlySummaryCardsProps> = React.memo(({
  stats,
  targetLow,
  targetHigh,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
}) => {
  return (
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
  );
});

MonthlySummaryCards.displayName = 'MonthlySummaryCards';
