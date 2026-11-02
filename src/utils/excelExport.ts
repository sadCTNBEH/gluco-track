import type { SheetData, Row, Cell } from 'write-excel-file/browser';
import { DiaryEntry, UserSettings } from '../types/diabetes';
import { evaluateGlucose, escapeFormulaInjection, getTodayDateString } from './diabetes';
import { getDiaryTagLabel } from '../constants/diaryTags';

// Кэш промиса динамического импорта библиотеки write-excel-file (избегает повторной загрузки)
let writeXlsxModulePromise: Promise<typeof import('write-excel-file/browser')> | null = null;

/**
 * Получение функции writeXlsxFile через динамический import().
 * При сетевой ошибке сбрасывает кэш для возможности повторной попытки.
 */
export async function getWriteXlsxFile() {
  if (!writeXlsxModulePromise) {
    writeXlsxModulePromise = import('write-excel-file/browser').catch((err) => {
      writeXlsxModulePromise = null;
      throw err;
    });
  }
  const mod = await writeXlsxModulePromise;
  return mod.default;
}

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

  const bolusName = settings?.bolusName || 'РинФаст';
  const basalName = settings?.basalName || 'Тресиба';

  const headerRow: Row = [
    { value: 'Дата', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Время', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Глюкоза (ммоль/л)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Оценка', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Углеводы (г)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'ХЕ', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: `${bolusName} (ед)`, fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: `${basalName} (ед)`, fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Калории (ккал)', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Контекст', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
    { value: 'Примечания / Еда', fontWeight: 'bold', backgroundColor: '#e2e8f0' },
  ];

  const numCell = (val: number | null | undefined): Cell =>
    val !== null && val !== undefined && !isNaN(val) ? { type: Number, value: val } : null;

  const strCell = (val: string | null | undefined): Cell =>
    val ? { type: String, value: escapeFormulaInjection(val) } : null;

  const dataRows: Row[] = sorted.map((entry) => {
    const evalResult = evaluateGlucose(entry.glucose, settings);
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
      strCell(getDiaryTagLabel(entry.tag)),
      strCell(entry.notes),
    ];
  });

  const sheetData: SheetData = [headerRow, ...dataRows];

  const targetFileName =
    fileName ||
    `Дневник_диабета_${settings?.patientName?.replace(/\s+/g, '_') || 'пациент'}_${getTodayDateString()}.xlsx`;

  const writeXlsx = await getWriteXlsxFile();
  await writeXlsx(sheetData, {
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
