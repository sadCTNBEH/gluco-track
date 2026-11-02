import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDateISO,
  formatTimeISO,
  formatMonthISO,
  getTodayDateString,
  getCurrentTimeString,
  getCurrentMonthString,
  getDateDaysAgo,
  isValidDateString,
  isValidTimeString,
  isValidMonthString,
  formatDateRussian,
  formatMonthYearRussian,
} from './dateTime';

test('formatDateISO: корректное форматирование объекта Date в локальное YYYY-MM-DD', () => {
  const d1 = new Date(2026, 10, 2); // 2 ноября 2026 (month index 10)
  assert.equal(formatDateISO(d1), '2026-11-02');

  const d2 = new Date(2026, 0, 5); // 5 января 2026 (двузначное выравнивание с 0)
  assert.equal(formatDateISO(d2), '2026-01-05');

  // Проверка времени около полуночи (00:00:01 и 23:59:59)
  const midnight = new Date(2026, 4, 15, 0, 0, 1);
  assert.equal(formatDateISO(midnight), '2026-05-15');

  const endOfDay = new Date(2026, 4, 15, 23, 59, 59);
  assert.equal(formatDateISO(endOfDay), '2026-05-15');
});

test('formatTimeISO: корректное форматирование объекта Date в локальное HH:mm', () => {
  const t1 = new Date(2026, 10, 2, 8, 5);
  assert.equal(formatTimeISO(t1), '08:05');

  const t2 = new Date(2026, 10, 2, 0, 0);
  assert.equal(formatTimeISO(t2), '00:00');

  const t3 = new Date(2026, 10, 2, 23, 59);
  assert.equal(formatTimeISO(t3), '23:59');

  const t4 = new Date(2026, 10, 2, 14, 30);
  assert.equal(formatTimeISO(t4), '14:30');
});

test('formatMonthISO: корректное форматирование объекта Date в локальное YYYY-MM', () => {
  const m1 = new Date(2026, 2, 15); // Март 2026
  assert.equal(formatMonthISO(m1), '2026-03');

  const m2 = new Date(2026, 11, 31); // Декабрь 2026
  assert.equal(formatMonthISO(m2), '2026-12');
});

test('getTodayDateString, getCurrentTimeString, getCurrentMonthString: валидность форматов', () => {
  const today = getTodayDateString();
  assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(isValidDateString(today), true);

  const time = getCurrentTimeString();
  assert.match(time, /^([01]\d|2[0-3]):([0-5]\d)$/);
  assert.equal(isValidTimeString(time), true);

  const month = getCurrentMonthString();
  assert.match(month, /^\d{4}-\d{2}$/);
  assert.equal(isValidMonthString(month), true);
});

test('getDateDaysAgo: корректный расчет со сдвигом через границы месяцев и високосные годы', () => {
  // Сдвиг внутри месяца
  const base1 = new Date(2026, 10, 15); // 15 ноября 2026
  assert.equal(getDateDaysAgo(7, base1), '2026-11-08');

  // Сдвиг через границу месяца (ноябрь -> октябрь, в октябре 31 день)
  assert.equal(getDateDaysAgo(16, base1), '2026-10-30');

  // Високосный год 2024: от 1 марта отнять 1 день -> 29 февраля
  const leapBase = new Date(2024, 2, 1); // 1 марта 2024
  assert.equal(getDateDaysAgo(1, leapBase), '2024-02-29');

  // Невисокосный год 2026: от 1 марта отнять 1 день -> 28 февраля
  const nonLeapBase = new Date(2026, 2, 1); // 1 марта 2026
  assert.equal(getDateDaysAgo(1, nonLeapBase), '2026-02-28');

  // Сдвиг через границу года: от 3 января отнять 5 дней -> 29 декабря предыдущего года
  const newYearBase = new Date(2026, 0, 3); // 3 января 2026
  assert.equal(getDateDaysAgo(5, newYearBase), '2025-12-29');
});

test('isValidDateString: строгая проверка календарных дат и високосных годов', () => {
  // Валидные даты
  assert.equal(isValidDateString('2026-11-02'), true);
  assert.equal(isValidDateString('2024-02-29'), true, '2024 год високосный (кратно 4)');
  assert.equal(isValidDateString('2000-02-29'), true, '2000 год високосный (кратно 400)');
  assert.equal(isValidDateString('2026-02-28'), true);
  assert.equal(isValidDateString('2026-04-30'), true);
  assert.equal(isValidDateString('2026-05-31'), true);

  // Невисокосные года
  assert.equal(isValidDateString('2026-02-29'), false, '2026 невисокосный');
  assert.equal(isValidDateString('2023-02-29'), false, '2023 невисокосный');
  assert.equal(isValidDateString('1900-02-29'), false, '1900 невисокосный (кратно 100, но не 400)');

  // Несуществующие дни месяцев
  assert.equal(isValidDateString('2026-02-30'), false);
  assert.equal(isValidDateString('2026-02-31'), false);
  assert.equal(isValidDateString('2026-04-31'), false, 'В апреле только 30 дней');
  assert.equal(isValidDateString('2026-06-31'), false, 'В июне только 30 дней');
  assert.equal(isValidDateString('2026-09-31'), false, 'В сентябре только 30 дней');
  assert.equal(isValidDateString('2026-11-31'), false, 'В ноябре только 30 дней');

  // Недопустимые месяцы и дни
  assert.equal(isValidDateString('2026-00-10'), false, 'Месяц 0');
  assert.equal(isValidDateString('2026-13-01'), false, 'Месяц 13');
  assert.equal(isValidDateString('2026-05-00'), false, 'День 0');
  assert.equal(isValidDateString('2026-05-32'), false, 'День 32');

  // Невалидные типы и форматы
  assert.equal(isValidDateString(''), false);
  assert.equal(isValidDateString('2026/11/02'), false);
  assert.equal(isValidDateString('02.11.2026'), false);
  assert.equal(isValidDateString('2026-1-2'), false);
  assert.equal(isValidDateString(null), false);
  assert.equal(isValidDateString(undefined), false);
  assert.equal(isValidDateString(12345), false);
});

test('isValidTimeString: строгая валидация времени 24-часового формата', () => {
  // Валидное время
  assert.equal(isValidTimeString('00:00'), true);
  assert.equal(isValidTimeString('12:30'), true);
  assert.equal(isValidTimeString('23:59'), true);
  assert.equal(isValidTimeString('08:05'), true);

  // Невалидное время
  assert.equal(isValidTimeString('24:00'), false, 'Час 24 недопустим');
  assert.equal(isValidTimeString('25:00'), false);
  assert.equal(isValidTimeString('12:60'), false, 'Минуты 60 недопустимы');
  assert.equal(isValidTimeString('8:05'), false, 'Отсутствует ведущий ноль');
  assert.equal(isValidTimeString('12:5'), false);
  assert.equal(isValidTimeString('12:00:00'), false, 'Секунды не поддерживаются');
  assert.equal(isValidTimeString(''), false);
  assert.equal(isValidTimeString('abc'), false);
  assert.equal(isValidTimeString(null), false);
  assert.equal(isValidTimeString(undefined), false);
});

test('isValidMonthString: строгая валидация месяца YYYY-MM', () => {
  assert.equal(isValidMonthString('2026-11'), true);
  assert.equal(isValidMonthString('2024-02'), true);
  assert.equal(isValidMonthString('1990-01'), true);

  assert.equal(isValidMonthString('2026-00'), false);
  assert.equal(isValidMonthString('2026-13'), false);
  assert.equal(isValidMonthString('2026-1'), false);
  assert.equal(isValidMonthString('1899-12'), false);
  assert.equal(isValidMonthString(''), false);
  assert.equal(isValidMonthString(null), false);
});

test('formatDateRussian и formatMonthYearRussian: локализация на русский язык', () => {
  // Понедельник, 2 ноября 2026
  assert.equal(formatDateRussian('2026-11-02'), '2 ноябрь 2026 (Пн)');
  assert.equal(formatDateRussian('2026-11-02', false), '2 ноябрь (Пн)');

  // Воскресенье, 1 ноября 2026
  assert.equal(formatDateRussian('2026-11-01'), '1 ноябрь 2026 (Вс)');

  // Невалидная дата не падает и возвращает исходную строку
  assert.equal(formatDateRussian(''), '');
  assert.equal(formatDateRussian('invalid-date'), 'invalid-date');

  // Форматирование месяца
  assert.equal(formatMonthYearRussian('2026-11'), 'Ноябрь 2026 г.');
  assert.equal(formatMonthYearRussian('2024-05'), 'Май 2024 г.');
  assert.equal(formatMonthYearRussian(''), '');
});

test('Timezone Resilience: устранение багов toISOString().slice при положительных часовых поясах', () => {
  // В часовом поясе UTC+5 (Ташкент/Екатеринбург) или UTC+3 (Москва) время 01:30 ночи 2 ноября
  // при toISOString() превращается в 20:30 1 ноября по UTC!
  // Проверяем, что formatDateISO сохраняет именно локальную дату пользователя.
  const localEarlyMorning = new Date(2026, 10, 2, 1, 30, 0); // 2 ноября 01:30
  assert.equal(formatDateISO(localEarlyMorning), '2026-11-02');
  assert.equal(formatTimeISO(localEarlyMorning), '01:30');

  // Аналогично для отрицательных часовых поясов (UTC-5 New York) в 23:30 вечера 2 ноября:
  // toISOString() превращается в 04:30 3 ноября по UTC!
  const localLateNight = new Date(2026, 10, 2, 23, 30, 0); // 2 ноября 23:30
  assert.equal(formatDateISO(localLateNight), '2026-11-02');
  assert.equal(formatTimeISO(localLateNight), '23:30');
});
