import React, { useState, useMemo } from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import {
  evaluateGlucose,
  calculateDayAggregates,
  calculateDailyInsulinAverages,
  formatDateRussian,
} from '../utils/diabetes';
import {
  Printer,
  FileText,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface DoctorReportPdfProps {
  entries: DiaryEntry[];
  settings: UserSettings;
  onUpdateSettings: (settings: UserSettings) => void;
}

export const DoctorReportPdf: React.FC<DoctorReportPdfProps> = ({
  entries,
  settings,
  onUpdateSettings,
}) => {
  const [reportPeriod, setReportPeriod] = useState<'7d' | '14d' | '30d' | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const bolusName = settings.bolusName || 'РинФаст';
  const basalName = settings.basalName || 'Тресиба';

  // Фильтруем записи по выбранному периоду
  const filteredEntries = useMemo(() => {
    if (reportPeriod === 'all') return entries;

    const daysCount = reportPeriod === '7d' ? 7 : reportPeriod === '14d' ? 14 : 30;
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysCount);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    return entries.filter((e) => e.date >= cutoffStr);
  }, [entries, reportPeriod]);

  // Группировка по дням с двунаправленной сортировкой:
  // Если sortOrder === 'newest' (дни от новых к старым):
  //   Дни идут снизу вверх (старые внизу, новые вверху).
  //   Время внутри дня тоже идет снизу вверх (утро внизу, ночь вверху => сверху вниз b.time.localeCompare(a.time)).
  // Если sortOrder === 'oldest' (дни от старых к новым):
  //   Дни идут сверху вниз (старые вверху, новые внизу).
  //   Время внутри дня идет сверху вниз (утро вверху, ночь внизу => сверху вниз a.time.localeCompare(b.time)).
  const groupedDays = useMemo(() => {
    const groups: Record<string, DiaryEntry[]> = {};
    for (const e of filteredEntries) {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    }

    const sortedDates = Object.keys(groups).sort((a, b) => {
      return sortOrder === 'newest' ? b.localeCompare(a) : a.localeCompare(b);
    });

    return sortedDates.map((date) => {
      const dayEntries = groups[date].sort((a, b) => {
        return sortOrder === 'newest'
          ? b.time.localeCompare(a.time)
          : a.time.localeCompare(b.time);
      });

      return {
        date,
        entries: dayEntries,
        summary: calculateDayAggregates(dayEntries),
      };
    });
  }, [filteredEntries, sortOrder]);

  // Расчет суммарной статистики за период
  const stats = useMemo(() => {
    let glucoseSum = 0;
    let glucoseCount = 0;
    let totalRinFast = 0;
    let totalTresiba = 0;
    let totalCarbs = 0;
    let totalCalories = 0;
    let lowCount = 0;
    let normalCount = 0;
    let highCount = 0;
    let veryHighCount = 0;
    const daysSet = new Set<string>();
    const daysMap: Record<string, DiaryEntry[]> = {};

    for (const e of filteredEntries) {
      daysSet.add(e.date);
      if (!daysMap[e.date]) daysMap[e.date] = [];
      daysMap[e.date].push(e);

      if (e.glucose !== null && e.glucose > 0) {
        glucoseSum += e.glucose;
        glucoseCount++;
        const ev = evaluateGlucose(e.glucose, settings);
        if (ev?.status === 'low') lowCount++;
        else if (ev?.status === 'normal') normalCount++;
        else if (ev?.status === 'high') highCount++;
        else if (ev?.status === 'very_high') veryHighCount++;
      }
      if (e.rinFast) totalRinFast += e.rinFast;
      if (e.tresiba) totalTresiba += e.tresiba;
      if (e.carbs) totalCarbs += e.carbs;
      if (e.calories) totalCalories += e.calories;
    }

    const activeDays = daysSet.size || 1;
    const avgG = glucoseCount > 0 ? Number((glucoseSum / glucoseCount).toFixed(1)) : null;
    const hba1c = avgG ? Number(((avgG * 18.05 + 46.7) / 28.7).toFixed(1)) : null;

    // Расчет среднесуточных доз болюса и базала с учетом полных дней (утро, день, вечер)
    const insulinStats = calculateDailyInsulinAverages(daysMap);

    const tirTotal = glucoseCount || 1;
    return {
      activeDays,
      entriesCount: filteredEntries.length,
      glucoseCount,
      avgGlucose: avgG,
      estimatedHbA1c: hba1c,
      totalRinFast: Number(totalRinFast.toFixed(1)),
      avgRinFast: insulinStats.avgDailyRinFast,
      totalTresiba: Number(totalTresiba.toFixed(1)),
      avgTresiba: insulinStats.avgDailyTresiba,
      fullDaysCount: insulinStats.fullDaysCount,
      totalCarbs: Math.round(totalCarbs),
      avgCarbs: Math.round(totalCarbs / activeDays),
      totalCalories: Math.round(totalCalories),
      avgCalories: Math.round(totalCalories / activeDays),
      tir: {
        normalPercent: glucoseCount > 0 ? Math.round((normalCount / tirTotal) * 100) : 0,
        lowPercent: glucoseCount > 0 ? Math.round((lowCount / tirTotal) * 100) : 0,
        highPercent: glucoseCount > 0 ? Math.round((highCount / tirTotal) * 100) : 0,
        veryHighPercent: glucoseCount > 0 ? Math.round((veryHighCount / tirTotal) * 100) : 0,
      },
    };
  }, [filteredEntries, settings]);

  // Печать / Сохранение в PDF через нативный диалог печати браузера
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Панель управления отчетом (скрывается при печати) */}
      <div className="print:hidden bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Медицинский отчет самоконтроля для врача
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Готовая форма для отправки эндокринологу или сохранения в PDF (формат А4)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Сортировка отчета */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs border border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setSortOrder('newest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] flex items-center gap-1.5 ${
                sortOrder === 'newest'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Сначала новые дни (время снизу вверх)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Сначала новые</span>
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('oldest')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] flex items-center gap-1.5 ${
                sortOrder === 'oldest'
                  ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Сначала старые дни (время сверху вниз)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Сначала старые</span>
            </button>
          </div>

          {/* Период отчета */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs border border-slate-200 dark:border-slate-700/60">
            {[
              { id: '7d', label: '7 дней' },
              { id: '14d', label: '14 дней' },
              { id: '30d', label: '30 дней' },
              { id: 'all', label: 'Все' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setReportPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] ${
                  reportPeriod === p.id
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Главная кнопка Печать / Сохранить в PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-2 min-h-[38px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
          >
            <Printer className="w-4 h-4" />
            <span>Печать / Сохранить в PDF</span>
          </button>
        </div>
      </div>

      {/* Лист Отчета (Стилизован под официальный медицинский бланк А4) */}
      <div className="bg-white text-slate-900 p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">
        
        {/* Шапка медицинского отчета */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-teal-700 font-extrabold mb-1">
                Клинический отчет самоконтроля гликемии
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                ДНЕВНИК САМОКОНТРОЛЯ САХАРНОГО ДИАБЕТА
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Препараты инсулина: <strong>{bolusName}</strong> (болюс) + <strong>{basalName}</strong> (базал)
              </p>
            </div>

            {/* Карточка пациента */}
            <div className="sm:text-right text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-[220px]">
              <div>
                Пациент:{' '}
                <input
                  type="text"
                  value={settings.patientName}
                  onChange={(e) => onUpdateSettings({ ...settings, patientName: e.target.value })}
                  placeholder="ФИО пациента"
                  className="font-bold border-b border-dashed border-slate-400 bg-transparent outline-none text-right px-1"
                />
              </div>
              <div>Дата формирования: <strong>{new Date().toLocaleDateString('ru-RU')}</strong></div>
              <div>Период: <strong>{reportPeriod === '7d' ? '7 дней' : reportPeriod === '14d' ? '14 дней' : reportPeriod === '30d' ? '30 дней' : 'Весь период'}</strong></div>
              <div>Целевой сахар: <strong>{settings.targetLow} – {settings.targetHigh} ммоль/л</strong></div>
              <div>Сортировка: <strong>{sortOrder === 'newest' ? 'Сначала новые (снизу вверх)' : 'Сначала старые (сверху вниз)'}</strong></div>
              {settings.acr !== null && settings.acr !== undefined && (
                <div>ACR (моча): <strong>{settings.acr} мг/ммоль</strong></div>
              )}
            </div>
          </div>
        </div>

        {/* Сводные показатели за отчетный период (TIR, Средняя глюкоза, eHbA1c, ACR, Дозы) */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <div className="text-slate-500 text-[10px] font-bold">Средняя глюкоза</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
              {stats.avgGlucose !== null ? `${stats.avgGlucose} ммоль/л` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Замеров: {stats.glucoseCount} ({stats.activeDays} дн.)</div>
          </div>

          <div>
            <div className="text-slate-500 text-[10px] font-bold">Целевой диапазон (TIR)</div>
            <div className="text-xl font-black text-emerald-700 mt-0.5 font-mono">
              TIR: {stats.tir.normalPercent}%
            </div>
            <div className="text-[10px] text-slate-500">
              Гипо (&lt;{settings.hypoThreshold || 3.9}): {stats.tir.lowPercent}% | Гипер: {stats.tir.highPercent + stats.tir.veryHighPercent}%
            </div>
          </div>

          <div>
            <div className="text-slate-500 text-[10px] font-bold">eHbA1c</div>
            <div className="text-xl font-black text-blue-800 mt-0.5 font-mono">
              {settings.eHbA1c !== null && settings.eHbA1c !== undefined
                ? `${settings.eHbA1c}%`
                : (stats.estimatedHbA1c !== null ? `~${stats.estimatedHbA1c}%` : '—')}
            </div>
            <div className="text-[10px] text-slate-500">
              {settings.eHbA1c !== null && settings.eHbA1c !== undefined ? 'Лабораторный / целевой' : 'Ориентировочно (GMI)'}
            </div>
          </div>

          <div>
            <div className="text-slate-500 text-[10px] font-bold">ACR (моча)</div>
            <div className="text-xl font-black text-slate-900 mt-0.5 font-mono">
              {settings.acr !== null && settings.acr !== undefined ? `${settings.acr} мг/ммоль` : '—'}
            </div>
            <div className="text-[10px] text-slate-500">Альбумин/креатинин</div>
          </div>

          <div>
            <div className="text-slate-500 text-[10px] font-bold">Инсулин в среднем/день</div>
            <div className="text-base font-black text-slate-900 mt-1 font-mono">
              {bolusName}: {stats.avgRinFast > 0 ? `${stats.avgRinFast} ед` : '—'}
            </div>
            <div className="text-[11px] font-bold text-purple-800 font-mono">
              {basalName}: {stats.avgTresiba > 0 ? `${stats.avgTresiba} ед` : '—'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {stats.fullDaysCount > 0 ? `По полным дням: ${stats.fullDaysCount} дн.` : 'Болюс и базал'}
            </div>
          </div>
        </div>

        {/* Таблица дней и замеров */}
        {groupedDays.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm italic">
            Нет записей за выбранный период
          </div>
        ) : (
          <div className="space-y-6">
            {groupedDays.map(({ date, entries: dayEntries, summary }) => {
              return (
                <div
                  key={date}
                  className="border border-slate-300 rounded-xl overflow-hidden page-break-inside-avoid mb-4"
                >
                  {/* Заголовок суток */}
                  <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-900">{formatDateRussian(date)}</span>
                      <span className="text-slate-500 font-normal">({dayEntries.length} замера)</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span>
                        Ср. сахар: <strong>{summary.avgGlucose !== null ? `${summary.avgGlucose} ммоль/л` : '—'}</strong>
                      </span>
                      <span>{bolusName}: <strong>{summary.totalRinFast} ед</strong></span>
                      {summary.totalTresiba > 0 && <span>{basalName}: <strong>{summary.totalTresiba} ед</strong></span>}
                      {summary.totalCarbs > 0 && <span>Углеводы: <strong>{summary.totalCarbs} г ({summary.totalXE} ХЕ)</strong></span>}
                      {summary.totalCalories > 0 && <span>Ккал: <strong>{summary.totalCalories}</strong></span>}
                    </div>
                  </div>

                  {/* Таблица замеров за день */}
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[10px] uppercase font-bold">
                        <th className="py-1.5 px-3 w-16">Время</th>
                        <th className="py-1.5 px-3 w-24">Глюкоза</th>
                        <th className="py-1.5 px-3 w-28">Оценка</th>
                        <th className="py-1.5 px-2 w-20 text-center">Углеводы</th>
                        <th className="py-1.5 px-2 w-16 text-center">ХЕ (÷12)</th>
                        <th className="py-1.5 px-2 w-24 text-center">{bolusName}</th>
                        <th className="py-1.5 px-2 w-24 text-center">{basalName}</th>
                        <th className="py-1.5 px-2 w-20 text-center">Ккал</th>
                        <th className="py-1.5 px-3">Еда / нагрузка / комментарий</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dayEntries.map((e) => {
                        const ev = evaluateGlucose(e.glucose, settings);

                        return (
                          <tr key={e.id} className="text-slate-800">
                            <td className="py-1.5 px-3 font-mono font-bold tabular-nums">{e.time}</td>
                            <td className="py-1.5 px-3 font-mono font-extrabold tabular-nums">
                              {e.glucose !== null ? `${e.glucose.toFixed(1)} ммоль/л` : '—'}
                            </td>
                            <td className="py-1.5 px-3">
                              {ev ? (
                                <span
                                  className={`inline-block px-2 py-0.2 rounded text-[10px] font-bold ${
                                    ev.status === 'low'
                                      ? 'text-red-700 bg-red-100'
                                      : ev.status === 'normal'
                                      ? 'text-emerald-800 bg-emerald-100'
                                      : ev.status === 'high'
                                      ? 'text-amber-800 bg-amber-100'
                                      : 'text-rose-800 bg-rose-100'
                                  }`}
                                >
                                  {ev.shortLabel}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-1.5 px-2 text-center font-mono tabular-nums">{e.carbs ? `${e.carbs} г` : '—'}</td>
                            <td className="py-1.5 px-2 text-center font-bold text-teal-800 font-mono tabular-nums">
                              {e.xe ? `${e.xe} ХЕ` : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-blue-800 font-mono tabular-nums">
                              {e.rinFast ? `${e.rinFast} ед` : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-purple-800 font-mono tabular-nums">
                              {e.tresiba ? `${e.tresiba} ед` : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-700 font-mono tabular-nums">{e.calories ? e.calories : '—'}</td>
                            <td className="py-1.5 px-3 text-slate-700 italic">
                              {e.notes || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        {/* Нижний блок: Комментарии врача и подпись */}
        <div className="mt-8 pt-4 border-t-2 border-slate-300 text-xs text-slate-700 space-y-4 page-break-inside-avoid">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="font-bold uppercase text-[10px] text-slate-500 mb-1">
              Заключение / Коррекция доз лечащим врачом:
            </div>
            <div className="h-16 border-b border-dashed border-slate-300"></div>
          </div>

          <div className="flex justify-between items-center text-slate-500 pt-2 text-[11px]">
            <div>Врач-эндокринолог: _______________________ (подпись / печать)</div>
            <div>Дата проверки: «____» ____________ 202__ г.</div>
          </div>
          <div className="text-[9px] text-slate-400 text-center pt-2 border-t border-slate-200">
            Документ сформирован пациентом в системе электронного самоконтроля GlucoTrack в соответствии со ст. 10 152-ФЗ РФ и 323-ФЗ РФ. Не является окончательным клиническим диагнозом.
          </div>
        </div>

      </div>
    </div>
  );
};
