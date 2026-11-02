import readXlsxFile from 'read-excel-file/browser';
import { DiaryEntry } from '../types/diabetes';
import { calculateXE } from './diabetes';

export interface ExcelImportResult {
  entries: DiaryEntry[];
  totalParsed: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Нормализация названия столбца (нижний регистр, без пробелов и знаков препинания)
 */
function normalizeHeader(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .trim()
    .replace(/[\s\r\n\t_()\/\\.,\-–—]/g, '');
}

/**
 * Преобразование значения ячейки даты в строку YYYY-MM-DD
 */
function parseDateCell(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  // Если это объект Date (read-excel-file парсит даты в Date)
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const str = String(val).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // DD.MM.YYYY или DD/MM/YYYY
  const ruMatch = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (ruMatch) {
    const d = ruMatch[1].padStart(2, '0');
    const m = ruMatch[2].padStart(2, '0');
    const y = ruMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Попытка стандартного парсинга
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Преобразование значения ячейки времени в строку HH:mm
 */
function parseTimeCell(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    const hh = String(val.getHours()).padStart(2, '0');
    const min = String(val.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  }

  const str = String(val).trim();

  // HH:mm или HH:mm:ss
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    const hh = timeMatch[1].padStart(2, '0');
    const mm = timeMatch[2];
    return `${hh}:${mm}`;
  }

  return null;
}

/**
 * Парсинг числового значения (поддерживает запятые)
 */
function parseNumberCell(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : Number(val.toFixed(2));
  }
  const clean = String(val).replace(',', '.').replace(/[^0-9.-]/g, '').trim();
  if (!clean) return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : Number(num.toFixed(2));
}

/**
 * Парсинг файла Excel (.xlsx) и преобразование в список записей DiaryEntry
 */
export async function parseExcelDiary(file: File, xeRatio = 12): Promise<ExcelImportResult> {
  const errors: string[] = [];
  const entries: DiaryEntry[] = [];

  let rows: any[][] = [];
  try {
    const result = await readXlsxFile(file);
    if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && result[0] !== null && 'data' in result[0]) {
      rows = ((result as any)[0].data || []) as any[][];
    } else if (Array.isArray(result)) {
      rows = result as unknown as any[][];
    }
  } catch (err: any) {
    throw new Error(`Не удалось прочитать файл Excel: ${err?.message || 'Неверный формат .xlsx'}`);
  }

  if (!rows || rows.length === 0) {
    return { entries: [], totalParsed: 0, skippedCount: 0, errors: ['Файл пуст или лист не содержит данных'] };
  }

  // Поиск строки заголовков
  let headerIndex = -1;
  let dateCol = -1;
  let timeCol = -1;
  let glucoseCol = -1;
  let carbsCol = -1;
  let xeCol = -1;
  let rinFastCol = -1;
  let tresibaCol = -1;
  let calCol = -1;
  let notesCol = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const h = normalizeHeader(row[c]);
      if (h.includes('дата') || h.includes('date') || h === 'день') dateCol = c;
      else if (h.includes('время') || h.includes('time') || h === 'час') timeCol = c;
      else if (h.includes('глюкоз') || h.includes('сахар') || h.includes('glucose') || h === 'ск') glucoseCol = c;
      else if (h.includes('углевод') || h.includes('carbs') || h === 'угл') carbsCol = c;
      else if (h.includes('хе') || h.includes('хлебн')) xeCol = c;
      else if (h.includes('ринфаст') || h.includes('rinfast') || h.includes('коротк') || h.includes('болюс') || h.includes('аспарт')) rinFastCol = c;
      else if (h.includes('тресиба') || h.includes('tresiba') || h.includes('длинн') || h.includes('базал') || h.includes('деглудек')) tresibaCol = c;
      else if (h.includes('калори') || h.includes('ккал') || h.includes('calor')) calCol = c;
      else if (h.includes('еда') || h.includes('заметк') || h.includes('коммент') || h.includes('примеч') || h.includes('описан') || h.includes('notes')) notesCol = c;
    }

    // Если нашли хотя бы дату или время или сахар
    if (dateCol !== -1 && (timeCol !== -1 || glucoseCol !== -1)) {
      headerIndex = r;
      break;
    }
  }

  // Если заголовки не опознаны по именам, используем позиционный стандарт:
  // 0: Дата, 1: Время, 2: Глюкоза, 3: Оценка (пропуск), 4: Углеводы, 5: ХЕ, 6: РинФаст, 7: Тресиба, 8: Калории, 9: Заметки
  if (headerIndex === -1) {
    headerIndex = 0; // Считаем первую строку заголовком
    dateCol = 0;
    timeCol = 1;
    glucoseCol = 2;
    carbsCol = 4;
    xeCol = 5;
    rinFastCol = 6;
    tresibaCol = 7;
    calCol = 8;
    notesCol = 9;
  }

  let skippedCount = 0;

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawDate = dateCol >= 0 ? row[dateCol] : null;
    const parsedDate = parseDateCell(rawDate);

    // Если дата не спарсилась — пропускаем строку (пустая строка или итоги)
    if (!parsedDate) {
      skippedCount++;
      continue;
    }

    const rawTime = timeCol >= 0 ? row[timeCol] : null;
    const parsedTime = parseTimeCell(rawTime) || '12:00';

    const glucose = glucoseCol >= 0 ? parseNumberCell(row[glucoseCol]) : null;
    const carbs = carbsCol >= 0 ? parseNumberCell(row[carbsCol]) : null;
    let xe = xeCol >= 0 ? parseNumberCell(row[xeCol]) : null;

    // Если ХЕ не указано, но есть углеводы — вычисляем автоматически
    if (xe === null && carbs !== null) {
      xe = calculateXE(carbs, xeRatio);
    }

    const rinFast = rinFastCol >= 0 ? parseNumberCell(row[rinFastCol]) : null;
    const tresiba = tresibaCol >= 0 ? parseNumberCell(row[tresibaCol]) : null;
    const calories = calCol >= 0 ? parseNumberCell(row[calCol]) : null;
    const notes = notesCol >= 0 && row[notesCol] !== null && row[notesCol] !== undefined ? String(row[notesCol]).trim() : '';

    // Определяем тег по времени
    let tag: DiaryEntry['tag'] = 'other';
    const hour = parseInt(parsedTime.split(':')[0], 10);
    if (hour >= 6 && hour < 11) tag = 'breakfast';
    else if (hour >= 11 && hour < 16) tag = 'lunch';
    else if (hour >= 16 && hour < 21) tag = 'dinner';
    else if (hour >= 21 && hour < 24) tag = 'bedtime';
    else tag = 'night';

    entries.push({
      id: `xlsx-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
      date: parsedDate,
      time: parsedTime,
      glucose,
      carbs,
      xe,
      rinFast,
      tresiba,
      calories,
      notes,
      tag,
      createdAt: Date.now() - r * 1000,
    });
  }

  return {
    entries,
    totalParsed: entries.length,
    skippedCount,
    errors,
  };
}
