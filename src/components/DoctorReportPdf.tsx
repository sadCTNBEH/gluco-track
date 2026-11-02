import React, { useState, useMemo } from 'react';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import {
  evaluateGlucose,
  groupEntriesByDay,
  calculateMonthlyStats,
  formatDateRussian,
  exportEntriesToCSV,
} from '../utils/diabetes';
import {
  Printer,
  FileDown,
  Calendar,
  User,
  Activity,
  Syringe,
  CheckCircle,
  FileText,
  AlertTriangle,
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
  const [reportPeriod, setReportPeriod] = useState<'7d' | '14d' | '30d' | 'all'>('14d');
  const [includeNotes, setIncludeNotes] = useState(true);

  // Фильтруем записи по выбранному периоду
  const filteredEntries = useMemo(() => {
    if (reportPeriod === 'all') return entries;

    const daysCount = reportPeriod === '7d' ? 7 : reportPeriod === '14d' ? 14 : 30;
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysCount);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;

    return entries.filter((e) => e.date >= cutoffStr);
  }, [entries, reportPeriod]);

  const groupedDays = useMemo(() => {
    return groupEntriesByDay(filteredEntries);
  }, [filteredEntries]);

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

    for (const e of filteredEntries) {
      daysSet.add(e.date);
      if (e.glucose !== null && e.glucose > 0) {
        glucoseSum += e.glucose;
        glucoseCount++;
        const ev = evaluateGlucose(e.glucose);
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

    const tirTotal = glucoseCount || 1;
    return {
      activeDays,
      entriesCount: filteredEntries.length,
      glucoseCount,
      avgGlucose: avgG,
      estimatedHbA1c: hba1c,
      totalRinFast: Number(totalRinFast.toFixed(1)),
      avgRinFast: Number((totalRinFast / activeDays).toFixed(1)),
      totalTresiba: Number(totalTresiba.toFixed(1)),
      avgTresiba: Number((totalTresiba / activeDays).toFixed(1)),
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
  }, [filteredEntries]);

  // Печать / Сохранение в PDF через нативный диалог печати браузера
  const handlePrint = () => {
    window.print();
  };

  // Экспорт в CSV / Excel
  const handleExportCSV = () => {
    const csvContent = exportEntriesToCSV(filteredEntries);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Дневник_диабета_${settings.patientName || 'пациент'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Панель управления отчетом (скрывается при печати) */}
      <div className="print:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            Медицинский отчет самоконтроля для врача
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Готовая форма для отправки эндокринологу или сохранения в PDF (формат А4)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Период отчета */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs border border-slate-200/60 dark:border-slate-700/60">
            {[
              { id: '7d', label: '7 дней' },
              { id: '14d', label: '14 дней' },
              { id: '30d', label: '30 дней' },
              { id: 'all', label: 'Все' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setReportPeriod(p.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                  reportPeriod === p.id
                    ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Кнопка Экспорт в CSV */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-750 transition flex items-center gap-1.5 cursor-pointer"
            title="Выгрузить в таблицу Excel/CSV"
          >
            <FileDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Excel / CSV</span>
          </button>

          {/* Главная кнопка Печать / Сохранить в PDF */}
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-97 text-white text-xs font-bold shadow-md shadow-teal-500/25 transition flex items-center gap-2 cursor-pointer"
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
                Препараты инсулина: <strong>РинФаст</strong> (ультракороткий болюс) + <strong>Тресиба</strong> (базальный сверхдлительный)
              </p>
            </div>

            {/* Карточка пациента */}
            <div className="sm:text-right text-xs space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-[200px]">
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
            </div>
          </div>
        </div>

        {/* Сводные показатели за отчетный период (TIR, Средний сахар, Дозы) */}
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Средняя гликемия</div>
            <div className="text-xl font-black text-slate-900 mt-0.5">
              {stats.avgGlucose !== null ? `${stats.avgGlucose} ммоль/л` : '—'}
            </div>
            <div className="text-[10px] text-slate-500">Замеров: {stats.glucoseCount} ({stats.activeDays} дн.)</div>
          </div>

          <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">В норме (TIR)</div>
            <div className="text-xl font-black text-emerald-700 mt-0.5">
              {stats.tir.normalPercent}%
            </div>
            <div className="text-[10px] text-slate-500">
              Гипо (&lt;3.9): {stats.tir.lowPercent}% | Гипер: {stats.tir.highPercent + stats.tir.veryHighPercent}%
            </div>
          </div>

          <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Расчетный HbA1c</div>
            <div className="text-xl font-black text-blue-800 mt-0.5">
              {stats.estimatedHbA1c !== null ? `${stats.estimatedHbA1c}%` : '—'}
            </div>
            <div className="text-[10px] text-slate-500">GMI по замерам</div>
          </div>

          <div>
            <div className="text-slate-500 uppercase text-[10px] font-bold">Инсулин в среднем/день</div>
            <div className="text-base font-black text-slate-900 mt-1">
              РинФаст: {stats.avgRinFast} ед
            </div>
            <div className="text-[11px] font-bold text-purple-800">
              Тресиба: {stats.avgTresiba} ед
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
              const dayGlucoseEval = summary.avgGlucose ? evaluateGlucose(summary.avgGlucose) : null;

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
                    <div className="flex items-center gap-3 text-[11px]">
                      <span>
                        Ср. сахар: <strong>{summary.avgGlucose !== null ? `${summary.avgGlucose} ммоль/л` : '—'}</strong>
                      </span>
                      <span>РинФаст: <strong>{summary.totalRinFast} ед</strong></span>
                      {summary.totalTresiba > 0 && <span>Тресиба: <strong>{summary.totalTresiba} ед</strong></span>}
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
                        <th className="py-1.5 px-2 w-24 text-center">РинФаст</th>
                        <th className="py-1.5 px-2 w-24 text-center">Тресиба</th>
                        <th className="py-1.5 px-2 w-20 text-center">Ккал</th>
                        <th className="py-1.5 px-3">Еда / нагрузка / комментарий</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {dayEntries.map((e) => {
                        const ev = evaluateGlucose(e.glucose);

                        return (
                          <tr key={e.id} className="text-slate-800">
                            <td className="py-1.5 px-3 font-mono font-bold">{e.time}</td>
                            <td className="py-1.5 px-3 font-mono font-extrabold">
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
                            <td className="py-1.5 px-2 text-center">{e.carbs ? `${e.carbs} г` : '—'}</td>
                            <td className="py-1.5 px-2 text-center font-bold text-teal-800">
                              {e.xe ? `${e.xe} ХЕ` : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-blue-800">
                              {e.rinFast ? `${e.rinFast} ед` : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-purple-800">
                              {e.tresiba ? `${e.tresiba} ед` : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-700">{e.calories ? e.calories : '—'}</td>
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
            Документ сформирован пациентом в системе электронного самоконтроля (gluco.zduben.ru) в соответствии со ст. 10 152-ФЗ РФ и 323-ФЗ РФ. Не является окончательным клиническим диагнозом.
          </div>
        </div>

      </div>
    </div>
  );
};
