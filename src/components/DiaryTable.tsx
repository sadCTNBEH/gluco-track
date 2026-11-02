import React, { useState } from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Activity,
  Edit2,
  Trash2,
  Plus,
  Search,
  Filter,
  Calendar,
  Syringe,
  Utensils,
  Flame,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';

interface DiaryTableProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
  onDeleteDayClick?: (date: string, count: number) => void;
}

export const DiaryTable: React.FC<DiaryTableProps> = ({
  entries,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onDeleteDayClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | '7d' | '14d' | '30d' | 'today'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'normal' | 'high' | 'very_high'>('all');

  // Фильтрация записей
  const filteredEntries = entries.filter((entry) => {
    // Поиск по заметкам / еде
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNote = entry.notes?.toLowerCase().includes(q);
      const matchDate = entry.date.includes(q);
      if (!matchNote && !matchDate) return false;
    }

    // Фильтр по периоду
    if (periodFilter !== 'all') {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (periodFilter === 'today') {
        if (entry.date !== todayStr) return false;
      } else {
        const days = periodFilter === '7d' ? 7 : periodFilter === '14d' ? 14 : 30;
        const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
        const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
        if (entry.date < cutoffStr) return false;
      }
    }

    // Фильтр по оценке глюкозы
    if (statusFilter !== 'all') {
      const evalStatus = evaluateGlucose(entry.glucose);
      if (!evalStatus || evalStatus.status !== statusFilter) return false;
    }

    return true;
  });

  const groupedDays = groupEntriesByDay(filteredEntries);

  return (
    <div className="space-y-4">
      {/* Панель фильтров и поиска */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Поиск */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по еде, комментариям, дате..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              Очистить
            </button>
          )}
        </div>

        {/* Фильтры по времени */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'Все дни' },
            { id: 'today', label: 'Сегодня' },
            { id: '7d', label: '7 дней' },
            { id: '14d', label: '14 дней' },
            { id: '30d', label: '30 дней' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriodFilter(item.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${
                periodFilter === item.id
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Фильтр по сахару */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">Любой сахар</option>
            <option value="low">🔴 Только Низкий (&lt;3.9)</option>
            <option value="normal">🟢 Только Норма (4.0-9.9)</option>
            <option value="high">🟡 Только Высокий (10-13.9)</option>
            <option value="very_high">🟣 Очень высокий (&gt;13.9)</option>
          </select>

          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-semibold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Добавить замер
          </button>
        </div>
      </div>

      {/* Список дней / Таблица */}
      {groupedDays.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
            <Activity className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
            Записи не найдены
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            По заданным фильтрам нет измерений. Измените параметры фильтра или внесите новый замер.
          </p>
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-500 transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Внести первое измерение
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedDays.map(({ date, entries: dayEntries, summary }) => {
            const dayGlucoseEval = summary.avgGlucose ? evaluateGlucose(summary.avgGlucose) : null;

            return (
              <div
                key={date}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
              >
                {/* Шапка Дня с датой и агрегатами */}
                <div className="bg-slate-50/80 dark:bg-slate-800/60 px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-teal-600/10 text-teal-700 dark:text-teal-400 flex items-center justify-center font-bold text-xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                        {formatDateRussian(date)}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {summary.entriesCount} {summary.entriesCount === 1 ? 'замер' : summary.entriesCount < 5 ? 'замера' : 'замеров'} за сутки
                      </p>
                    </div>
                  </div>

                  {/* Сводные показатели дня (прямо в шапке дня) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Средний сахар за день (авто) */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">Средний сахар:</span>
                      {summary.avgGlucose !== null ? (
                        <span className={`font-bold flex items-center gap-1 ${dayGlucoseEval?.textClass}`}>
                          {summary.avgGlucose} ммоль/л
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${dayGlucoseEval?.badgeClass}`}>
                            {dayGlucoseEval?.shortLabel}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    {/* РинФаст за день */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 font-semibold">
                      <Syringe className="w-3.5 h-3.5" />
                      <span>РинФаст: <strong>{summary.totalRinFast} ед</strong></span>
                    </div>

                    {/* Тресиба за день */}
                    {summary.totalTresiba > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 font-semibold">
                        <Syringe className="w-3.5 h-3.5" />
                        <span>Тресиба: <strong>{summary.totalTresiba} ед</strong></span>
                      </div>
                    )}

                    {/* Калории за день */}
                    {summary.totalCalories > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-semibold">
                        <Flame className="w-3.5 h-3.5" />
                        <span>Калории: <strong>{summary.totalCalories} ккал</strong></span>
                      </div>
                    )}

                    {/* ХЕ за день */}
                    {summary.totalXE > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-900 text-teal-700 dark:text-teal-300 font-semibold">
                        <Utensils className="w-3.5 h-3.5" />
                        <span>{summary.totalXE} ХЕ ({summary.totalCarbs} г)</span>
                      </div>
                    )}

                    {/* Кнопка удаления целого дня */}
                    {onDeleteDayClick && (
                      <button
                        onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer ml-auto"
                        title={`Удалить все записи за ${formatDateRussian(date)}`}
                        aria-label="Удалить весь день"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold text-rose-600/80 hover:text-rose-600">
                          Удалить день
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Основная таблица записей дня */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-4 w-20">Время</th>
                        <th className="py-2.5 px-4 w-32">Глюкоза (ммоль/л)</th>
                        <th className="py-2.5 px-4 w-36">Оценка (авто)</th>
                        <th className="py-2.5 px-3 w-24 text-center">Углеводы</th>
                        <th className="py-2.5 px-3 w-24 text-center">ХЕ (авто ÷12)</th>
                        <th className="py-2.5 px-3 w-28 text-center text-blue-600 dark:text-blue-400">РинФаст (ед)</th>
                        <th className="py-2.5 px-3 w-28 text-center text-purple-600 dark:text-purple-400">Тресиба (ед)</th>
                        <th className="py-2.5 px-3 w-24 text-center text-rose-600 dark:text-rose-400">Калории</th>
                        <th className="py-2.5 px-4">Еда / нагрузка / комментарий</th>
                        <th className="py-2.5 px-3 w-16 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dayEntries.map((entry) => {
                        const evalResult = evaluateGlucose(entry.glucose);

                        return (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                          >
                            {/* Время */}
                            <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                              <span className="flex items-center gap-1.5">
                                {entry.time}
                                {entry.tag && entry.tag !== 'other' && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-sans font-normal bg-slate-100 dark:bg-slate-800 text-slate-500">
                                    {entry.tag === 'breakfast'
                                      ? 'Завтрак'
                                      : entry.tag === 'lunch'
                                      ? 'Обед'
                                      : entry.tag === 'dinner'
                                      ? 'Ужин'
                                      : entry.tag === 'fasting'
                                      ? 'Натощак'
                                      : entry.tag === 'snack'
                                      ? 'Перекус'
                                      : entry.tag === 'bedtime'
                                      ? 'На ночь'
                                      : entry.tag === 'correction'
                                      ? 'ДПС'
                                      : ''}
                                  </span>
                                )}
                              </span>
                            </td>

                            {/* Глюкоза */}
                            <td className="py-3 px-4 font-mono text-sm">
                              {entry.glucose !== null ? (
                                <span className={`font-bold ${evalResult ? evalResult.textClass : 'text-slate-700'}`}>
                                  {entry.glucose.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Оценка (автоматическая по шкале) */}
                            <td className="py-3 px-4">
                              {evalResult ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${evalResult.badgeClass}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {evalResult.shortLabel}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Углеводы */}
                            <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                              {entry.carbs !== null && entry.carbs > 0 ? (
                                <span>{entry.carbs} г</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* ХЕ (авто: углеводы / 12) */}
                            <td className="py-3 px-3 text-center font-bold text-teal-700 dark:text-teal-400">
                              {entry.xe !== null && entry.xe > 0 ? (
                                <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200/50 dark:border-teal-900/50">
                                  {entry.xe} ХЕ
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* РинФаст (инсулин) */}
                            <td className="py-3 px-3 text-center">
                              {entry.rinFast !== null && entry.rinFast > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                                  💉 {entry.rinFast} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Тресиба (инсулин) */}
                            <td className="py-3 px-3 text-center">
                              {entry.tresiba !== null && entry.tresiba > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                                  🌙 {entry.tresiba} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Калории */}
                            <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                              {entry.calories !== null && entry.calories > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  {entry.calories}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Еда / нагрузка / комментарий */}
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs break-words">
                              {entry.notes || <span className="text-slate-300 dark:text-slate-600 italic">нет заметок</span>}
                            </td>

                            {/* Действия */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onEditClick(entry)}
                                  className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                  title="Редактировать запись"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Удалить эту запись из дневника?')) {
                                      onDeleteClick(entry.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                  title="Удалить запись"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Итоги за день (футер таблицы) */}
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                        <td className="py-2.5 px-4 uppercase text-[11px] text-slate-500">Итого за день:</td>
                        <td className="py-2.5 px-4 font-mono">
                          {summary.avgGlucose !== null ? `${summary.avgGlucose} ср.` : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          {dayGlucoseEval && (
                            <span className="text-[11px] text-slate-600 dark:text-slate-300">
                              диапазон: {summary.minGlucose} – {summary.maxGlucose}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">{summary.totalCarbs > 0 ? `${summary.totalCarbs} г` : '—'}</td>
                        <td className="py-2.5 px-3 text-center text-teal-700 dark:text-teal-400">
                          {summary.totalXE > 0 ? `${summary.totalXE} ХЕ` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-700 dark:text-blue-300">
                          {summary.totalRinFast > 0 ? `${summary.totalRinFast} ед` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-purple-700 dark:text-purple-300">
                          {summary.totalTresiba > 0 ? `${summary.totalTresiba} ед` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400">
                          {summary.totalCalories > 0 ? `${summary.totalCalories} ккал` : '—'}
                        </td>
                        <td colSpan={2} className="py-2.5 px-4 text-slate-400 text-[11px] font-normal italic">
                          Всего инъекций РинФаст + Тресиба: {(summary.totalRinFast + summary.totalTresiba).toFixed(1)} ед
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
