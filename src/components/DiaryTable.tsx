import React, { useState } from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Activity,
  Edit2,
  Trash2,
  Plus,
  Search,
  Calendar,
  Syringe,
  Utensils,
  Flame,
  Clock,
  Sparkles,
  ChevronDown,
  X,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface DiaryTableProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
  onDeleteDayClick?: (date: string, count: number) => void;
}

const TAG_LABELS: Record<string, { label: string; class: string }> = {
  breakfast: { label: 'Завтрак', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  lunch: { label: 'Обед', class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  dinner: { label: 'Ужин', class: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20' },
  snack: { label: 'Перекус', class: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' },
  fasting: { label: 'Натощак', class: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20' },
  bedtime: { label: 'На ночь', class: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' },
  correction: { label: 'ДПС', class: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
};

export const DiaryTable: React.FC<DiaryTableProps> = ({
  entries,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onDeleteDayClick,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '14d' | '30d'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'normal' | 'high' | 'very_high'>('all');

  // Фильтрация записей
  const filteredEntries = entries.filter((entry) => {
    // Поиск по заметкам / еде
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNote = entry.notes?.toLowerCase().includes(q);
      const matchDate = entry.date.includes(q);
      const matchTime = entry.time.includes(q);
      if (!matchNote && !matchDate && !matchTime) return false;
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
    <div className="space-y-5">
      {/* Панель фильтров и поиска */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-colors">
        
        {/* Поле поиска */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по еде, времени, заметкам..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
              aria-label="Очистить поиск"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Быстрые фильтры по времени */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
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
              className={`px-3 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                periodFilter === item.id
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-slate-700/80'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Селектор статуса сахара + кнопка добавления */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer"
            >
              <option value="all">Диапазон: Все</option>
              <option value="low">🔴 Низкий (&lt;3.9)</option>
              <option value="normal">🟢 Норма (4.0 - 9.9)</option>
              <option value="high">🟡 Высокий (10 - 13.9)</option>
              <option value="very_high">🟣 Критический (&gt;13.9)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-97 text-white font-bold text-xs rounded-2xl shadow-sm shadow-teal-600/30 flex items-center gap-1.5 transition whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Внести замер</span>
          </button>
        </div>

      </div>

      {/* Список дней / Таблица */}
      {groupedDays.length === 0 ? (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 p-12 text-center shadow-xs">
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
            <Activity className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
            Записи не найдены
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5 leading-relaxed">
            По заданным фильтрам нет измерений. Измените параметры фильтра или внесите новый замер глюкозы.
          </p>
          <button
            onClick={onAddClick}
            className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-bold rounded-2xl hover:opacity-95 shadow-md shadow-teal-600/25 transition inline-flex items-center gap-2 cursor-pointer"
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
                className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                {/* Шапка Дня с датой и агрегатами */}
                <div className="bg-slate-50/90 dark:bg-slate-800/60 px-4 sm:px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Левая сторона: дата и количество замеров */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 flex items-center justify-center font-bold text-xs">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white capitalize tracking-tight">
                        {formatDateRussian(date)}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {summary.entriesCount} {summary.entriesCount === 1 ? 'замер' : summary.entriesCount < 5 ? 'замера' : 'замеров'} за день
                      </p>
                    </div>
                  </div>

                  {/* Правая сторона: Сводные плашки дня */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    
                    {/* Средний сахар дня */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/70 shadow-2xs">
                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">Ср. сахар:</span>
                      {summary.avgGlucose !== null ? (
                        <span className={`font-mono font-bold flex items-center gap-1.5 ${dayGlucoseEval?.textClass}`}>
                          {summary.avgGlucose} ммоль/л
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-md border ${dayGlucoseEval?.badgeClass}`}>
                            {dayGlucoseEval?.shortLabel}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>

                    {/* РинФаст за день */}
                    {summary.totalRinFast > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/25 text-blue-700 dark:text-blue-300 font-semibold shadow-2xs">
                        <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>РинФаст: <strong className="font-mono">{summary.totalRinFast} ед</strong></span>
                      </div>
                    )}

                    {/* Тресиба за день */}
                    {summary.totalTresiba > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 dark:bg-purple-950/40 border border-purple-500/25 text-purple-700 dark:text-purple-300 font-semibold shadow-2xs">
                        <Syringe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Тресиба: <strong className="font-mono">{summary.totalTresiba} ед</strong></span>
                      </div>
                    )}

                    {/* ХЕ за день */}
                    {summary.totalXE > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-teal-500/10 dark:bg-teal-950/40 border border-teal-500/25 text-teal-800 dark:text-teal-300 font-semibold shadow-2xs">
                        <Utensils className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span><strong className="font-mono">{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)</span>
                      </div>
                    )}

                    {/* Калории за день */}
                    {summary.totalCalories > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/10 dark:bg-rose-950/40 border border-rose-500/25 text-rose-700 dark:text-rose-300 font-semibold shadow-2xs">
                        <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span><strong className="font-mono">{summary.totalCalories}</strong> ккал</span>
                      </div>
                    )}

                    {/* Кнопка удаления целого дня */}
                    {onDeleteDayClick && (
                      <button
                        onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer ml-auto border border-transparent hover:border-rose-500/20"
                        title={`Удалить все записи за ${formatDateRussian(date)}`}
                        aria-label="Удалить весь день"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-semibold text-rose-600/90 hover:text-rose-600">
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
                      <tr className="bg-slate-100/70 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-200/80 dark:border-slate-800/80">
                        <th className="py-2.5 px-4 w-28">Время</th>
                        <th className="py-2.5 px-4 w-32">Глюкоза (ммоль)</th>
                        <th className="py-2.5 px-4 w-36">Статус</th>
                        <th className="py-2.5 px-3 w-24 text-center">Углеводы</th>
                        <th className="py-2.5 px-3 w-28 text-center">ХЕ (÷12)</th>
                        <th className="py-2.5 px-3 w-28 text-center text-blue-600 dark:text-blue-400">РинФаст</th>
                        <th className="py-2.5 px-3 w-28 text-center text-purple-600 dark:text-purple-400">Тресиба</th>
                        <th className="py-2.5 px-3 w-24 text-center text-rose-600 dark:text-rose-400">Ккал</th>
                        <th className="py-2.5 px-4">Еда / активность / примечания</th>
                        <th className="py-2.5 px-3 w-20 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {dayEntries.map((entry) => {
                        const evalResult = evaluateGlucose(entry.glucose);
                        const tagInfo = entry.tag && entry.tag !== 'other' ? TAG_LABELS[entry.tag] : null;

                        return (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group"
                          >
                            {/* Время и контекстный тег */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                <span>{entry.time}</span>
                                {tagInfo && (
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-sans font-medium border ${tagInfo.class}`}>
                                    {tagInfo.label}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Глюкоза */}
                            <td className="py-3 px-4 font-mono text-sm">
                              {entry.glucose !== null ? (
                                <span className={`font-extrabold ${evalResult ? evalResult.textClass : 'text-slate-700'}`}>
                                  {entry.glucose.toFixed(1)}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Оценка (автоматический клинический индикатор) */}
                            <td className="py-3 px-4">
                              {evalResult ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${evalResult.badgeClass}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                  {evalResult.shortLabel}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Углеводы */}
                            <td className="py-3 px-3 text-center font-mono text-slate-700 dark:text-slate-300">
                              {entry.carbs !== null && entry.carbs > 0 ? (
                                <span>{entry.carbs} г</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* ХЕ (авто: углеводы / 12) */}
                            <td className="py-3 px-3 text-center">
                              {entry.xe !== null && entry.xe > 0 ? (
                                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                                  {entry.xe} ХЕ
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* РинФаст (болюс) */}
                            <td className="py-3 px-3 text-center">
                              {entry.rinFast !== null && entry.rinFast > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/20">
                                  💉 {entry.rinFast} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Тресиба (базал) */}
                            <td className="py-3 px-3 text-center">
                              {entry.tresiba !== null && entry.tresiba > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-mono font-bold text-purple-700 dark:text-purple-300 bg-purple-500/10 dark:bg-purple-950/40 border border-purple-500/20">
                                  🌙 {entry.tresiba} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Калории */}
                            <td className="py-3 px-3 text-center font-mono">
                              {entry.calories !== null && entry.calories > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                  {entry.calories}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>

                            {/* Еда / комментарии */}
                            <td className="py-3 px-4 text-slate-700 dark:text-slate-300 max-w-xs break-words leading-relaxed">
                              {entry.notes ? (
                                <span>{entry.notes}</span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 italic">без заметок</span>
                              )}
                            </td>

                            {/* Действия */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1 opacity-75 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onEditClick(entry)}
                                  className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                  title="Редактировать запись"
                                  aria-label="Редактировать"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Удалить эту запись из дневника?')) {
                                      onDeleteClick(entry.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                  title="Удалить запись"
                                  aria-label="Удалить"
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
                      <tr className="bg-slate-50/90 dark:bg-slate-800/80 font-bold border-t border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200">
                        <td className="py-2.5 px-4 uppercase text-[10px] text-slate-500 tracking-wider">Итого:</td>
                        <td className="py-2.5 px-4 font-mono font-extrabold">
                          {summary.avgGlucose !== null ? `${summary.avgGlucose} ср.` : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          {dayGlucoseEval && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              разброс: {summary.minGlucose} – {summary.maxGlucose}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {summary.totalCarbs > 0 ? `${summary.totalCarbs} г` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-teal-700 dark:text-teal-300 font-mono">
                          {summary.totalXE > 0 ? `${summary.totalXE} ХЕ` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-700 dark:text-blue-300 font-mono">
                          {summary.totalRinFast > 0 ? `${summary.totalRinFast} ед` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-purple-700 dark:text-purple-300 font-mono">
                          {summary.totalTresiba > 0 ? `${summary.totalTresiba} ед` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-600 dark:text-rose-400 font-mono">
                          {summary.totalCalories > 0 ? `${summary.totalCalories}` : '—'}
                        </td>
                        <td colSpan={2} className="py-2.5 px-4 text-slate-400 text-[11px] font-normal italic">
                          Всего инсулина: {(summary.totalRinFast + summary.totalTresiba).toFixed(1)} ед
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
