/**
 * Единый модуль работы с датами и временем в GlucoTrack Pro.
 * Все операции форматирования производятся строго в локальном времени пользователя,
 * что предотвращает баги смещения дат при конвертации через UTC / toISOString().
 */

export const RUSSIAN_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const;

export const RUSSIAN_MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
] as const;

export const RUSSIAN_WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;

export const RUSSIAN_WEEKDAYS_FULL = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота',
] as const;

/**
 * Форматирует объект Date в строковый формат YYYY-MM-DD в локальном часовом поясе.
 */
export function formatDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Форматирует объект Date в строковый формат HH:mm (24-часовой) в локальном часовом поясе.
 */
export function formatTimeISO(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Форматирует объект Date в строковый формат YYYY-MM в локальном часовом поясе.
 */
export function formatMonthISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Возвращает текущую локальную дату в формате YYYY-MM-DD.
 */
export function getTodayDateString(): string {
  return formatDateISO(new Date());
}

/**
 * Возвращает текущее локальное время в формате HH:mm.
 */
export function getCurrentTimeString(): string {
  return formatTimeISO(new Date());
}

/**
 * Возвращает текущий локальный месяц в формате YYYY-MM.
 */
export function getCurrentMonthString(): string {
  return formatMonthISO(new Date());
}

/**
 * Вычисляет дату, отстоящую на days дней в прошлое от fromDate, в локальном времени.
 */
export function getDateDaysAgo(days: number, fromDate: Date = new Date()): string {
  const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() - days);
  return formatDateISO(d);
}

/**
 * Строгая валидация формата времени HH:mm (24-часовой, от 00:00 до 23:59).
 */
export function isValidTimeString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(val);
}

/**
 * Строгая валидация формата месяца YYYY-MM (год 1900..2100, месяц 01..12).
 */
export function isValidMonthString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const match = val.match(/^(\d{4})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  return year >= 1900 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Проверка реальной календарной даты YYYY-MM-DD (с учетом високосных годов и дней в месяцах).
 */
export function isValidDateString(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

/**
 * Форматирует дату YYYY-MM-DD на русском языке: "2 ноября 2026 (пн)"
 */
export function formatDateRussian(dateStr: string, includeYear: boolean = true): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d || !isValidDateString(dateStr)) return dateStr;
  // Создаем объект даты в середине дня (12:00), чтобы исключить смещения при DST
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  const weekday = RUSSIAN_WEEKDAYS[dateObj.getDay()];
  const monthName = RUSSIAN_MONTHS[m - 1].toLowerCase();
  return `${d} ${monthName}${includeYear ? ` ${y}` : ''} (${weekday})`;
}

/**
 * Форматирует месяц YYYY-MM на русском языке: "Ноябрь 2026 г."
 */
export function formatMonthYearRussian(monthStr: string): string {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return monthStr;
  return `${RUSSIAN_MONTHS[m - 1]} ${y} г.`;
}
