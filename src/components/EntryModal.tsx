import React, { useState, useEffect, useRef } from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, calculateXE } from '../utils/diabetes';
import { X, Check, Activity, Utensils, Syringe, Moon, Flame, Clock, Calendar, AlertCircle } from 'lucide-react';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }) => void;
  initialEntry?: DiaryEntry | null;
  xeRatio?: number;
  bolusName?: string;
  basalName?: string;
}

const CONTEXT_TAGS = [
  { id: 'fasting', label: 'Натощак' },
  { id: 'breakfast', label: 'Завтрак' },
  { id: 'lunch', label: 'Обед' },
  { id: 'dinner', label: 'Ужин' },
  { id: 'snack', label: 'Перекус' },
  { id: 'bedtime', label: 'На ночь' },
  { id: 'correction', label: 'Коррекция (ДПС)' },
  { id: 'other', label: 'Другое' },
] as const;

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  xeRatio = 12,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
}) => {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [glucoseStr, setGlucoseStr] = useState('');
  const [carbsStr, setCarbsStr] = useState('');
  const [xeStr, setXeStr] = useState('');
  const [rinFastStr, setRinFastStr] = useState('');
  const [tresibaStr, setTresibaStr] = useState('');
  const [caloriesStr, setCaloriesStr] = useState('');
  const [notes, setNotes] = useState('');
  const [tag, setTag] = useState<DiaryEntry['tag']>('other');
  const [manualXe, setManualXe] = useState(false);

  const glucoseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialEntry) {
      setDate(initialEntry.date);
      setTime(initialEntry.time);
      setGlucoseStr(initialEntry.glucose !== null ? String(initialEntry.glucose) : '');
      setCarbsStr(initialEntry.carbs !== null ? String(initialEntry.carbs) : '');
      setXeStr(initialEntry.xe !== null ? String(initialEntry.xe) : '');
      setRinFastStr(initialEntry.rinFast !== null ? String(initialEntry.rinFast) : '');
      setTresibaStr(initialEntry.tresiba !== null ? String(initialEntry.tresiba) : '');
      setCaloriesStr(initialEntry.calories !== null ? String(initialEntry.calories) : '');
      setNotes(initialEntry.notes || '');
      setTag(initialEntry.tag || 'other');
      setManualXe(false);
    } else {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');

      setDate(`${yyyy}-${mm}-${dd}`);
      setTime(`${hh}:${min}`);
      setGlucoseStr('');
      setCarbsStr('');
      setXeStr('');
      setRinFastStr('');
      setTresibaStr('');
      setCaloriesStr('');
      setNotes('');
      setTag('other');
      setManualXe(false);
    }
  }, [initialEntry, isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Автоматический пересчет ХЕ при вводе углеводов
  const handleCarbsChange = (val: string) => {
    setCarbsStr(val);
    if (!manualXe) {
      const num = parseFloat(val.replace(',', '.'));
      if (!isNaN(num) && num >= 0) {
        const computedXe = calculateXE(num, xeRatio);
        setXeStr(computedXe !== null ? String(computedXe) : '');
      } else if (val === '') {
        setXeStr('');
      }
    }
  };

  const handleXeChange = (val: string) => {
    setManualXe(true);
    setXeStr(val);
  };

  const parsedGlucose = glucoseStr ? parseFloat(glucoseStr.replace(',', '.')) : null;
  const glucoseEval = parsedGlucose !== null && !isNaN(parsedGlucose) ? evaluateGlucose(parsedGlucose) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const gVal = glucoseStr ? parseFloat(glucoseStr.replace(',', '.')) : null;
    const cVal = carbsStr ? parseFloat(carbsStr.replace(',', '.')) : null;
    const xeVal = xeStr ? parseFloat(xeStr.replace(',', '.')) : null;
    const rfVal = rinFastStr ? parseFloat(rinFastStr.replace(',', '.')) : null;
    const trVal = tresibaStr ? parseFloat(tresibaStr.replace(',', '.')) : null;
    const calVal = caloriesStr ? parseFloat(caloriesStr.replace(',', '.')) : null;

    onSave({
      id: initialEntry ? initialEntry.id : undefined,
      date: date || new Date().toISOString().slice(0, 10),
      time: time || '12:00',
      glucose: gVal !== null && !isNaN(gVal) ? Number(gVal.toFixed(1)) : null,
      carbs: cVal !== null && !isNaN(cVal) ? Math.round(cVal) : null,
      xe: xeVal !== null && !isNaN(xeVal) ? Number(xeVal.toFixed(1)) : null,
      rinFast: rfVal !== null && !isNaN(rfVal) ? Number(rfVal.toFixed(1)) : null,
      tresiba: trVal !== null && !isNaN(trVal) ? Number(trVal.toFixed(1)) : null,
      calories: calVal !== null && !isNaN(calVal) ? Math.round(calVal) : null,
      notes: notes.trim(),
      tag,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-fadeIn">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 id="entry-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {initialEntry ? 'Редактировать запись' : 'Новая запись в дневник'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Учет глюкозы, инсулина, углеводов и ХЕ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm">
          
          {/* Дата и Время */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label htmlFor="entry-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Дата *
              </label>
              <input
                id="entry-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label htmlFor="entry-time" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Время *
              </label>
              <div className="flex gap-2">
                <input
                  id="entry-time"
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 h-11 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, '0');
                    const mm = String(now.getMinutes()).padStart(2, '0');
                    setTime(`${hh}:${mm}`);
                  }}
                  className="h-11 px-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer min-w-[64px]"
                >
                  Сейчас
                </button>
              </div>
            </div>
          </div>

          {/* Контекст измерения */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Контекст измерения
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CONTEXT_TAGS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTag(item.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer min-h-[36px] ${
                    tag === item.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Глюкоза */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="entry-glucose" className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-600" />
                Глюкоза крови (ммоль/л)
              </label>

              {glucoseEval && (
                <div className={`px-2 py-0.5 rounded text-xs font-semibold border ${glucoseEval.badgeClass} flex items-center gap-1`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  <span>{glucoseEval.shortLabel}</span>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                id="entry-glucose"
                ref={glucoseInputRef}
                type="number"
                step="0.1"
                min="0"
                max="45"
                placeholder="Например: 5.8"
                value={glucoseStr}
                onChange={(e) => setGlucoseStr(e.target.value)}
                className="w-full h-12 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xl font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <span className="absolute right-4 top-3.5 text-xs text-slate-400 font-mono pointer-events-none">
                ммоль/л
              </span>
            </div>

            {glucoseEval ? (
              <p className={`text-xs ${glucoseEval.textClass} flex items-center gap-1 font-medium`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {glucoseEval.description}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Целевой диапазон нормы: 4.0 – 9.9 ммоль/л. Значения ниже 3.9 ммоль/л считаются гипогликемией.
              </p>
            )}
          </div>

          {/* Инсулины: РинФаст и Тресиба с исправленными подписями кнопок */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* Болюс */}
            <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 space-y-2">
              <label htmlFor="entry-rinfast" className="block text-xs font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {bolusName} (болюс на еду/ДПС)
              </label>

              <div className="relative">
                <input
                  id="entry-rinfast"
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={rinFastStr}
                  onChange={(e) => setRinFastStr(e.target.value)}
                  className="w-full h-11 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3.5 top-3 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 pointer-events-none">
                  ЕД
                </span>
              </div>

              {/* Пресеты доз — теперь четко подписаны как значение, а не инкремент */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Быстрый выбор дозы:</span>
                <div className="flex gap-1">
                  {[2, 4, 6, 8, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setRinFastStr(String(num))}
                      className="flex-1 py-1.5 text-xs font-mono font-semibold bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer min-h-[34px]"
                      title={`Установить дозу ${num} ед`}
                    >
                      {num} ед
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Базал */}
            <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/60 space-y-2">
              <label htmlFor="entry-tresiba" className="block text-xs font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {basalName} (базальный на ночь)
              </label>

              <div className="relative">
                <input
                  id="entry-tresiba"
                  type="number"
                  step="0.5"
                  min="0"
                  max="120"
                  placeholder="0"
                  value={tresibaStr}
                  onChange={(e) => setTresibaStr(e.target.value)}
                  className="w-full h-11 px-3 py-2 rounded-lg border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <span className="absolute right-3.5 top-3 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 pointer-events-none">
                  ЕД
                </span>
              </div>

              {/* Пресеты доз — теперь четко подписаны как значение, а не инкремент */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Быстрый выбор дозы:</span>
                <div className="flex gap-1">
                  {[12, 14, 16, 18, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTresibaStr(String(num))}
                      className="flex-1 py-1.5 text-xs font-mono font-semibold bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer min-h-[34px]"
                      title={`Установить дозу ${num} ед`}
                    >
                      {num} ед
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Питание: Углеводы, ХЕ (авто), Калории */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            
            {/* Углеводы */}
            <div>
              <label htmlFor="entry-carbs" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-500" />
                Углеводы (г)
              </label>
              <div className="relative">
                <input
                  id="entry-carbs"
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={carbsStr}
                  onChange={(e) => handleCarbsChange(e.target.value)}
                  className="w-full h-11 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="absolute right-3.5 top-3 text-xs text-slate-400 font-mono pointer-events-none">г</span>
              </div>
            </div>

            {/* ХЕ (авто: углев / 12) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="entry-xe" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  ХЕ (÷{xeRatio})
                </label>
                {carbsStr && (
                  <span className="text-xs text-teal-700 dark:text-teal-400 font-semibold">
                    {manualXe ? 'вручную' : 'авто'}
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  id="entry-xe"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  value={xeStr}
                  onChange={(e) => handleXeChange(e.target.value)}
                  className="w-full h-11 px-3.5 py-2 rounded-lg border border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/30 text-slate-900 dark:text-slate-100 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="absolute right-3.5 top-3 text-xs text-teal-700 dark:text-teal-400 font-mono font-bold pointer-events-none">ХЕ</span>
              </div>
            </div>

            {/* Калории */}
            <div>
              <label htmlFor="entry-calories" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Калории (ккал)
              </label>
              <div className="relative">
                <input
                  id="entry-calories"
                  type="number"
                  step="5"
                  min="0"
                  placeholder="0"
                  value={caloriesStr}
                  onChange={(e) => setCaloriesStr(e.target.value)}
                  className="w-full h-11 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <span className="absolute right-3.5 top-3 text-xs text-slate-400 font-mono pointer-events-none">ккал</span>
              </div>
            </div>

          </div>

          {/* Примечания */}
          <div>
            <label htmlFor="entry-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Примечания / Еда / Активность
            </label>
            <textarea
              id="entry-notes"
              rows={2}
              placeholder="Что съели, физическая активность, самочувствие..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer min-h-[44px]"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="h-11 px-5 rounded-lg bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white text-xs sm:text-sm font-semibold shadow-xs flex items-center gap-2 transition cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>{initialEntry ? 'Сохранить изменения' : 'Добавить запись'}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
