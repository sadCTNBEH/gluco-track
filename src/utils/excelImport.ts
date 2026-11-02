import { DiaryEntry } from '../types/diabetes';
import { calculateXE, unescapeFormulaInjection, isValidDateString, formatDateISO, formatTimeISO } from './diabetes';

// Кэш промиса динамического импорта библиотеки read-excel-file (избегает повторной загрузки)
let readXlsxModulePromise: Promise<typeof import('read-excel-file/browser')> | null = null;

/**
 * Получение функции readXlsxFile через динамический import().
 * При сетевой ошибке сбрасывает кэш для возможности повторной попытки.
 */
export async function getReadXlsxFile() {
  if (!readXlsxModulePromise) {
    readXlsxModulePromise = import('read-excel-file/browser').catch((err) => {
      readXlsxModulePromise = null;
      throw err;
    });
  }
  const mod = await readXlsxModulePromise;
  return mod.default;
}

export type ExcelCellValue = string | number | boolean | Date | null | undefined;
export type ExcelRow = ExcelCellValue[];

export interface ExcelImportResult {
  entries: DiaryEntry[];
  totalParsed: number;
  skippedCount: number;
  errors: string[];
}

interface SheetWithData {
  data?: ExcelRow[];
}

function isSheetWithData(row: unknown): row is SheetWithData {
  return typeof row === 'object' && row !== null && 'data' in row;
}

function isExcelRow(row: unknown): row is ExcelRow {
  return Array.isArray(row);
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
 * Парсер CSV с поддержкой кавычек и автоопределением разделителя (, или ; или \t)
 */
export function parseCsvText(text: string): string[][] {
  // Убираем BOM, если есть
  const cleanText = text.replace(/^\uFEFF/, '');
  if (!cleanText.trim()) return [];

  // Определяем разделитель по первым строкам
  const sample = cleanText.slice(0, 2000);
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount >= commaCount && semiCount >= tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText[i];
    const next = cleanText[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        currentField += '"';
        i++; // пропускаем экранированную кавычку
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++; // пропускаем \r\n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += c;
    }
  }

  // Финальное поле/строка
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Преобразование значения ячейки даты в валидную строку YYYY-MM-DD
 * Проверяет реальность календарной даты (исключает 31 февраля, 31 апреля и т.д.)
 */
export function parseDateCell(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  // Если это объект Date (read-excel-file парсит даты в Date)
  if (val instanceof Date && !isNaN(val.getTime())) {
    const candidate = formatDateISO(val);
    return isValidDateString(candidate) ? candidate : null;
  }

  // Если это числовое значение даты Excel (дни с 01.01.1900)
  if (typeof val === 'number' && val > 20000 && val < 60000) {
    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(dateObj.getTime())) {
      const candidate = formatDateISO(dateObj);
      return isValidDateString(candidate) ? candidate : null;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return isValidDateString(str) ? str : null;
  }

  // DD.MM.YYYY или DD/MM/YYYY
  const ruMatch = str.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (ruMatch) {
    const d = ruMatch[1].padStart(2, '0');
    const m = ruMatch[2].padStart(2, '0');
    const y = ruMatch[3];
    const candidate = `${y}-${m}-${d}`;
    return isValidDateString(candidate) ? candidate : null;
  }

  // YYYY/MM/DD
  const isoSlash = str.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})/);
  if (isoSlash) {
    const y = isoSlash[1];
    const m = isoSlash[2].padStart(2, '0');
    const d = isoSlash[3].padStart(2, '0');
    const candidate = `${y}-${m}-${d}`;
    return isValidDateString(candidate) ? candidate : null;
  }

  return null;
}

/**
 * Преобразование значения ячейки времени в строку HH:mm (24-часовой формат)
 */
export function parseTimeCell(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatTimeISO(val);
  }

  // Если время в Excel задано дробью дня (0.0 .. 1.0)
  if (typeof val === 'number' && val >= 0 && val < 1) {
    const totalMinutes = Math.round(val * 24 * 60) % (24 * 60);
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  const str = String(val).trim();
  if (!str) return null;

  // Ищем любое время формата HH:mm или H:mm (даже если есть префикс "После 04:00" или "04:00:00")
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hh = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Парсинг числового значения (поддерживает запятые, пробелы, спецсимволы)
 */
export function parseNumberCell(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : Number(val.toFixed(2));
  }
  const clean = String(val)
    .replace(/\u00A0/g, ' ')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!clean || clean === '-' || clean === '.') return null;
  const num = parseFloat(clean);
  return isNaN(num) ? null : Number(num.toFixed(2));
}

/**
 * Парсинг числового значения с проверкой допустимых физиологических границ.
 * Исключает отрицательные числа, NaN, Infinity и абсурдные выбросы.
 */
export function parseBoundedMetric(
  val: unknown,
  min: number,
  max: number
): number | null {
  const num = parseNumberCell(val);
  if (num === null) return null;
  if (num < min || num > max) return null;
  return num;
}

/**
 * Парсинг файла Excel (.xlsx, .xls) или CSV (.csv) и преобразование в список записей DiaryEntry
 */
export async function parseExcelDiary(file: File, xeRatio = 12): Promise<ExcelImportResult> {
  const errors: string[] = [];
  const entries: DiaryEntry[] = [];
  let rows: ExcelRow[] = [];

  const fileNameLower = file.name.toLowerCase();
  const isCsv = fileNameLower.endsWith('.csv') || file.type.includes('csv');

  try {
    if (isCsv) {
      const text = await file.text();
      rows = parseCsvText(text);
    } else {
      const readXlsxFile = await getReadXlsxFile();
      const result: unknown = await readXlsxFile(file);
      if (Array.isArray(result) && result.length > 0 && isSheetWithData(result[0])) {
        rows = (result[0].data || []).filter(isExcelRow);
      } else if (Array.isArray(result)) {
        rows = result.filter(isExcelRow);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err || 'Неверный формат файла');
    throw new Error(`Не удалось прочитать файл: ${message}`);
  }

  if (!rows || rows.length === 0) {
    return { entries: [], totalParsed: 0, skippedCount: 0, errors: ['Файл пуст или не содержит данных'] };
  }

  // Поиск строки заголовков (сканируем первые 25 строк)
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

  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let curDateCol = -1;
    let curTimeCol = -1;
    let curGlucoseCol = -1;
    let curCarbsCol = -1;
    let curXeCol = -1;
    let curRinFastCol = -1;
    let curTresibaCol = -1;
    let curCalCol = -1;
    let curNotesCol = -1;

    for (let c = 0; c < row.length; c++) {
      const rawH = String(row[c] || '');
      const h = normalizeHeader(rawH);
      if (!h) continue;

      // ВАЖНО: Игнорируем сводные столбцы дня (например: "Ср. сахар за день", "Сумма ХЕ за день", "РинФаст за день", "Замеров за день")!
      if (
        h.includes('задень') ||
        h.includes('сумма') ||
        h.includes('средн') ||
        h.includes('срсахар') ||
        h.includes('итого') ||
        h.includes('всего') ||
        h.includes('замеров')
      ) {
        continue;
      }

      // 1. Дата
      if (curDateCol === -1 && (h.includes('дата') || h.includes('date') || h === 'день')) {
        curDateCol = c;
      }
      // 2. Время
      else if (curTimeCol === -1 && (h.includes('время') || h.includes('time') || h === 'час')) {
        curTimeCol = c;
      }
      // 3. Глюкоза / Сахар (только отдельного замера)
      else if (
        curGlucoseCol === -1 &&
        (h.includes('глюкоз') || h.includes('сахар') || h.includes('glucose') || h === 'ск')
      ) {
        curGlucoseCol = c;
      }
      // 4. Углеводы
      else if (curCarbsCol === -1 && (h.includes('углевод') || h.includes('carbs') || h === 'угл')) {
        curCarbsCol = c;
      }
      // 5. ХЕ
      else if (curXeCol === -1 && (h.includes('хе') || h.includes('хлебн'))) {
        curXeCol = c;
      }
      // 6. РинФаст / Короткий инсулин
      else if (
        curRinFastCol === -1 &&
        (h.includes('ринфаст') ||
          h.includes('rinfast') ||
          h.includes('коротк') ||
          h.includes('болюс') ||
          h.includes('аспарт'))
      ) {
        curRinFastCol = c;
      }
      // 7. Тресиба / Длинный инсулин
      else if (
        curTresibaCol === -1 &&
        (h.includes('тресиба') ||
          h.includes('tresiba') ||
          h.includes('длинн') ||
          h.includes('базал') ||
          h.includes('деглудек'))
      ) {
        curTresibaCol = c;
      }
      // 8. Калории
      else if (curCalCol === -1 && (h.includes('калори') || h.includes('ккал') || h.includes('calor'))) {
        curCalCol = c;
      }
      // 9. Заметки / Еда / Комментарий
      else if (
        curNotesCol === -1 &&
        (h.includes('еда') ||
          h.includes('заметк') ||
          h.includes('коммент') ||
          h.includes('примеч') ||
          h.includes('описан') ||
          h.includes('notes'))
      ) {
        curNotesCol = c;
      }
    }

    const hasMedicalCol =
      curTimeCol !== -1 ||
      curGlucoseCol !== -1 ||
      curNotesCol !== -1 ||
      curRinFastCol !== -1 ||
      curCarbsCol !== -1 ||
      curXeCol !== -1 ||
      curTresibaCol !== -1 ||
      curCalCol !== -1;

    // Если в строке найдена дата И хотя бы один другой значимый столбец
    if (curDateCol !== -1 && hasMedicalCol) {
      headerIndex = r;
      dateCol = curDateCol;
      timeCol = curTimeCol;
      glucoseCol = curGlucoseCol;
      carbsCol = curCarbsCol;
      xeCol = curXeCol;
      rinFastCol = curRinFastCol;
      tresibaCol = curTresibaCol;
      calCol = curCalCol;
      notesCol = curNotesCol;
      break;
    }
  }

  let startRowIndex = 0;

  // Если заголовки не найдены по тексту, проверяем строгое соответствие известному формату без заголовков
  if (headerIndex === -1) {
    // Отбираем непустые строки для анализа структуры
    const candidateRows = rows
      .filter((r) => Array.isArray(r) && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''))
      .slice(0, 5);

    // Известный формат дневника без заголовков:
    // 1. Должна быть хотя бы одна строка данных.
    // 2. В первой колонке (col 0) обязательно валидная дата во всех строках-кандидатах.
    // 3. Во второй колонке (col 1) валидное время во всех строках-кандидатах.
    // 4. Как минимум в одной строке присутствует валидный клинический показатель
    //    (col 2: глюкоза 0.1-50, col 6/7: инсулин 0-300, col 4: углеводы 0-1500).
    const isStrictHeaderless =
      candidateRows.length > 0 &&
      candidateRows.every((r) => parseDateCell(r[0]) !== null) &&
      candidateRows.every((r) => parseTimeCell(r[1]) !== null) &&
      candidateRows.some((r) => {
        const g = parseBoundedMetric(r[2], 0.1, 50.0);
        const rf = parseBoundedMetric(r[6], 0, 300);
        const tr = parseBoundedMetric(r[7], 0, 300);
        const cb = parseBoundedMetric(r[4], 0, 1500);
        return g !== null || rf !== null || tr !== null || cb !== null;
      });

    if (!isStrictHeaderless) {
      return {
        entries: [],
        totalParsed: 0,
        skippedCount: 0,
        errors: [
          'Не удалось распознать формат файла. Файл должен содержать строку заголовков (Дата, Время, Глюкоза, Инсулин, ХЕ, Заметки) или соответствовать известному формату дневника самоконтроля.',
        ],
      };
    }

    startRowIndex = 0;
    dateCol = 0;
    timeCol = 1;
    glucoseCol = 2;
    carbsCol = 4;
    xeCol = 5;
    rinFastCol = 6;
    tresibaCol = 7;
    notesCol = 8;
    calCol = 13 < (rows[0]?.length || 0) ? 13 : 9;
  } else {
    startRowIndex = headerIndex + 1;
  }

  let skippedCount = 0;

  for (let r = startRowIndex; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rawDate = dateCol >= 0 ? row[dateCol] : null;
    const parsedDate = parseDateCell(rawDate);

    // Если дата не распознана — пропускаем (заголовок, пустая строка, итоги)
    if (!parsedDate) {
      skippedCount++;
      continue;
    }

    const rawTime = timeCol >= 0 ? row[timeCol] : null;
    const parsedTime = parseTimeCell(rawTime) || '12:00';

    const glucose = glucoseCol >= 0 ? parseBoundedMetric(row[glucoseCol], 0.1, 50.0) : null;
    const carbs = carbsCol >= 0 ? parseBoundedMetric(row[carbsCol], 0, 1500) : null;
    let xe = xeCol >= 0 ? parseBoundedMetric(row[xeCol], 0, 120) : null;

    // Если ХЕ не указано, но есть граммы углеводов — рассчитываем
    if (xe === null && carbs !== null) {
      const calculated = calculateXE(carbs, xeRatio);
      if (calculated !== null && calculated >= 0 && calculated <= 120) {
        xe = calculated;
      }
    }

    const rinFast = rinFastCol >= 0 ? parseBoundedMetric(row[rinFastCol], 0, 300) : null;
    const tresiba = tresibaCol >= 0 ? parseBoundedMetric(row[tresibaCol], 0, 300) : null;
    const calories = calCol >= 0 ? parseBoundedMetric(row[calCol], 0, 20000) : null;
    const rawNotes =
      notesCol >= 0 && row[notesCol] !== null && row[notesCol] !== undefined ? String(row[notesCol]).trim() : '';
    const notes = unescapeFormulaInjection(rawNotes).slice(0, 2000);

    // Если строка полностью пустая (нет ни сахара, ни еды, ни инсулина, ни калорий, ни заметок) — пропускаем
    if (
      glucose === null &&
      carbs === null &&
      xe === null &&
      rinFast === null &&
      tresiba === null &&
      calories === null &&
      !notes
    ) {
      skippedCount++;
      continue;
    }

    // Умное определение тега по заметке или времени
    let tag: DiaryEntry['tag'] = 'other';
    const notesLower = notes.toLowerCase();

    if (notesLower.includes('завтрак')) tag = 'breakfast';
    else if (notesLower.includes('обед')) tag = 'lunch';
    else if (notesLower.includes('ужин')) tag = 'dinner';
    else if (notesLower.includes('сон') || notesLower.includes('перед сном')) tag = 'bedtime';
    else if (notesLower.includes('коррекц') || notesLower.includes('дпс')) tag = 'correction';
    else if (notesLower.includes('перекус')) tag = 'snack';
    else {
      const hour = parseInt(parsedTime.split(':')[0], 10);
      if (hour >= 6 && hour < 11) tag = 'breakfast';
      else if (hour >= 11 && hour < 16) tag = 'lunch';
      else if (hour >= 16 && hour < 21) tag = 'dinner';
      else if (hour >= 21 && hour < 24) tag = 'bedtime';
      else tag = 'night';
    }

    entries.push({
      id: crypto.randomUUID(), // Криптографически стойкий уникальный идентификатор (SEC-11)
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

  if (entries.length === 0 && errors.length === 0) {
    errors.push('В файле не найдено корректных записей дневника с допустимыми значениями.');
  }

  return {
    entries,
    totalParsed: entries.length,
    skippedCount,
    errors,
  };
}
