import React from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { calculateMonthlyStats, evaluateGlucose } from '../utils/diabetes';
import {
  Activity,
  Award,
  Syringe,
  Utensils,
  TrendingDown,
  TrendingUp,
  Target,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface TelemetryBarProps {
  entries: DiaryEntry[];
  settings: UserSettings;
  patientName: string;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  entries,
  settings,
  patientName,
}) => {
  const stats = calculateMonthlyStats(entries);
  const glucoseEval = stats.avgGlucose !== null ? evaluateGlucose(stats.avgGlucose) : null;

  // Расчет предполагаемого гликированного гемоглобина (eHbA1c ~ (Ср.сахар + 2.59) / 1.59 по формуле NGSP/DCCT)
  const estimatedHbA1c =
    stats.avgGlucose !== null
      ? Number(((stats.avgGlucose + 2.59) / 1.59).toFixed(1))
      : null;

  // TIR доли
  const tirNormal = stats.tir.normalPercent;
  const tirLow = stats.tir.lowPercent;
  const tirHigh = stats.tir.highPercent + stats.tir.veryHighPercent;

  return (
    <div className="print:hidden border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Верхняя строка: Пациент, Цели и Ключевые метрики */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Левый блок: инфо о пациенте и целевом коридоре */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 font-semibold text-slate-800 dark:text-slate-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Пациент: <strong className="text-teal-700 dark:text-teal-300">{patientName}</strong></span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Target className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Целевой коридор:</span>
              <strong className="font-mono text-slate-700 dark:text-slate-300">
                {settings.targetLow} – {settings.targetHigh} ммоль/л
              </strong>
            </div>

            <div className="hidden lg:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Utensils className="w-3.5 h-3.5 text-slate-400" />
              <span>ХЕ:</span>
              <strong className="text-slate-700 dark:text-slate-300">1 ХЕ = {settings.xeRatio} г</strong>
            </div>
          </div>

          {/* Правый блок: Экспресс-виджеты TIR и Средней гликемии */}
          <div className="flex flex-wrap items-center gap-2">
            {stats.avgGlucose !== null && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                <span className="text-slate-500 dark:text-slate-400">Ср. гликемия:</span>
                <span className={`font-mono font-bold ${glucoseEval?.textClass}`}>
                  {stats.avgGlucose} ммоль/л
                </span>
                {estimatedHbA1c !== null && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-500/20 font-mono" title="Оценочный гликированный гемоглобин (eHbA1c)">
                    eHbA1c ~{estimatedHbA1c}%
                  </span>
                )}
              </div>
            )}

            {/* TIR виджет */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/25 text-emerald-800 dark:text-emerald-300 font-medium shadow-xs">
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>TIR: <strong className="font-mono">{tirNormal}%</strong> в норме</span>
            </div>
          </div>

        </div>

        {/* Нижняя полоса: Сегментированный Time In Range прогресс-бар и распределение доз */}
        {entries.length > 0 && stats.totalEntries > 0 && (
          <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            
            {/* Клинический TIR сегментированный индикатор */}
            <div className="flex-1 min-w-[240px] flex items-center gap-3">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
                Время в целевом диапазоне (TIR):
              </span>
              
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex shadow-inner">
                {/* Низкий (<3.9) */}
                {tirLow > 0 && (
                  <div
                    style={{ width: `${tirLow}%` }}
                    className="bg-amber-500 h-full transition-all duration-500 relative group"
                    title={`Ниже цели (<3.9): ${tirLow}%`}
                  />
                )}
                {/* Норма (4.0-9.9) */}
                {tirNormal > 0 && (
                  <div
                    style={{ width: `${tirNormal}%` }}
                    className="bg-emerald-500 h-full transition-all duration-500 relative group"
                    title={`В норме (4.0-9.9): ${tirNormal}%`}
                  />
                )}
                {/* Выше цели (>=10.0) */}
                {tirHigh > 0 && (
                  <div
                    style={{ width: `${tirHigh}%` }}
                    className="bg-rose-500 h-full transition-all duration-500 relative group"
                    title={`Выше цели (>=10.0): ${tirHigh}%`}
                  />
                )}
              </div>

              {/* Легенда процентов */}
              <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {tirNormal}%
                </span>
                <span className="text-amber-500 font-bold flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {tirLow}%
                </span>
                <span className="text-rose-500 font-bold flex items-center gap-0.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {tirHigh}%
                </span>
              </div>
            </div>

            {/* Суточные инсулины и углеводы */}
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] shrink-0 font-medium">
              {stats.avgDailyRinFast > 0 && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <Syringe className="w-3 h-3" />
                  РинФаст ср.: <strong className="font-mono">{stats.avgDailyRinFast} ед/сут</strong>
                </span>
              )}
              {stats.avgDailyTresiba > 0 && (
                <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                  <Syringe className="w-3 h-3" />
                  Тресиба ср.: <strong className="font-mono">{stats.avgDailyTresiba} ед/сут</strong>
                </span>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
