import React from 'react';
import { UserSettings } from '../../types/diabetes';
import { Syringe, Moon } from 'lucide-react';

export interface InsulinTherapySectionProps {
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
}

export const InsulinTherapySection: React.FC<InsulinTherapySectionProps> = React.memo(({
  settings,
  onUpdateSettings,
}) => {
  return (
    <>
      {/* Данные пациента и углеводы */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Данные пациента и углеводы
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="settings-patient-name"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
            >
              ФИО пациента:
            </label>
            <input
              id="settings-patient-name"
              type="text"
              value={settings.patientName}
              onChange={(e) => onUpdateSettings({ ...settings, patientName: e.target.value })}
              placeholder="Иванов И.И."
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="settings-xe-ratio"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5"
            >
              Грамм углеводов в 1 ХЕ:
            </label>
            <input
              id="settings-xe-ratio"
              type="number"
              step="1"
              min="8"
              max="15"
              value={settings.xeRatio}
              onChange={(e) =>
                onUpdateSettings({ ...settings, xeRatio: Number(e.target.value) || 12 })
              }
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono font-bold transition-colors"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              Клинический стандарт РФ: 12 г (в некоторых школах 10 г или 11 г)
            </p>
          </div>
        </div>
      </div>

      {/* Названия используемых инсулинов */}
      <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Используемые препараты инсулина
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="settings-bolus-name"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5"
            >
              <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Болюсный (короткий на еду):
            </label>
            <input
              id="settings-bolus-name"
              type="text"
              value={settings.bolusName ?? 'РинФаст'}
              onChange={(e) => onUpdateSettings({ ...settings, bolusName: e.target.value })}
              placeholder="Например: РинФаст, НовоРапид, Хумалог"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              По умолчанию: РинФаст
            </p>
          </div>

          <div>
            <label
              htmlFor="settings-basal-name"
              className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 flex items-center gap-1.5"
            >
              <Moon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Базальный (длинный на ночь):
            </label>
            <input
              id="settings-basal-name"
              type="text"
              value={settings.basalName ?? 'Тресиба'}
              onChange={(e) => onUpdateSettings({ ...settings, basalName: e.target.value })}
              placeholder="Например: Тресиба, Лантус, Туджео"
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
            />
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              По умолчанию: Тресиба
            </p>
          </div>
        </div>
      </div>
    </>
  );
});

InsulinTherapySection.displayName = 'InsulinTherapySection';
