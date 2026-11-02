import React from 'react';
import { UserSettings } from '../../types/diabetes';
import { Activity, FlaskConical } from 'lucide-react';

export interface ClinicalThresholdsSectionProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
}

export const ClinicalThresholdsSection: React.FC<ClinicalThresholdsSectionProps> = React.memo(({
  settings,
  onUpdateSettings,
}) => {
  return (
    <>
      {/* Целевые уровни сахара в крови */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Целевой диапазон сахара в крови
          </h4>
          <span className="text-[10px] text-slate-400">Границы нормы и гипо</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="settings-hypo-threshold"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
            >
              Порог гипогликемии (низкий сахар ≤):
            </label>
            <div className="relative">
              <input
                id="settings-hypo-threshold"
                type="number"
                step="0.1"
                min="2.0"
                max="6.0"
                value={settings.hypoThreshold ?? 3.9}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    onUpdateSettings({
                      ...settings,
                      hypoThreshold: val,
                      targetLow: Number((val + 0.1).toFixed(1)),
                    });
                  }
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-16"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                ммоль/л
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              По умолчанию: 3.9 (значения ≤ этого порога считаются гипогликемией)
            </p>
          </div>

          <div>
            <label
              htmlFor="settings-target-high"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
            >
              Верхний порог (высокий сахар &gt;):
            </label>
            <div className="relative">
              <input
                id="settings-target-high"
                type="number"
                step="0.1"
                min="6.0"
                max="15.0"
                value={settings.targetHigh ?? 9.9}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    onUpdateSettings({ ...settings, targetHigh: val });
                  }
                }}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-16"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                ммоль/л
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              По умолчанию: 9.9 (значения &gt; этого порога считаются повышенными)
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200/60 dark:border-teal-900/40 text-xs text-teal-900 dark:text-teal-200 flex items-center justify-between">
          <span className="font-medium">Целевой диапазон нормы:</span>
          <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
            {settings.targetLow ?? Number(((settings.hypoThreshold ?? 3.9) + 0.1).toFixed(1))} – {settings.targetHigh ?? 9.9} ммоль/л
          </span>
        </div>
      </div>

      {/* Клинические маркеры (eHbA1c и ACR) для отчета врача */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Клинические маркеры (для отчета врача)
          </h4>
          <span className="text-[10px] text-slate-400">Лабораторные анализы</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="settings-ehba1c"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
            >
              eHbA1c (гликированный гемоглобин):
            </label>
            <div className="relative">
              <input
                id="settings-ehba1c"
                type="number"
                step="0.1"
                min="3.0"
                max="16.0"
                value={settings.eHbA1c ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                  onUpdateSettings({ ...settings, eHbA1c: val });
                }}
                placeholder="Например: 6.5"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-12"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                %
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Лабораторное или целевое значение (отображается в отчете)
            </p>
          </div>

          <div>
            <label
              htmlFor="settings-acr"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
            >
              ACR (альбумин/креатинин мочи):
            </label>
            <div className="relative">
              <input
                id="settings-acr"
                type="number"
                step="0.1"
                min="0.0"
                max="50.0"
                value={settings.acr ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                  onUpdateSettings({ ...settings, acr: val });
                }}
                placeholder="Например: 2.1"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors pr-22"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                мг/ммоль
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Соотношение альбумин/креатинин в утренней порции мочи (норма &lt; 3.0)
            </p>
          </div>
        </div>
      </div>
    </>
  );
});

ClinicalThresholdsSection.displayName = 'ClinicalThresholdsSection';
