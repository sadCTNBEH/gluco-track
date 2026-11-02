import React from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { calculateMonthlyStats, evaluateGlucose } from '../utils/diabetes';
import { Target, Activity, Award, Syringe } from 'lucide-react';

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

  const bolusName = settings.bolusName || 'РинФаст';
  const basalName = settings.basalName || 'Тресиба';

  // Оценочный расчет eHbA1c по формуле DCCT/NGSP
  const estimatedHbA1c =
    stats.avgGlucose !== null
      ? Number(((stats.avgGlucose + 2.59) / 1.59).toFixed(1))
      : null;

  const percentNormal = stats.tir.normalPercent;
  const percentLow = stats.tir.lowPercent;
  const percentHigh = stats.tir.highPercent + stats.tir.veryHighPercent;

  return (
    <section
      aria-label="Сводка самоконтроля"
      className="print:hidden border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs py-3.5 px-4 sm:px-6 transition-colors"
    >
      <div className="max-w-7xl mx-auto space-y-3">
        
        {/* Информационная строка: Пациент, целевые значения, пропорция ХЕ */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-slate-600 dark:text-slate-400">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
              <span>Пациент: <strong className="text-slate-900 dark:text-white">{patientName}</strong></span>
            </div>

            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

            <div className="hidden sm:flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-slate-400" />
              <span>Цель:</span>
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {settings.targetLow} – {settings.targetHigh} ммоль/л
              </strong>
            </div>

            <span className="hidden lg:inline text-slate-300 dark:text-slate-700">|</span>

            <div className="hidden lg:flex items-center gap-1.5">
              <span>Терапия:</span>
              <strong className="text-slate-800 dark:text-slate-200">
                {bolusName} + {basalName}
              </strong>
            </div>

            <span className="hidden lg:inline text-slate-300 dark:text-slate-700">|</span>

            <div className="hidden lg:flex items-center gap-1.5">
              <span>1 ХЕ = <strong className="font-mono text-slate-800 dark:text-slate-200">{settings.xeRatio} г</strong></span>
            </div>
          </div>

          {/* Правый блок: Средняя глюкоза и целевой диапазон */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {stats.avgGlucose !== null && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs shadow-xs">
                <Activity className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Ср. сахар:</span>
                <span className={`font-mono font-bold text-sm tabular-nums ${glucoseEval?.textClass}`}>
                  {stats.avgGlucose} ммоль/л
                </span>
                {glucoseEval && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${glucoseEval.badgeClass}`}>
                    {glucoseEval.shortLabel}
                  </span>
                )}
              </div>
            )}

            {stats.totalEntries > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold shadow-xs">
                <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>В целевом диапазоне:</span>
                <strong className="font-mono text-sm tabular-nums">{percentNormal}%</strong>
              </div>
            )}

            {estimatedHbA1c !== null && (
              <div
                className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400 shadow-xs"
                title="Ориентировочный расчет eHbA1c (не заменяет лабораторный анализ)"
              >
                <span>eHbA1c:</span>
                <strong className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">~{estimatedHbA1c}%</strong>
              </div>
            )}
          </div>

        </div>

        {/* Нижняя полоса: Пропорция измерений + суточные дозы инсулинов */}
        {entries.length > 0 && stats.totalEntries > 0 && (
          <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            
            {/* Доля измерений в диапазоне со шкалой */}
            <div className="flex-1 min-w-[240px] flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                Доля в целевом диапазоне:
              </span>
              
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex">
                {percentLow > 0 && (
                  <div
                    style={{ width: `${percentLow}%` }}
                    className="bg-amber-500 h-full transition-all"
                    title={`Ниже цели (<3.9): ${percentLow}%`}
                  />
                )}
                {percentNormal > 0 && (
                  <div
                    style={{ width: `${percentNormal}%` }}
                    className="bg-emerald-600 h-full transition-all"
                    title={`В норме (4.0–9.9): ${percentNormal}%`}
                  />
                )}
                {percentHigh > 0 && (
                  <div
                    style={{ width: `${percentHigh}%` }}
                    className="bg-rose-600 h-full transition-all"
                    title={`Выше цели (>=10.0): ${percentHigh}%`}
                  />
                )}
              </div>

              {/* Легенда */}
              <div className="flex items-center gap-2.5 font-mono text-xs shrink-0 tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {percentNormal}%
                </span>
                <span className="text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {percentLow}%
                </span>
                <span className="text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  {percentHigh}%
                </span>
              </div>
            </div>

            {/* Суточные дозы инсулинов: учет полных дней */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-slate-600 dark:text-slate-400 text-xs shrink-0">
              {stats.avgDailyRinFast > 0 && (
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 text-blue-900 dark:text-blue-300"
                  title={
                    stats.fullDaysCount && stats.fullDaysCount > 0
                      ? `Рассчитано по ${stats.fullDaysCount} полным дням, где были указаны утро, день, вечер и ночь`
                      : 'Среднесуточный болюс'
                  }
                >
                  <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>{bolusName}:</span>
                  <strong className="font-mono text-blue-950 dark:text-blue-100 tabular-nums">
                    {stats.avgDailyRinFast} ед/сут
                  </strong>
                  {stats.fullDaysCount && stats.fullDaysCount > 0 ? (
                    <span className="text-[10px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-semibold font-mono">
                      {stats.fullDaysCount} дн. (полн.)
                    </span>
                  ) : null}
                </div>
              )}

              {stats.avgDailyTresiba > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50 text-purple-900 dark:text-purple-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                  <span>{basalName}:</span>
                  <strong className="font-mono text-purple-950 dark:text-purple-100 tabular-nums">
                    {stats.avgDailyTresiba} ед/сут
                  </strong>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </section>
  );
};
