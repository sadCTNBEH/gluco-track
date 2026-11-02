import React from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { calculateMonthlyStats, evaluateGlucose } from '../utils/diabetes';
import { Target } from 'lucide-react';

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

  // Оценочный расчет eHbA1c по стандартной формуле DCCT/NGSP
  const estimatedHbA1c =
    stats.avgGlucose !== null
      ? Number(((stats.avgGlucose + 2.59) / 1.59).toFixed(1))
      : null;

  // Доли измерений
  const percentNormal = stats.tir.normalPercent;
  const percentLow = stats.tir.lowPercent;
  const percentHigh = stats.tir.highPercent + stats.tir.veryHighPercent;

  return (
    <div className="print:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-3">
        {/* Верхняя строка: Сводка ключевых показателей */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          
          {/* Левый блок: Пациент и цели */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-slate-600 dark:text-slate-400">
            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
              <span>Пациент: <strong>{patientName}</strong></span>
            </div>

            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>

            <div className="hidden sm:flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-slate-400" />
              <span>Целевой диапазон:</span>
              <strong className="font-mono text-slate-800 dark:text-slate-200">
                {settings.targetLow} – {settings.targetHigh} ммоль/л
              </strong>
            </div>

            <span className="hidden lg:inline text-slate-300 dark:text-slate-700">|</span>

            <div className="hidden lg:flex items-center gap-1.5">
              <span>1 ХЕ = <strong className="font-mono text-slate-800 dark:text-slate-200">{settings.xeRatio} г</strong></span>
            </div>
          </div>

          {/* Правый блок: Средняя глюкоза и Доля в целевом диапазоне */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {stats.avgGlucose !== null ? (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Ср. глюкоза:</span>
                <span className={`font-mono font-bold text-sm ${glucoseEval?.textClass}`}>
                  {stats.avgGlucose} ммоль/л
                </span>
                {glucoseEval && (
                  <span className={`text-xs px-1.5 py-0.2 rounded border font-medium ${glucoseEval.badgeClass}`}>
                    {glucoseEval.shortLabel}
                  </span>
                )}
              </div>
            ) : null}

            {stats.totalEntries > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <span>В целевом диапазоне:</span>
                <strong className="font-mono text-sm">{percentNormal}%</strong>
              </div>
            )}

            {estimatedHbA1c !== null && (
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400" title="Ориентировочный расчет (не заменяет лабораторный анализ HbA1c)">
                <span>eHbA1c:</span>
                <strong className="font-mono text-slate-900 dark:text-slate-100">~{estimatedHbA1c}%</strong>
              </div>
            )}
          </div>

        </div>

        {/* Нижняя строка: Распределение измерений + суточный инсулин */}
        {entries.length > 0 && stats.totalEntries > 0 && (
          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
            
            {/* Доля измерений в диапазоне */}
            <div className="flex-1 min-w-[240px] flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                Доля измерений в целевом диапазоне:
              </span>
              
              <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex">
                {percentLow > 0 && (
                  <div
                    style={{ width: `${percentLow}%` }}
                    className="bg-amber-500 h-full"
                    title={`Ниже цели (<3.9): ${percentLow}%`}
                  />
                )}
                {percentNormal > 0 && (
                  <div
                    style={{ width: `${percentNormal}%` }}
                    className="bg-emerald-600 h-full"
                    title={`В норме (4.0–9.9): ${percentNormal}%`}
                  />
                )}
                {percentHigh > 0 && (
                  <div
                    style={{ width: `${percentHigh}%` }}
                    className="bg-rose-600 h-full"
                    title={`Выше цели (>=10.0): ${percentHigh}%`}
                  />
                )}
              </div>

              {/* Легенда */}
              <div className="flex items-center gap-2.5 font-mono text-xs shrink-0">
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

            {/* Суточные дозы инсулинов */}
            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-xs shrink-0">
              {stats.avgDailyRinFast > 0 && (
                <span>
                  РинФаст (болюс): <strong className="font-mono text-slate-800 dark:text-slate-200">{stats.avgDailyRinFast} ед/сут</strong>
                </span>
              )}
              {stats.avgDailyTresiba > 0 && (
                <span>
                  Тресиба (базал): <strong className="font-mono text-slate-800 dark:text-slate-200">{stats.avgDailyTresiba} ед/сут</strong>
                </span>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
