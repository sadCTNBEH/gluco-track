import React from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { calculateMonthlyStats, evaluateGlucose } from '../utils/diabetes';
import { Activity, Award, Target, Syringe, Moon } from 'lucide-react';

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
  const stats = calculateMonthlyStats(entries, undefined, settings);
  const glucoseEval = stats.avgGlucose !== null ? evaluateGlucose(stats.avgGlucose, settings) : null;

  const bolusName = settings.bolusName || 'РинФаст';
  const basalName = settings.basalName || 'Тресиба';

  const estimatedHbA1c =
    stats.avgGlucose !== null
      ? Number(((stats.avgGlucose + 2.59) / 1.59).toFixed(1))
      : null;

  const percentNormal = stats.tir.normalPercent;
  const percentLow = stats.tir.lowPercent;
  const percentHigh = stats.tir.highPercent + stats.tir.veryHighPercent;

  return (
    <section
      aria-label="Сводка ключевых показателей здоровья"
      className="print:hidden border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 py-4 px-4 sm:px-6 transition-colors shadow-xs"
    >
      <div className="max-w-7xl mx-auto space-y-3.5">
        
        {/* Top Patient Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3.5">
            <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
              <span>Пациент: <strong>{patientName}</strong></span>
            </span>

            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>

            <span className="hidden sm:inline">
              Цель: <strong className="font-mono text-slate-800 dark:text-slate-200">{settings.targetLow} – {settings.targetHigh} ммоль/л</strong>
            </span>

            <span className="hidden md:inline text-slate-300 dark:text-slate-700">•</span>

            <span className="hidden md:inline">
              1 ХЕ = <strong className="font-mono text-slate-800 dark:text-slate-200">{settings.xeRatio} г</strong>
            </span>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            {stats.totalEntries > 0 ? (
              <span>Всего замеров: <strong>{stats.totalEntries}</strong> ({stats.activeDaysCount} дн.)</span>
            ) : (
              <span>Нет сохраненных замеров</span>
            )}
          </div>
        </div>

        {/* 4 Apple Health Style Telemetry Widget Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1: Средняя гликемия */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex flex-col justify-between space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Средняя глюкоза</span>
              <div className="w-6 h-6 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums ${glucoseEval ? glucoseEval.textClass : 'text-slate-900 dark:text-white'}`}>
                  {stats.avgGlucose !== null ? stats.avgGlucose : '—'}
                </span>
                <span className="text-xs text-slate-400 font-sans">ммоль/л</span>
              </div>

              {glucoseEval ? (
                <div className="mt-1 flex items-center gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${glucoseEval.badgeClass}`}>
                    {glucoseEval.shortLabel}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">нет данных</span>
              )}
            </div>
          </div>

          {/* Card 2: Доля в целевом диапазоне */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex flex-col justify-between space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">В целевом диапазоне</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Award className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {stats.totalEntries > 0 ? `${percentNormal}%` : '—'}
                </span>
              </div>

              {/* Multi-segment micro bar */}
              {stats.totalEntries > 0 ? (
                <div className="space-y-1 mt-1.5">
                  <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex w-full">
                    {percentLow > 0 && (
                      <div style={{ width: `${percentLow}%` }} className="bg-amber-500 h-full" title={`Низкий: ${percentLow}%`} />
                    )}
                    {percentNormal > 0 && (
                      <div style={{ width: `${percentNormal}%` }} className="bg-emerald-600 h-full" title={`В норме: ${percentNormal}%`} />
                    )}
                    {percentHigh > 0 && (
                      <div style={{ width: `${percentHigh}%` }} className="bg-rose-600 h-full" title={`Выше нормы: ${percentHigh}%`} />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span className="text-amber-600 dark:text-amber-400">Гипо {percentLow}%</span>
                    <span className="text-rose-600 dark:text-rose-400">Гипер {percentHigh}%</span>
                  </div>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400 mt-1 block">нет данных</span>
              )}
            </div>
          </div>

          {/* Card 3: Оценочный eHbA1c */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex flex-col justify-between space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Расчетный eHbA1c</span>
              <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <Target className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {estimatedHbA1c !== null ? `~${estimatedHbA1c}%` : '—'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block leading-tight">
                Ориентировочно (GMI) • не заменяет лабораторию
              </span>
            </div>
          </div>

          {/* Card 4: Инсулинотерапия с учетом полных дней */}
          <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 flex flex-col justify-between space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Инсулин / сутки</span>
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Syringe className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-blue-700 dark:text-blue-400 font-semibold">{bolusName}:</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.avgDailyRinFast > 0 ? `${stats.avgDailyRinFast} ед` : '—'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-mono">
                  <span className="text-purple-700 dark:text-purple-400 font-semibold">{basalName}:</span>
                  <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                    {stats.avgDailyTresiba > 0 ? `${stats.avgDailyTresiba} ед` : '—'}
                  </span>
                </div>
              </div>

              <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-700/60 text-[10px] text-slate-400">
                {stats.fullDaysCount && stats.fullDaysCount > 0 ? (
                  <span className="text-teal-700 dark:text-teal-300 font-medium">
                    Учет полных дней: {stats.fullDaysCount} дн.
                  </span>
                ) : (
                  <span>Болюс и базал</span>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
