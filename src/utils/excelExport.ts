import writeXlsxFile, { SheetData, Row, Cell } from 'write-excel-file/browser';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { evaluateGlucose } from './diabetes';

const TAG_TRANSLATIONS: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
  fasting: 'Натощак',
  bedtime: 'На ночь',
  correction: 'ДПС (коррекция)',
  other: 'Другое',
};

export async function exportEntriesToXLSX(
  entries: DiaryEntry[],
  settings?: UserSettings,
  fileName?: string
): Promise<void> {
  const sorted = [...entries].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    if (cmp !== 0) return cmp;
    return (a.time || '').localeCompare(b.time || '');
  });

  const headerRow: Row = [
    { value: 'Дата', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Время', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Глюкоза (ммоль/л)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Оценка', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Углеводы (г)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'ХЕ', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'РинФаст (ед)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Тресиба (ед)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Калории (ккал)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Контекст', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Примечания / Еда', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
  ];

  const numCell = (val: number | null | undefined): Cell =>
    val !== null && val !== undefined && !isNaN(val) ? { type: Number, value: val } : null;

  const strCell = (val: string | null | undefined): Cell =>
    val ? { type: String, value: val } : null;

  const dataRows: Row[] = sorted.map((entry) => {
    const evalResult = evaluateGlucose(entry.glucose);
    return [
      strCell(entry.date),
      strCell(entry.time),
      numCell(entry.glucose),
      strCell(evalResult?.shortLabel),
      numCell(entry.carbs),
      numCell(entry.xe),
      numCell(entry.rinFast),
      numCell(entry.tresiba),
      numCell(entry.calories),
      strCell(entry.tag ? TAG_TRANSLATIONS[entry.tag] || entry.tag : ''),
      strCell(entry.notes),
    ];
  });

  const sheetData: SheetData = [headerRow, ...dataRows];

  const targetFileName =
    fileName ||
    `Дневник_диабета_${settings?.patientName?.replace(/\s+/g, '_') || 'пациент'}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  await writeXlsxFile(sheetData, {
    columns: [
      { width: 14 }, // Дата
      { width: 10 }, // Время
      { width: 18 }, // Глюкоза
      { width: 16 }, // Оценка
      { width: 14 }, // Углеводы
      { width: 10 }, // ХЕ
      { width: 14 }, // РинФаст
      { width: 14 }, // Тресиба
      { width: 14 }, // Калории
      { width: 16 }, // Контекст
      { width: 35 }, // Примечания
    ],
  }).toFile(targetFileName);
}
