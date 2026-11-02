import { DiaryEntry, GlucoseStatus, DaySummary, PeriodStats, MonthlyStats, UserSettings } from '../types/diabetes';
import { getCurrentMonthString } from './dateTime';

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
  eHbA1c: null,
  acr: null,
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
 * < 3.9 (или hypoThreshold) => Низкий (гипогликемия, выделяется красным)
 * 4.0 .. 9.9 (или targetHigh) => Норма (целевой диапазон, выделяется зеленым)
 * 10.0 .. 13.9 => Высокий (выделяется желтым/янтарным)
 * > 13.9 => Очень высокий (выделяется красным/пурпурным)
 */
export function evaluateGlucose(
  glucose: number | null | undefined,
  settings?: Partial<UserSettings> | { targetLow?: number; targetHigh?: number; hypoThreshold?: number; severeHyperThreshold?: number }
): GlucoseEvaluation | null {
  if (glucose === null || glucose === undefined || isNaN(glucose) || glucose <= 0) {
    return null;
  }

  const val = Number(glucose.toFixed(1));
  const hypoThreshold = settings?.hypoThreshold ?? 3.9;
  const targetHigh = settings?.targetHigh ?? 9.9;
  const severeHyperThreshold = settings?.severeHyperThreshold ?? 13.9;
  const targetLow = settings?.targetLow ?? Number((hypoThreshold + 0.1).toFixed(1));

  if (val <= hypoThreshold) {
    return {
      status: 'low',
      label: 'Низкий (Гипо)',
      shortLabel: 'Низкий',
      badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-semibold',
      textClass: 'text-red-600 dark:text-red-400 font-bold',
      bgClass: 'bg-red-500/10',
      borderClass: 'border-red-400',
      description: `Гипогликемия (≤ ${hypoThreshold} ммоль/л). Требуется купирование быстрыми углеводами.`,
    };
  }

  if (val <= targetHigh) {
    return {
      status: 'normal',
      label: 'Норма',
      shortLabel: 'Норма',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold',
      textClass: 'text-emerald-600 dark:text-emerald-400 font-bold',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-400',
      description: `Целевой диапазон (${targetLow} – ${targetHigh} ммоль/л). Отличный контроль.`,
    };
  }

  if (val <= severeHyperThreshold) {
    return {
      status: 'high',
      label: 'Высокий',
      shortLabel: 'Высокий',
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold',
      textClass: 'text-amber-600 dark:text-amber-400 font-bold',
      bgClass: 'bg-amber-500/10',
      borderClass: 'border-amber-400',
      description: `Повышенный уровень (${(targetHigh + 0.1).toFixed(1)} – ${severeHyperThreshold} ммоль/л). Гипергликемия.`,
    };
  }

  // > severeHyperThreshold
  return {
    status: 'very_high',
    label: 'Очень высокий',
    shortLabel: 'Очень высокий',
    badgeClass: 'bg-rose-600/20 text-rose-700 dark:text-rose-400 border-rose-600/40 font-bold',
    textClass: 'text-rose-600 dark:text-rose-400 font-extrabold',
    bgClass: 'bg-rose-500/15',
    borderClass: 'border-rose-500',
    description: `Выраженная гипергликемия (> ${severeHyperThreshold} ммоль/л). Требуется контроль кетонов и коррекция.`,
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
 * Проверка, является ли день полным (указаны утро, день и вечер)
 * Неполные дни, где пропущено утро, день или вечер, не должны учитываться при расчете среднего суточного инсулина.
 */
export function isDayComplete(dayEntries: DiaryEntry[]): boolean {
  let hasMorning = false;
  let hasDay = false;
  let hasEvening = false;

  for (const entry of dayEntries) {
    const period = getEntryPeriod(entry);
    if (period === 'morning') hasMorning = true;
    else if (period === 'day') hasDay = true;
    else if (period === 'evening') hasEvening = true;
    else if (period === 'night') {
      const hour = parseInt((entry.time || '').split(':')[0], 10);
      if (!isNaN(hour) && (hour >= 20 || hour <= 4)) {
        hasEvening = true;
      }
    }
  }

  return hasMorning && hasDay && hasEvening;
}

/**
 * Расчет среднесуточных доз болюса и базала с учетом полных дней (утро, день, вечер).
 */
export function calculateDailyInsulinAverages(daysMap: Record<string, DiaryEntry[]>): {
  avgDailyRinFast: number;
  avgDailyTresiba: number;
  fullDaysCount: number;
} {
  const fullDaysEntries = Object.entries(daysMap).filter(([_, dayList]) => isDayComplete(dayList));
  const fullDaysCount = fullDaysEntries.length;

  if (fullDaysCount > 0) {
    const fullDaysRinFastSum = fullDaysEntries.reduce((sum, [_, dayList]) => {
      return sum + dayList.reduce((s, e) => s + (e.rinFast || 0), 0);
    }, 0);
    const fullDaysTresibaSum = fullDaysEntries.reduce((sum, [_, dayList]) => {
      return sum + dayList.reduce((s, e) => s + (e.tresiba || 0), 0);
    }, 0);

    return {
      avgDailyRinFast: Number((fullDaysRinFastSum / fullDaysCount).toFixed(1)),
      avgDailyTresiba: Number((fullDaysTresibaSum / fullDaysCount).toFixed(1)),
      fullDaysCount,
    };
  }

  // Резервный расчет (если ни один день не заполнен всеми 3 приемами пищи)
  const allDays = Object.values(daysMap);
  const totalRinFast = allDays.reduce((sum, d) => sum + d.reduce((s, e) => s + (e.rinFast || 0), 0), 0);
  const totalTresiba = allDays.reduce((sum, d) => sum + d.reduce((s, e) => s + (e.tresiba || 0), 0), 0);

  const daysWithRinFast = allDays.filter((d) => d.some((e) => (e.rinFast || 0) > 0));
  const daysWithTresiba = allDays.filter((d) => d.some((e) => (e.tresiba || 0) > 0));

  const denomRf = daysWithRinFast.length || allDays.length || 1;
  const denomTr = daysWithTresiba.length || allDays.length || 1;

  return {
    avgDailyRinFast: Number((totalRinFast / denomRf).toFixed(1)),
    avgDailyTresiba: Number((totalTresiba / denomTr).toFixed(1)),
    fullDaysCount: 0,
  };
}

/**
 * Расчет ориентировочного гликированного гемоглобина (eHbA1c / GMI) по стандартной формуле ADAG:
 * eHbA1c (%) = (avgGlucose_mmol * 18.05 + 46.7) / 28.7
 * Является единым источником расчетного HbA1c в приложении.
 * Не заменяет лабораторный анализ HbA1c.
 *
 * @param avgGlucose Средняя гликемия в ммоль/л
 * @returns Ориентировочный процент eHbA1c, округленный до 1 десятичного знака, или null
 */
export function calculateEstimatedHbA1c(avgGlucose: number | null | undefined): number | null {
  if (
    avgGlucose === null ||
    avgGlucose === undefined ||
    typeof avgGlucose !== 'number' ||
    isNaN(avgGlucose) ||
    !isFinite(avgGlucose) ||
    avgGlucose <= 0
  ) {
    return null;
  }
  return Number(((avgGlucose * 18.05 + 46.7) / 28.7).toFixed(1));
}

/**
 * Единый расчет сводной медицинской статистики за произвольный период (TIR, средняя, мин/макс глюкоза, инсулин, углеводы).
 * Служит единым источником расчетов для дневника, графиков и PDF-отчета врача.
 */
export function calculatePeriodStats(
  entries: DiaryEntry[],
  settings?: UserSettings
): PeriodStats {
  let glucoseSum = 0;
  let glucoseCount = 0;
  let minGlucose: number | null = null;
  let maxGlucose: number | null = null;
  let lowCount = 0;
  let normalCount = 0;
  let highCount = 0;
  let veryHighCount = 0;

  let totalRinFast = 0;
  let totalTresiba = 0;
  let totalCarbs = 0;
  let totalXE = 0;
  let totalCalories = 0;

  const activeDays = new Set<string>();
  const daysMap: Record<string, DiaryEntry[]> = {};

  for (const entry of entries) {
    activeDays.add(entry.date);
    if (!daysMap[entry.date]) daysMap[entry.date] = [];
    daysMap[entry.date].push(entry);

    if (entry.glucose !== null && entry.glucose !== undefined && entry.glucose > 0) {
      glucoseSum += entry.glucose;
      glucoseCount++;

      if (minGlucose === null || entry.glucose < minGlucose) {
        minGlucose = entry.glucose;
      }
      if (maxGlucose === null || entry.glucose > maxGlucose) {
        maxGlucose = entry.glucose;
      }

      const evaluation = evaluateGlucose(entry.glucose, settings);
      if (evaluation) {
        if (evaluation.status === 'low') lowCount++;
        else if (evaluation.status === 'normal') normalCount++;
        else if (evaluation.status === 'high') highCount++;
        else if (evaluation.status === 'very_high') veryHighCount++;
      }
    }

    if (entry.rinFast && entry.rinFast > 0) totalRinFast += entry.rinFast;
    if (entry.tresiba && entry.tresiba > 0) totalTresiba += entry.tresiba;
    if (entry.carbs && entry.carbs > 0) totalCarbs += entry.carbs;
    if (entry.xe && entry.xe > 0) totalXE += entry.xe;
    if (entry.calories && entry.calories > 0) totalCalories += entry.calories;
  }

  const activeDaysCount = activeDays.size;
  const activeDaysDivisor = activeDaysCount || 1;
  const avgGlucose = glucoseCount > 0 ? Number((glucoseSum / glucoseCount).toFixed(1)) : null;

  // Единый расчет ориентировочного HbA1c (ADAG formula)
  const estimatedHbA1c = calculateEstimatedHbA1c(avgGlucose);

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

  // Расчет среднесуточных доз болюса и базала по полным дням (где указаны утро, день и вечер)
  const insulinStats = calculateDailyInsulinAverages(daysMap);

  const avgDailyRinFast = insulinStats.avgDailyRinFast;
  const avgDailyTresiba = insulinStats.avgDailyTresiba;
  const avgDailyCarbs = Math.round(totalCarbs / activeDaysDivisor);
  const avgDailyCalories = Math.round(totalCalories / activeDaysDivisor);
  const avgDailyXE = Number((totalXE / activeDaysDivisor).toFixed(1));

  return {
    totalEntries: entries.length,
    entriesCount: entries.length,
    glucoseCount,
    activeDaysCount,
    activeDays: activeDaysCount,
    avgGlucose,
    minGlucose: minGlucose !== null ? Number(minGlucose.toFixed(1)) : null,
    maxGlucose: maxGlucose !== null ? Number(maxGlucose.toFixed(1)) : null,
    estimatedHbA1c,
    tir,
    totalRinFast: Number(totalRinFast.toFixed(1)),
    avgDailyRinFast,
    avgRinFast: avgDailyRinFast,
    totalTresiba: Number(totalTresiba.toFixed(1)),
    avgDailyTresiba,
    avgTresiba: avgDailyTresiba,
    totalCarbs: Math.round(totalCarbs),
    avgDailyCarbs,
    avgCarbs: avgDailyCarbs,
    totalXE: Number(totalXE.toFixed(1)),
    avgDailyXE,
    avgXE: avgDailyXE,
    totalCalories: Math.round(totalCalories),
    avgDailyCalories,
    avgCalories: avgDailyCalories,
    fullDaysCount: insulinStats.fullDaysCount,
  };
}

/**
 * Расчет статистики за месяц (или по всем записям, если monthStr не передан).
 * Делегирует вычисления в calculatePeriodStats для исключения дублирования логики.
 */
export function calculateMonthlyStats(
  entries: DiaryEntry[],
  monthStr?: string,
  settings?: UserSettings
): MonthlyStats {
  const monthEntries = monthStr ? entries.filter((e) => e.date.startsWith(monthStr)) : entries;
  const targetMonth = monthStr || (entries.length > 0 ? entries[0].date.slice(0, 7) : getCurrentMonthString());
  const periodStats = calculatePeriodStats(monthEntries, settings);

  return {
    ...periodStats,
    month: targetMonth,
  };
}

/**
 * Единые утилиты работы с датами и временем (реэкспорт для полной обратной совместимости)
 */
export * from './dateTime';

/**
 * Регулярное выражение для обнаружения потенциально опасных префиксов формул (Formula Injection / CWE-1236).
 * Проверяет наличие =, +, -, @, |, % или управляющих символов (\t, \r) в начале строки,
 * включая случаи с предшествующими пробелами, табуляциями, переносами строк или неразрывными пробелами.
 */
export const FORMULA_PREFIX_REGEX = /^[\s\u00A0]*[=+\-@\t\r%|]/;

/**
 * Проверяет, является ли строка потенциальной формулой, способной исполниться в Excel/Calc.
 */
export function isFormulaInjection(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  // Начинается с управляющего символа \t или \r
  if (value.startsWith('\t') || value.startsWith('\r')) return true;
  // Обрезаем любые ведущие пробельные символы (пробелы, табы, переносы строк, неразрывные пробелы)
  const trimmed = value.replace(/^[\s\u00A0]+/, '');
  if (trimmed.length === 0) return false;
  // Проверяем первый значащий символ
  const firstChar = trimmed[0];
  return (
    firstChar === '=' ||
    firstChar === '+' ||
    firstChar === '-' ||
    firstChar === '@' ||
    firstChar === '|' ||
    firstChar === '%'
  );
}

/**
 * Нейтрализует Formula Injection для значения ячейки CSV/XLSX.
 * Добавляет ведущий апостроф `'`, если строка может быть интерпретирована как формула.
 * Не мутирует исходные данные (чистая функция).
 */
export function escapeFormulaInjection(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (isFormulaInjection(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Восстанавливает исходный текст ячейки при импорте (убирает защитный ведущий апостроф,
 * если он был добавлен исключительно для нейтрализации Formula Injection).
 */
export function unescapeFormulaInjection(value: string): string {
  if (typeof value !== 'string' || value.length === 0) return '';
  if (value.startsWith("'") && isFormulaInjection(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

/**
 * Форматирует и экранирует отдельную ячейку CSV согласно RFC 4180 и защите от инъекций формул.
 * 1. Нейтрализует Formula Injection (добавляя ведущий апостроф к строкам с опасными префиксами).
 * 2. Экранирует внутренние двойные кавычки (" -> "").
 * 3. Оборачивает ячейку в кавычки при наличии разделителя, кавычек, переносов строк или защитного апострофа.
 */
export function formatCsvCell(value: unknown, delimiter = ';'): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Числа форматируем с запятой вместо точки для русской локали
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return String(value).replace('.', ',');
  }

  const str = String(value);
  if (str.length === 0) {
    return '';
  }

  // Нейтрализация Formula Injection
  const safeStr = escapeFormulaInjection(str);

  // Проверяем, требуется ли обрамление кавычками:
  // - если строка содержит разделитель (; или ,)
  // - если строка содержит кавычки (")
  // - если строка содержит перенос строки (\n или \r)
  // - если строка начинается с защитного апострофа (')
  const needsQuotes =
    safeStr.includes(delimiter) ||
    safeStr.includes('"') ||
    safeStr.includes('\n') ||
    safeStr.includes('\r') ||
    safeStr.startsWith("'");

  const escaped = safeStr.replace(/"/g, '""');

  return needsQuotes ? `"${escaped}"` : escaped;
}

/**
 * Экспорт записей в CSV с защитой от Formula Injection (CWE-1236 / SEC-03)
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

  const headerRow = headers.map((h) => formatCsvCell(h)).join(';');

  const rows = entries.map((e) => {
    const evalStatus = evaluateGlucose(e.glucose);
    return [
      formatCsvCell(e.date),
      formatCsvCell(e.time),
      formatCsvCell(e.glucose !== null && e.glucose !== undefined ? e.glucose.toString().replace('.', ',') : ''),
      formatCsvCell(evalStatus ? evalStatus.shortLabel : ''),
      formatCsvCell(e.carbs !== null && e.carbs !== undefined ? e.carbs.toString() : ''),
      formatCsvCell(e.xe !== null && e.xe !== undefined ? e.xe.toString().replace('.', ',') : ''),
      formatCsvCell(e.rinFast !== null && e.rinFast !== undefined ? e.rinFast.toString() : ''),
      formatCsvCell(e.tresiba !== null && e.tresiba !== undefined ? e.tresiba.toString() : ''),
      formatCsvCell(e.calories !== null && e.calories !== undefined ? e.calories.toString() : ''),
      formatCsvCell(e.notes || ''),
    ].join(';');
  });

  // Добавляем UTF-8 BOM (\uFEFF) для корректного открытия русских символов в Excel без искажения кодировки
  return '\uFEFF' + [headerRow, ...rows].join('\r\n');
}

/**
 * Умная дедупликация записей дневника диабета.
 * Находит записи с одинаковым ID или с одинаковым временем события (date + time),
 * объединяет клинические данные (глюкоза, инсулины, ХЕ, заметки) без потери информации
 * и удаляет полные дубликаты.
 */
export function deduplicateEntries(entries: DiaryEntry[]): DiaryEntry[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const idMap = new Map<string, DiaryEntry>();
  const dateTimeMap = new Map<string, DiaryEntry>();

  for (const entry of entries) {
    if (!entry || !entry.date || !entry.time) continue;

    // 1. Проверяем по ID
    if (entry.id && idMap.has(entry.id)) {
      const existing = idMap.get(entry.id)!;
      mergeEntryData(existing, entry);
      continue;
    }

    // 2. Проверяем по date + time
    const dtKey = `${entry.date} ${entry.time}`;
    if (dateTimeMap.has(dtKey)) {
      const existing = dateTimeMap.get(dtKey)!;
      // Если у записей совпадает сахар (или у одной он null) — это дубликат одного клинического события
      if (
        existing.glucose === null ||
        entry.glucose === null ||
        Math.abs((existing.glucose ?? 0) - (entry.glucose ?? 0)) < 0.05
      ) {
        mergeEntryData(existing, entry);
        if (entry.id) idMap.set(entry.id, existing);
        continue;
      }
    }

    // Новая уникальная запись
    const copy = { ...entry };
    if (entry.id) idMap.set(entry.id, copy);
    dateTimeMap.set(dtKey, copy);
  }

  // Сортировка: по дате убыванию, по времени возрастанию
  return Array.from(dateTimeMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.time.localeCompare(b.time);
  });
}

function mergeEntryData(target: DiaryEntry, source: DiaryEntry) {
  if (target.glucose == null && source.glucose != null) target.glucose = source.glucose;
  if (target.carbs == null && source.carbs != null) target.carbs = source.carbs;
  if (target.xe == null && source.xe != null) target.xe = source.xe;
  if (target.rinFast == null && source.rinFast != null) target.rinFast = source.rinFast;
  if (target.tresiba == null && source.tresiba != null) target.tresiba = source.tresiba;
  if (target.calories == null && source.calories != null) target.calories = source.calories;
  if ((!target.notes || target.notes.trim() === '') && source.notes) target.notes = source.notes;
  if ((!target.tag || target.tag === 'other') && source.tag && source.tag !== 'other') target.tag = source.tag;
  if (!target.createdAt && source.createdAt) target.createdAt = source.createdAt;
}
