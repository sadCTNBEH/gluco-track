import React, { useState, useEffect, useRef } from 'react';
import { DiaryEntry, UserSettings, DraftDiaryEntry } from '../types/diabetes';
import { evaluateGlucose, calculateXE, getTodayDateString, getCurrentTimeString } from '../utils/diabetes';
import { CONTEXT_TAGS } from '../constants/diaryTags';
import { Check, Activity, Utensils, Syringe, Moon, Flame, Clock, Calendar, AlertCircle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: DraftDiaryEntry) => void;
  initialEntry?: DiaryEntry | null;
  xeRatio?: number;
  bolusName?: string;
  basalName?: string;
  settings?: UserSettings;
}

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  xeRatio = 12,
  bolusName = 'РинФаст',
  basalName = 'Тресиба',
  settings,
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
      setDate(getTodayDateString());
      setTime(getCurrentTimeString());
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
  const glucoseEval = parsedGlucose !== null && !isNaN(parsedGlucose) ? evaluateGlucose(parsedGlucose, settings) : null;

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
      date: date || getTodayDateString(),
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialEntry ? 'Редактировать запись' : 'Новая запись в дневник'}
      subtitle="Учет глюкозы, инсулина, углеводов и ХЕ"
      icon={<Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
      maxWidth="2xl"
      initialFocusRef={glucoseInputRef}
    >
      {/* Form Body */}
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          
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
                    setTime(getCurrentTimeString());
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
                  onClick={() => setTag(item.id)}
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

          {/* Глюкоза - Hero Input */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="entry-glucose" className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-600" />
                Глюкоза крови (ммоль/л)
              </label>

              {glucoseEval && (
                <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${glucoseEval.badgeClass} flex items-center gap-1 shadow-2xs`}>
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
                placeholder="5.8"
                value={glucoseStr}
                onChange={(e) => setGlucoseStr(e.target.value)}
                className="w-full h-14 pl-4 pr-20 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-2xl font-extrabold focus:outline-none focus:ring-2 focus:ring-teal-500 tabular-nums shadow-xs"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono pointer-events-none font-semibold">
                ммоль/л
              </span>
            </div>

            {glucoseEval ? (
              <p className={`text-xs ${glucoseEval.textClass} flex items-center gap-1.5 font-medium`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{glucoseEval.description}</span>
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Целевой диапазон нормы: 4.0 – 9.9 ммоль/л. Значения ниже 3.9 ммоль/л считаются гипогликемией.
              </p>
            )}
          </div>

          {/* Инсулины: РинФаст и Тресиба с интерактивными чипами */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* Болюс */}
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/60 space-y-2.5 shadow-2xs">
              <label htmlFor="entry-rinfast" className="block text-xs font-semibold text-blue-950 dark:text-blue-300 flex items-center gap-1.5">
                <Syringe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
                  className="w-full h-11 pl-3 pr-12 py-2 rounded-xl border border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 tabular-nums shadow-xs"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 pointer-events-none">
                  ЕД
                </span>
              </div>

              {/* Пресеты доз — интерактивные чипы */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Быстрый выбор дозы:</span>
                <div className="flex gap-1">
                  {[2, 4, 6, 8, 10].map((num) => {
                    const isActive = rinFastStr === String(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRinFastStr(String(num))}
                        className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer min-h-[34px] ${
                          isActive
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                        }`}
                        title={`Установить дозу ${num} ед`}
                      >
                        {num} ед
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Базал */}
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/60 space-y-2.5 shadow-2xs">
              <label htmlFor="entry-tresiba" className="block text-xs font-semibold text-purple-950 dark:text-purple-300 flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
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
                  className="w-full h-11 pl-3 pr-12 py-2 rounded-xl border border-purple-300 dark:border-purple-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-purple-500 tabular-nums shadow-xs"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-purple-700 dark:text-purple-300 pointer-events-none">
                  ЕД
                </span>
              </div>

              {/* Пресеты доз — интерактивные чипы */}
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Быстрый выбор дозы:</span>
                <div className="flex gap-1">
                  {[12, 14, 16, 18, 20].map((num) => {
                    const isActive = tresibaStr === String(num);
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTresibaStr(String(num))}
                        className={`flex-1 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-all cursor-pointer min-h-[34px] ${
                          isActive
                            ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                            : 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                        }`}
                        title={`Установить дозу ${num} ед`}
                      >
                        {num} ед
                      </button>
                    );
                  })}
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
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Check className="w-4 h-4" />}
            >
              <span>{initialEntry ? 'Сохранить изменения' : 'Добавить запись'}</span>
            </Button>
          </div>

        </form>
    </Modal>
  );
};
