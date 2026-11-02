import { DiaryEntry, GlucoseStatus, DaySummary, MonthlyStats, UserSettings } from '../types/diabetes';

export const DEFAULT_SETTINGS: UserSettings = {
  patientName: 'Пациент',
  diabetesType: '1',
  xeRatio: 12,
  targetLow: 4.0,
  targetHigh: 9.9,
  hypoThreshold: 3.9,
  severeHyperThreshold: 13.9,
  bolusName: 'РинФаст',
  basalName: 'Тресиба',
  doctorName: '',
  doctorNotes: 'Инсулинотерапия: РинФаст (ультракороткий) + Тресиба (базальный сверхдлительный). Целевой диапазон гликемии: 4.0 – 9.9 ммоль/л.',
};

export interface GlucoseEvaluation {
  status: GlucoseStatus;
  label: string;
  shortLabel: string;
  badgeClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
}

/**
 * Оценка уровня сахара в крови:
 * < 3.9  => Низкий (гипогликемия, выделяется красным)
 * 4.0 .. 9.9 => Норма (целевой диапазон, выделяется зеленым)
 * 10.0 .. 13.9 => Высокий (выделяется желтым/янтарным)
 * > 13.9 => Очень высокий (выделяется красным/пурпурным)
 */
export function evaluateGlucose(glucose: number | null | undefined): GlucoseEvaluation | null {
  if (glucose === null || glucose === undefined || isNaN(glucose) || glucose <= 0) {
    return null;
  }

  const val = Number(glucose.toFixed(1));

  if (val <= 3.9) {
    return {
      status: 'low',
      label: 'Низкий (Гипо)',
      shortLabel: 'Низкий',
      badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-semibold',
      textClass: 'text-red-600 dark:text-red-400 font-bold',
      bgClass: 'bg-red-500/10',
      borderClass: 'border-red-400',
      description: 'Гипогликемия (≤ 3.9 ммоль/л). Требуется купирование быстрыми углеводами.',
    };
  }

  if (val <= 9.9) {
    return {
      status: 'normal',
      label: 'Норма',
      shortLabel: 'Норма',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
      textClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-400',
      description: 'Целевой диапазон (4.0 – 9.9 ммоль/л). Отличный контроль.',
    };
  }

  if (val <= 13.9) {
    return {
      status: 'high',
      label: 'Высокий',
      shortLabel: 'Высокий',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold',
      textClass: 'text-amber-600 dark:text-amber-400 font-bold',
      bgClass: 'bg-amber-500/10',
      borderClass: 'border-amber-400',
      description: 'Повышенный уровень (10.0 – 13.9 ммоль/л). Гипергликемия.',
    };
  }

  // > 13.9
  return {
    status: 'very_high',
    label: 'Очень высокий',
    shortLabel: 'Очень высокий',
    badgeClass: 'bg-rose-600/20 text-rose-700 dark:text-rose-400 border-rose-600/40 font-bold',
    textClass: 'text-rose-600 dark:text-rose-400 font-extrabold',
    bgClass: 'bg-rose-500/15',
    borderClass: 'border-rose-500',
    description: 'Выраженная гипергликемия (> 13.9 ммоль/л). Требуется контроль кетонов и коррекция.',
  };
}

/**
 * Расчет ХЕ (Хлебных Единиц): количество углеводов делится на 12 (или заданный xeRatio)
 * Округляется до 1 десятичного знака.
 */
export function calculateXE(carbs: number | null | undefined, xeRatio: number = 12): number | null {
  if (carbs === null || carbs === undefined || isNaN(carbs) || carbs < 0) {
    return null;
  }
  const ratio = xeRatio > 0 ? xeRatio : 12;
  return Number((carbs / ratio).toFixed(1));
}

/**
 * Расчет агрегатов за один день
 */
export function calculateDayAggregates(entries: DiaryEntry[]): DaySummary {
  if (!entries || entries.length === 0) {
    return {
      date: '',
      entriesCount: 0,
      avgGlucose: null,
      totalRinFast: 0,
      totalTresiba: 0,
      totalCarbs: 0,
      totalXE: 0,
      totalCalories: 0,
      minGlucose: null,
      maxGlucose: null,
    };
  }

  const date = entries[0].date;
  let glucoseSum = 0;
  let glucoseCount = 0;
  let minG: number | null = null;
  let maxG: number | null = null;

  let totalRinFast = 0;
  let totalTresiba = 0;
  let totalCarbs = 0;
  let totalXE = 0;
  let totalCalories = 0;

  for (const entry of entries) {
    if (entry.glucose !== null && entry.glucose > 0) {
      glucoseSum += entry.glucose;
      glucoseCount++;
      if (minG === null || entry.glucose < minG) minG = entry.glucose;
      if (maxG === null || entry.glucose > maxG) maxG = entry.glucose;
    }
    if (entry.rinFast && entry.rinFast > 0) {
      totalRinFast += entry.rinFast;
    }
    if (entry.tresiba && entry.tresiba > 0) {
      totalTresiba += entry.tresiba;
    }
    if (entry.carbs && entry.carbs > 0) {
      totalCarbs += entry.carbs;
    }
    if (entry.xe && entry.xe > 0) {
      totalXE += entry.xe;
    }
    if (entry.calories && entry.calories > 0) {
      totalCalories += entry.calories;
    }
  }

  return {
    date,
    entriesCount: entries.length,
    avgGlucose: glucoseCount > 0 ? Number((glucoseSum / glucoseCount).toFixed(1)) : null,
    totalRinFast: Number(totalRinFast.toFixed(1)),
    totalTresiba: Number(totalTresiba.toFixed(1)),
    totalCarbs: Math.round(totalCarbs),
    totalXE: Number(totalXE.toFixed(1)),
    totalCalories: Math.round(totalCalories),
    minGlucose: minG,
    maxGlucose: maxG,
  };
}

/**
 * Группировка записей по датам (YYYY-MM-DD), отсортированных по убыванию даты и по возрастанию времени внутри дня
 */
export function groupEntriesByDay(entries: DiaryEntry[]): { date: string; entries: DiaryEntry[]; summary: DaySummary }[] {
  const groups: Record<string, DiaryEntry[]> = {};

  for (const entry of entries) {
    if (!groups[entry.date]) {
      groups[entry.date] = [];
    }
    groups[entry.date].push(entry);
  }

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedDates.map((date) => {
    // Внутри дня сортируем по времени по возрастанию
    const dayEntries = groups[date].sort((a, b) => a.time.localeCompare(b.time));
    return {
      date,
      entries: dayEntries,
      summary: calculateDayAggregates(dayEntries),
    };
  });
}

/**
 * Определение периода суток для записи:
 * Утро (завтрак, натощак, 06:00–11:59)
 * День (обед, 12:00–17:59)
 * Вечер (ужин, 18:00–22:59)
 * Ночь (на ночь, 23:00–05:59)
 */
export function getEntryPeriod(entry: DiaryEntry): 'morning' | 'day' | 'evening' | 'night' {
  if (entry.tag === 'breakfast' || entry.tag === 'fasting') return 'morning';
  if (entry.tag === 'lunch') return 'day';
  if (entry.tag === 'dinner') return 'evening';
  if (entry.tag === 'bedtime' || entry.tag === 'night') return 'night';

  const lowerNote = (entry.notes || '').toLowerCase();
  if (lowerNote.includes('завтрак') || lowerNote.includes('утро') || lowerNote.includes('натощак')) return 'morning';
  if (lowerNote.includes('обед') || lowerNote.includes('день') || lowerNote.includes('полдник')) return 'day';
  if (lowerNote.includes('ужин') || lowerNote.includes('вечер')) return 'evening';
  if (lowerNote.includes('ночь') || lowerNote.includes('сон') || lowerNote.includes('на ночь')) return 'night';

  const hour = parseInt((entry.time || '12:00').split(':')[0], 10);
  if (!isNaN(hour)) {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'day';
    if (hour >= 18 && hour < 23) return 'evening';
    return 'night';
  }
  return 'day';
}

/**
 * Проверка, является ли день полным (указаны утро, день, вечер и ночь)
 */
export function isDayComplete(dayEntries: DiaryEntry[]): boolean {
  let hasMorning = false;
  let hasDay = false;
  let hasEvening = false;
  let hasNight = false;

  for (const entry of dayEntries) {
    const period = getEntryPeriod(entry);
    if (period === 'morning') hasMorning = true;
    else if (period === 'day') hasDay = true;
    else if (period === 'evening') hasEvening = true;
    else if (period === 'night') hasNight = true;
  }

  return hasMorning && hasDay && hasEvening && hasNight;
}

/**
 * Расчет статистики за месяц
 */
export function calculateMonthlyStats(entries: DiaryEntry[], monthStr?: string): MonthlyStats {
  const targetMonth = monthStr || new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthEntries = entries.filter((e) => e.date.startsWith(targetMonth));

  let glucoseSum = 0;
  let glucoseCount = 0;
  let lowCount = 0;
  let normalCount = 0;
  let highCount = 0;
  let veryHighCount = 0;

  let totalRinFast = 0;
  let totalTresiba = 0;
  let totalCarbs = 0;
  let totalCalories = 0;

  const activeDays = new Set<string>();
  const daysMap: Record<string, DiaryEntry[]> = {};

  for (const entry of monthEntries) {
    activeDays.add(entry.date);
    if (!daysMap[entry.date]) daysMap[entry.date] = [];
    daysMap[entry.date].push(entry);

    if (entry.glucose !== null && entry.glucose > 0) {
      glucoseSum += entry.glucose;
      glucoseCount++;

      const evaluation = evaluateGlucose(entry.glucose);
      if (evaluation) {
        if (evaluation.status === 'low') lowCount++;
        else if (evaluation.status === 'normal') normalCount++;
        else if (evaluation.status === 'high') highCount++;
        else if (evaluation.status === 'very_high') veryHighCount++;
      }
    }

    if (entry.rinFast) totalRinFast += entry.rinFast;
    if (entry.tresiba) totalTresiba += entry.tresiba;
    if (entry.carbs) totalCarbs += entry.carbs;
    if (entry.calories) totalCalories += entry.calories;
  }

  const activeDaysCount = activeDays.size || 1;
  const avgGlucose = glucoseCount > 0 ? Number((glucoseSum / glucoseCount).toFixed(1)) : null;

  // Формула примерного расчета гликированного гемоглобина (HbA1c / GMI): (avgGlucose * 18.05 + 46.7) / 28.7
  const estimatedHbA1c = avgGlucose ? Number(((avgGlucose * 18.05 + 46.7) / 28.7).toFixed(1)) : null;

  const tirTotal = glucoseCount || 1;
  const tir = {
    lowCount,
    lowPercent: glucoseCount > 0 ? Math.round((lowCount / tirTotal) * 100) : 0,
    normalCount,
    normalPercent: glucoseCount > 0 ? Math.round((normalCount / tirTotal) * 100) : 0,
    highCount,
    highPercent: glucoseCount > 0 ? Math.round((highCount / tirTotal) * 100) : 0,
    veryHighCount,
    veryHighPercent: glucoseCount > 0 ? Math.round((veryHighCount / tirTotal) * 100) : 0,
  };

  // Расчет среднесуточного болюса (РинФаст) по полным дням (где указаны утро, день, вечер и ночь)
  const fullDaysEntries = Object.entries(daysMap).filter(([_, dayList]) => isDayComplete(dayList));
  const fullDaysCount = fullDaysEntries.length;

  let avgDailyRinFast: number;
  if (fullDaysCount > 0) {
    const fullDaysRinFastSum = fullDaysEntries.reduce((sum, [_, dayList]) => {
      return sum + dayList.reduce((s, e) => s + (e.rinFast || 0), 0);
    }, 0);
    avgDailyRinFast = Number((fullDaysRinFastSum / fullDaysCount).toFixed(1));
  } else {
    const daysWithRinFast = Object.values(daysMap).filter((d) => d.some((e) => (e.rinFast || 0) > 0));
    const denom = daysWithRinFast.length || activeDaysCount;
    avgDailyRinFast = Number((totalRinFast / denom).toFixed(1));
  }

  return {
    month: targetMonth,
    totalEntries: monthEntries.length,
    avgGlucose,
    estimatedHbA1c,
    tir,
    totalRinFast: Number(totalRinFast.toFixed(1)),
    avgDailyRinFast,
    totalTresiba: Number(totalTresiba.toFixed(1)),
    avgDailyTresiba: Number((totalTresiba / activeDaysCount).toFixed(1)),
    totalCarbs: Math.round(totalCarbs),
    avgDailyCarbs: Math.round(totalCarbs / activeDaysCount),
    totalCalories: Math.round(totalCalories),
    avgDailyCalories: Math.round(totalCalories / activeDaysCount),
    activeDaysCount: activeDays.size,
    fullDaysCount,
  };
}

/**
 * Русские названия месяцев
 */
export const RUSSIAN_MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export const RUSSIAN_WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const RUSSIAN_WEEKDAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

export function formatDateRussian(dateStr: string, includeYear: boolean = true): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dateObj = new Date(y, m - 1, d);
  const weekday = RUSSIAN_WEEKDAYS[dateObj.getDay()];
  const monthName = RUSSIAN_MONTHS[m - 1].toLowerCase();
  return `${d} ${monthName}${includeYear ? ` ${y}` : ''} (${weekday})`;
}

export function formatMonthYearRussian(monthStr: string): string {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m) return monthStr;
  return `${RUSSIAN_MONTHS[m - 1]} ${y} г.`;
}

/**
 * Экспорт записей в CSV
 */
export function exportEntriesToCSV(entries: DiaryEntry[]): string {
  const headers = [
    'Дата',
    'Время',
    'Глюкоза (ммоль/л)',
    'Оценка',
    'Углеводы (г)',
    'ХЕ (Хлебные единицы)',
    'РинФаст (ед)',
    'Тресиба (ед)',
    'Калории (ккал)',
    'Еда / нагрузка / комментарий',
  ];

  const rows = entries.map((e) => {
    const evalStatus = evaluateGlucose(e.glucose);
    return [
      e.date,
      e.time,
      e.glucose !== null ? e.glucose.toString().replace('.', ',') : '',
      evalStatus ? evalStatus.shortLabel : '',
      e.carbs !== null ? e.carbs.toString() : '',
      e.xe !== null ? e.xe.toString().replace('.', ',') : '',
      e.rinFast !== null ? e.rinFast.toString() : '',
      e.tresiba !== null ? e.tresiba.toString() : '',
      e.calories !== null ? e.calories.toString() : '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
    ].join(';');
  });

  return [headers.join(';'), ...rows].join('\r\n');
}
