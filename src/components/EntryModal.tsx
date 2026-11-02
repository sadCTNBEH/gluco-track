import React, { useState, useEffect } from 'react';
import { DiaryEntry } from '../types/diabetes';
import { evaluateGlucose, calculateXE } from '../utils/diabetes';
import { X, Check, Activity, Utensils, Syringe, Flame, Clock, Calendar, AlertCircle, Sparkles } from 'lucide-react';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }) => void;
  initialEntry?: DiaryEntry | null;
  xeRatio?: number;
}

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  xeRatio = 12,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800/90 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/25">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {initialEntry ? 'Редактировать измерение' : 'Новое измерение в дневник'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Сахар, инсулин РинФаст / Тресиба, углеводы и ХЕ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Дата и Время */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Дата *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs sm:text-sm font-mono focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Время *
              </label>
              <div className="flex gap-2">
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-slate-900 dark:text-white text-xs sm:text-sm font-mono focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, '0');
                    const mm = String(now.getMinutes()).padStart(2, '0');
                    setTime(`${hh}:${mm}`);
                  }}
                  className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl border border-slate-200/60 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="Установить текущее время"
                >
                  Сейчас
                </button>
              </div>
            </div>
          </div>

          {/* Контекст измерения (чипы) */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Контекст измерения
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'fasting', label: 'Натощак' },
                { id: 'breakfast', label: 'Завтрак' },
                { id: 'lunch', label: 'Обед' },
                { id: 'dinner', label: 'Ужин' },
                { id: 'snack', label: 'Перекус' },
                { id: 'bedtime', label: 'На ночь' },
                { id: 'correction', label: 'Коррекция (ДПС)' },
                { id: 'other', label: 'Другое' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTag(item.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    tag === item.id
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Глюкоза и Автоматическая клиническая оценка */}
          <div className="p-4 rounded-3xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-500" /> Глюкоза крови (ммоль/л)
              </label>
              {glucoseEval && (
                <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${glucoseEval.badgeClass} flex items-center gap-1.5 animate-fadeIn`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  <span>Статус: <strong>{glucoseEval.shortLabel}</strong></span>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0"
                max="45"
                placeholder="например 5.6"
                value={glucoseStr}
                onChange={(e) => setGlucoseStr(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xl font-extrabold focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 outline-none transition"
              />
              <span className="absolute right-4 top-3.5 text-xs font-mono font-bold text-slate-400">
                ммоль/л
              </span>
            </div>

            {glucoseEval ? (
              <p className={`text-xs ${glucoseEval.textClass} flex items-center gap-1 font-medium`}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {glucoseEval.description}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                Клиническая шкала: &lt;3.9 (Низкий), 4.0–9.9 (Целевой/Норма), 10.0–13.9 (Высокий), &gt;13.9 (Критический).
              </p>
            )}
          </div>

          {/* Инсулины: РинФаст и Тресиба */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            {/* РинФаст (ультракороткий болюс) */}
            <div className="p-4 rounded-3xl bg-blue-500/10 dark:bg-blue-950/20 border border-blue-500/20 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> РинФаст (болюс)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={rinFastStr}
                  onChange={(e) => setRinFastStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-blue-500/40 outline-none"
                />
                <span className="absolute right-3.5 top-3 text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  ЕД
                </span>
              </div>
              {/* Быстрые пресеты доз */}
              <div className="flex gap-1">
                {[2, 4, 6, 8, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRinFastStr(String(num))}
                    className="flex-1 py-1 text-[11px] font-mono font-bold bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-300 rounded-xl border border-blue-200/80 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            {/* Тресиба (базальный продленный) */}
            <div className="p-4 rounded-3xl bg-purple-500/10 dark:bg-purple-950/20 border border-purple-500/20 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <Syringe className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Тресиба (базал)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="120"
                  placeholder="0"
                  value={tresibaStr}
                  onChange={(e) => setTresibaStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-base focus:ring-2 focus:ring-purple-500/40 outline-none"
                />
                <span className="absolute right-3.5 top-3 text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                  ЕД
                </span>
              </div>
              {/* Быстрые пресеты доз */}
              <div className="flex gap-1">
                {[12, 14, 16, 18, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setTresibaStr(String(num))}
                    className="flex-1 py-1 text-[11px] font-mono font-bold bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-300 rounded-xl border border-purple-200/80 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Питание: Углеводы, ХЕ (авто), Калории */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            
            {/* Углеводы */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-500" /> Углеводы (г)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  placeholder="0"
                  value={carbsStr}
                  onChange={(e) => handleCarbsChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold text-xs sm:text-sm focus:ring-2 focus:ring-teal-500/40 outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">г</span>
              </div>
            </div>

            {/* ХЕ (авто: углев / 12) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ХЕ (÷{xeRatio})
                </label>
                {carbsStr && (
                  <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                    авто
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  value={xeStr}
                  onChange={(e) => handleXeChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-teal-500/30 dark:border-teal-500/30 bg-teal-500/10 dark:bg-teal-950/20 text-slate-900 dark:text-white font-mono font-extrabold text-xs sm:text-sm focus:ring-2 focus:ring-teal-500/40 outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-teal-600 dark:text-teal-400 font-bold">ХЕ</span>
              </div>
            </div>

            {/* Калории */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" /> Калории (ккал)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="5"
                  min="0"
                  placeholder="0"
                  value={caloriesStr}
                  onChange={(e) => setCaloriesStr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold text-xs sm:text-sm focus:ring-2 focus:ring-teal-500/40 outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">ккал</span>
              </div>
            </div>

          </div>

          {/* Еда / комментарии */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Еда / активность / примечания
            </label>
            <textarea
              rows={2}
              placeholder="Что съели, самочувствие, физическая нагрузка..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm focus:ring-2 focus:ring-teal-500/40 outline-none transition placeholder:text-slate-400"
            />
            {/* Быстрые теги заметок */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                'Овсянка с ягодами',
                'Гречка с мясом',
                'Овощной салат',
                'Быстрые углеводы (сок 200мл)',
                'Прогулка 40 мин',
                'Тренировка',
                'Стресс / работа',
                'Перед сном',
              ].map((txt) => (
                <button
                  key={txt}
                  type="button"
                  onClick={() => setNotes((prev) => (prev ? `${prev}, ${txt}` : txt))}
                  className="px-2.5 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  +{txt}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-97 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-500/25 flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {initialEntry ? 'Сохранить изменения' : 'Добавить замер'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
