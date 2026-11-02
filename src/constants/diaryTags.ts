import { DiaryTag } from '../types/diabetes';

export interface DiaryTagConfig {
  id: DiaryTag;
  label: string;
  className: string;
}

/**
 * Единый справочник тегов дневника самоконтроля.
 * Содержит идентификаторы, русские названия, цвета и стили оформления.
 * Классы Tailwind записаны явно в виде статических строк для корректного Tree Shaking / PurgeCSS.
 */
export const DIARY_TAGS: Record<DiaryTag, DiaryTagConfig> = {
  fasting: {
    id: 'fasting',
    label: 'Натощак',
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
  },
  breakfast: {
    id: 'breakfast',
    label: 'Завтрак',
    className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  },
  lunch: {
    id: 'lunch',
    label: 'Обед',
    className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  },
  dinner: {
    id: 'dinner',
    label: 'Ужин',
    className: 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
  },
  snack: {
    id: 'snack',
    label: 'Перекус',
    className: 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
  },
  bedtime: {
    id: 'bedtime',
    label: 'На ночь',
    className: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
  },
  correction: {
    id: 'correction',
    label: 'Коррекция (ДПС)',
    className: 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
  },
  night: {
    id: 'night',
    label: 'Ночь',
    className: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
  },
  other: {
    id: 'other',
    label: 'Другое',
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  },
};

/**
 * Упорядоченный список тегов контекста для селектора модального окна добавления/редактирования
 */
export const CONTEXT_TAGS: readonly { id: DiaryTag; label: string }[] = [
  { id: 'fasting', label: 'Натощак' },
  { id: 'breakfast', label: 'Завтрак' },
  { id: 'lunch', label: 'Обед' },
  { id: 'dinner', label: 'Ужин' },
  { id: 'snack', label: 'Перекус' },
  { id: 'bedtime', label: 'На ночь' },
  { id: 'correction', label: 'Коррекция (ДПС)' },
  { id: 'other', label: 'Другое' },
] as const;

/**
 * Type guard для проверки, является ли строка валидным идентификатором DiaryTag
 */
export function isDiaryTag(tag: string): tag is DiaryTag {
  return Object.prototype.hasOwnProperty.call(DIARY_TAGS, tag);
}

/**
 * Возвращает конфигурацию тега или null для 'other' и неизвестных тегов (для отображения бейджа в таблицах)
 */
export function getDiaryTagConfig(tag?: string | null): DiaryTagConfig | null {
  if (!tag || tag === 'other' || !isDiaryTag(tag)) return null;
  return DIARY_TAGS[tag] || null;
}

/**
 * Возвращает локализованное название тега для экспорта и отчетов
 */
export function getDiaryTagLabel(tag?: string | null): string {
  if (!tag) return '';
  if (isDiaryTag(tag)) {
    return DIARY_TAGS[tag].label;
  }
  return tag;
}
