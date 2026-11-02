import React, { useState } from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, groupEntriesByDay, formatDateRussian } from '../utils/diabetes';
import {
  Search,
  Plus,
  Calendar,
  Syringe,
  Moon,
  Utensils,
  Flame,
  Clock,
  X,
  Edit2,
  Trash2,
  ChevronDown,
  Activity,
} from 'lucide-react';

interface DiaryTableProps {
  entries: DiaryEntry[];
  onAddClick: () => void;
  onEditClick: (entry: DiaryEntry) => void;
  onDeleteClick: (id: string) => void;
  onDeleteDayClick?: (date: string, count: number) => void;
  bolusName?: string;
  basalName?: string;
}

const TAG_CONFIG: Record<string, { label: string; className: string }> = {
  fasting: { label: 'Натощак', className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
  breakfast: { label: 'Завтрак', className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
  lunch: { label: 'Обед', className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' },
  dinner: { label: 'Ужин', className: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
  snack: { label: 'Перекус', className: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800' },
  bedtime: { label: 'На ночь', className: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800' },
  correction: { label: 'Коррекция (ДПС)', className: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' },
  other: { label: 'Другое', className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400' },
};

export const DiaryTable: React.FC<DiaryTableProps> = ({
  entries,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onDeleteDayClick,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7d' | '14d' | '30d'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'normal' | 'high' | 'very_high'>('all');

  // Фильтрация записей
  const filteredEntries = entries.filter((entry) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchNote = entry.notes?.toLowerCase().includes(q);
      const matchDate = entry.date.includes(q);
      const matchTime = entry.time.includes(q);
      if (!matchNote && !matchDate && !matchTime) return false;
    }

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
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Поле поиска */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по заметкам, дате, времени..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-9 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
              aria-label="Очистить поиск"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Быстрые фильтры по времени */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                periodFilter === item.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
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
              className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer h-10 min-h-[40px]"
            >
              <option value="all">Диапазон: Все</option>
              <option value="low">Низкий (&lt;3.9)</option>
              <option value="normal">Норма (4.0–9.9)</option>
              <option value="high">Высокий (10.0–13.9)</option>
              <option value="very_high">Очень высокий (&gt;13.9)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3.5 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={onAddClick}
            className="h-10 min-h-[40px] px-3.5 sm:px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить запись</span>
          </button>
        </div>

      </div>

      {/* Список дней / Таблица */}
      {groupedDays.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center shadow-xs">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
            Записи не найдены
          </h4>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            По заданным фильтрам нет измерений. Измените параметры фильтра или добавьте новый замер.
          </p>
          <button
            onClick={onAddClick}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-semibold rounded-lg transition inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Добавить измерение
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedDays.map(({ date, entries: dayEntries, summary }) => {
            const dayGlucoseEval = summary.avgGlucose ? evaluateGlucose(summary.avgGlucose) : null;

            return (
              <div
                key={date}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
              >
                {/* Шапка Дня с датой и агрегатами */}
                <div className="bg-slate-50 dark:bg-slate-850 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  
                  {/* Дата и количество замеров */}
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
                        {formatDateRussian(date)}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {summary.entriesCount} {summary.entriesCount === 1 ? 'замер' : summary.entriesCount < 5 ? 'замера' : 'замеров'}
                      </p>
                    </div>
                  </div>

                  {/* Сводка за день */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    
                    {/* Средний сахар дня */}
                    {summary.avgGlucose !== null ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400">Ср. сахар:</span>
                        <span className={`font-mono font-bold ${dayGlucoseEval?.textClass}`}>
                          {summary.avgGlucose} ммоль/л
                        </span>
                        {dayGlucoseEval && (
                          <span className={`text-xs px-1.5 py-0.2 rounded border font-medium ${dayGlucoseEval.badgeClass}`}>
                            {dayGlucoseEval.shortLabel}
                          </span>
                        )}
                      </div>
                    ) : null}

                    {/* Болюс за день */}
                    {summary.totalRinFast > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-semibold">
                        <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>{bolusName}: <strong className="font-mono">{summary.totalRinFast} ед</strong></span>
                      </div>
                    )}

                    {/* Базал за день */}
                    {summary.totalTresiba > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300 font-semibold">
                        <Moon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>{basalName}: <strong className="font-mono">{summary.totalTresiba} ед</strong></span>
                      </div>
                    )}

                    {/* ХЕ за день */}
                    {summary.totalXE > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 font-semibold">
                        <Utensils className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span><strong className="font-mono">{summary.totalXE} ХЕ</strong> ({summary.totalCarbs} г)</span>
                      </div>
                    )}

                    {/* Калории за день */}
                    {summary.totalCalories > 0 && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 font-semibold">
                        <Flame className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        <span><strong className="font-mono">{summary.totalCalories}</strong> ккал</span>
                      </div>
                    )}

                    {/* Кнопка удаления целого дня */}
                    {onDeleteDayClick && (
                      <button
                        onClick={() => onDeleteDayClick(date, summary.entriesCount)}
                        className="flex items-center gap-1 px-2.5 py-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px] min-w-[36px]"
                        title={`Удалить все записи за ${formatDateRussian(date)}`}
                        aria-label="Удалить день"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Удалить день</span>
                      </button>
                    )}

                  </div>
                </div>

                {/* Основная таблица записей дня */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold text-xs border-b border-slate-200 dark:border-slate-800">
                        <th className="py-2.5 px-4 w-28">Время</th>
                        <th className="py-2.5 px-4 w-32 text-right">Глюкоза</th>
                        <th className="py-2.5 px-4 w-36">Статус</th>
                        <th className="py-2.5 px-3 w-24 text-center">Углеводы</th>
                        <th className="py-2.5 px-3 w-28 text-center">ХЕ (÷12)</th>
                        <th className="py-2.5 px-3 w-28 text-center text-blue-700 dark:text-blue-300">{bolusName}</th>
                        <th className="py-2.5 px-3 w-28 text-center text-purple-700 dark:text-purple-300">{basalName}</th>
                        <th className="py-2.5 px-3 w-24 text-center text-rose-700 dark:text-rose-300">Ккал</th>
                        <th className="py-2.5 px-4">Еда / примечания</th>
                        <th className="py-2.5 px-3 w-20 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {dayEntries.map((entry) => {
                        const evalResult = evaluateGlucose(entry.glucose);
                        const tagInfo = entry.tag && entry.tag !== 'other' ? TAG_CONFIG[entry.tag] : null;

                        return (
                          <tr
                            key={entry.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                          >
                            {/* Время и контекстный тег */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                                <span>{entry.time}</span>
                                {tagInfo && (
                                  <span className={`text-xs px-2 py-0.5 rounded-md font-sans font-medium ${tagInfo.className}`}>
                                    {tagInfo.label}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Глюкоза */}
                            <td className="py-3 px-4 text-right">
                              {entry.glucose !== null ? (
                                <span className={`font-mono text-sm font-bold ${evalResult ? evalResult.textClass : 'text-slate-700 dark:text-slate-300'}`}>
                                  {entry.glucose.toFixed(1)}{' '}
                                  <span className="text-xs font-normal text-slate-400 font-sans">ммоль</span>
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Статус (Клинический бейдж с понятным текстом) */}
                            <td className="py-3 px-4">
                              {evalResult ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold border ${evalResult.badgeClass}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                  <span>{evalResult.shortLabel}</span>
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
                                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                                  {entry.xe} ХЕ
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* РинФаст (болюс) */}
                            <td className="py-3 px-3 text-center">
                              {entry.rinFast !== null && entry.rinFast > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono font-bold text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                                  <Syringe className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                  {entry.rinFast} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Тресиба (базал) */}
                            <td className="py-3 px-3 text-center">
                              {entry.tresiba !== null && entry.tresiba > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono font-bold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                                  <Moon className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                  {entry.tresiba} ед
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-slate-600 font-mono">—</span>
                              )}
                            </td>

                            {/* Калории */}
                            <td className="py-3 px-3 text-center font-mono">
                              {entry.calories !== null && entry.calories > 0 ? (
                                <span className="text-rose-700 dark:text-rose-300 font-semibold">
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
                                <span className="text-slate-400 dark:text-slate-500 italic">без заметок</span>
                              )}
                            </td>

                            {/* Действия */}
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => onEditClick(entry)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                                  title="Редактировать запись"
                                  aria-label="Редактировать запись"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm('Удалить эту запись из дневника?')) {
                                      onDeleteClick(entry.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                                  title="Удалить запись"
                                  aria-label="Удалить запись"
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
                      <tr className="bg-slate-50 dark:bg-slate-850 font-bold border-t border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200">
                        <td className="py-2.5 px-4 uppercase text-xs text-slate-500 tracking-wider">Итого:</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-right">
                          {summary.avgGlucose !== null ? `${summary.avgGlucose} ср.` : '—'}
                        </td>
                        <td className="py-2.5 px-4">
                          {dayGlucoseEval && (
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              разброс: {summary.minGlucose} – {summary.maxGlucose}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {summary.totalCarbs > 0 ? `${summary.totalCarbs} г` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-teal-800 dark:text-teal-300 font-mono">
                          {summary.totalXE > 0 ? `${summary.totalXE} ХЕ` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-blue-800 dark:text-blue-300 font-mono">
                          {summary.totalRinFast > 0 ? `${summary.totalRinFast} ед` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-purple-800 dark:text-purple-300 font-mono">
                          {summary.totalTresiba > 0 ? `${summary.totalTresiba} ед` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-rose-800 dark:text-rose-300 font-mono">
                          {summary.totalCalories > 0 ? `${summary.totalCalories}` : '—'}
                        </td>
                        <td colSpan={2} className="py-2.5 px-4 text-slate-500 dark:text-slate-400 text-xs font-normal">
                          Всего инъекций: {(summary.totalRinFast + summary.totalTresiba).toFixed(1)} ед
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
