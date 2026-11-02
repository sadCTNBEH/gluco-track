import { z } from 'zod';
import { validateNewPassword } from './auth.js';

export const MAX_IMPORT_ENTRIES = 2000;
export const MAX_NOTES_LENGTH = 2000;

// Регулярные выражения для даты YYYY-MM-DD и времени HH:mm
export const DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
export const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Проверка реальной календарной даты YYYY-MM-DD (исключает 30 февраля, 31 ноября и т.д.)
 */
export function isValidDateString(val) {
  if (typeof val !== 'string' || !DATE_REGEX.test(val)) return false;
  const [yearStr, monthStr, dayStr] = val.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (year < 1900 || year > 2100) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * Валидатор физиологических числовых показателей.
 * Запрещает NaN, Infinity, отрицательные значения (где недопустимы).
 */
const numericMetric = (min, max, label) =>
  z
    .number({ invalid_type_error: `Показатель "${label}" должен быть числом` })
    .finite(`Показатель "${label}" должен быть конечным числом (не Infinity)`)
    .min(min, `Показатель "${label}" не может быть меньше ${min}`)
    .max(max, `Показатель "${label}" не может превышать ${max}`)
    .nullable()
    .optional();

/**
 * Схема записи дневника (Entry)
 */
export const entrySchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Идентификатор не может быть пустым')
    .max(128, 'Идентификатор не может превышать 128 символов')
    .regex(ID_REGEX, 'Недопустимый формат идентификатора записи (допускаются только буквы, цифры, дефис и подчеркивание)')
    .optional(),
  date: z
    .string({ required_error: 'Поле date обязательно' })
    .refine(isValidDateString, 'Неверная дата (ожидается существующая календарная дата формата YYYY-MM-DD)'),
  time: z
    .string({ required_error: 'Поле time обязательно' })
    .regex(TIME_REGEX, 'Неверный формат времени (ожидается HH:mm в 24-часовом формате)'),
  glucose: numericMetric(0.1, 50.0, 'глюкоза'),
  carbs: numericMetric(0, 1500, 'углеводы (г)'),
  xe: numericMetric(0, 120, 'ХЕ'),
  rinFast: numericMetric(0, 300, 'болюсный инсулин'),
  tresiba: numericMetric(0, 300, 'базальный инсулин'),
  calories: numericMetric(0, 20000, 'калории (ккал)'),
  notes: z
    .string()
    .max(MAX_NOTES_LENGTH, `Заметка не может превышать ${MAX_NOTES_LENGTH} символов`)
    .optional()
    .default(''),
  tag: z
    .enum(['breakfast', 'lunch', 'dinner', 'snack', 'bedtime', 'night', 'correction', 'fasting', 'other'], {
      invalid_type_error: 'Недопустимый тег контекста записи',
    })
    .optional()
    .default('other'),
  createdAt: z.number().int().finite().min(0).max(4102444800000).optional(),
});

/**
 * Схема пакета импорта записей (Import)
 */
export const importEntriesSchema = z.object({
  entries: z
    .array(entrySchema, { required_error: 'Поле entries обязательно', invalid_type_error: 'Ожидается массив entries' })
    .min(1, 'Массив entries не может быть пустым')
    .max(MAX_IMPORT_ENTRIES, `Пакет импорта не может превышать ${MAX_IMPORT_ENTRIES} записей за один запрос`),
  replaceAll: z.boolean().optional().default(false),
});

/**
 * Схема настроек пользователя (Settings) с клинической валидацией взаимосвязей порогов
 */
export const settingsSchema = z
  .object({
    patientName: z
      .string()
      .max(100, 'ФИО пациента не может превышать 100 символов')
      .transform((v) => v.trim() || 'Пациент')
      .default('Пациент'),
    diabetesType: z
      .enum(['1', '2', 'MODY', 'LADA', 'gestational'], {
        invalid_type_error: 'Недопустимый тип сахарного диабета',
      })
      .default('1'),
    xeRatio: z
      .number({ invalid_type_error: 'Коэффициент ХЕ должен быть числом' })
      .finite('Коэффициент ХЕ должен быть конечным числом')
      .min(5, 'Коэффициент ХЕ должен быть не менее 5 грамм')
      .max(30, 'Коэффициент ХЕ не может превышать 30 грамм')
      .default(12),
    hypoThreshold: z
      .number({ invalid_type_error: 'Порог гипогликемии должен быть числом' })
      .finite()
      .min(2.0, 'Порог гипогликемии не может быть ниже 2.0 ммоль/л')
      .max(8.0, 'Порог гипогликемии не может быть выше 8.0 ммоль/л')
      .default(3.9),
    targetLow: z
      .number({ invalid_type_error: 'Нижняя граница нормы должна быть числом' })
      .finite()
      .min(2.5, 'Нижняя граница нормы не может быть ниже 2.5 ммоль/л')
      .max(12.0, 'Нижняя граница нормы не может быть выше 12.0 ммоль/л')
      .default(4.0),
    targetHigh: z
      .number({ invalid_type_error: 'Верхняя граница нормы должна быть числом' })
      .finite()
      .min(5.0, 'Верхняя граница нормы не может быть ниже 5.0 ммоль/л')
      .max(20.0, 'Верхняя граница нормы не может быть выше 20.0 ммоль/л')
      .default(9.9),
    severeHyperThreshold: z
      .number({ invalid_type_error: 'Порог выраженной гипергликемии должен быть числом' })
      .finite()
      .min(8.0, 'Порог выраженной гипергликемии не может быть ниже 8.0 ммоль/л')
      .max(35.0, 'Порог выраженной гипергликемии не может быть выше 35.0 ммоль/л')
      .default(13.9),
    bolusName: z.string().max(50, 'Название болюсного инсулина не может превышать 50 символов').optional().default('РинФаст'),
    basalName: z.string().max(50, 'Название базального инсулина не может превышать 50 символов').optional().default('Тресиба'),
    eHbA1c: z.number().finite().min(3.0, 'eHbA1c не может быть ниже 3.0%').max(20.0, 'eHbA1c не может превышать 20.0%').nullable().optional(),
    acr: z.number().finite().min(0, 'ACR не может быть отрицательным').max(100.0, 'ACR не может превышать 100 мг/ммоль').nullable().optional(),
    doctorName: z.string().max(100, 'ФИО врача не может превышать 100 символов').optional().default(''),
    doctorNotes: z.string().max(2000, 'Заметки врача не могут превышать 2000 символов').optional().default(''),
  })
  .refine((data) => data.hypoThreshold <= data.targetLow, {
    message: 'Порог гипогликемии не может быть выше нижней границы целевого диапазона',
    path: ['hypoThreshold'],
  })
  .refine((data) => data.targetLow < data.targetHigh, {
    message: 'Нижняя граница целевого диапазона должна быть строго меньше верхней границы',
    path: ['targetLow'],
  })
  .refine((data) => data.targetHigh <= data.severeHyperThreshold, {
    message: 'Верхняя граница нормы не может превышать порог выраженной гипергликемии',
    path: ['severeHyperThreshold'],
  });

/**
 * Схема регистрации пользователя (Register)
 */
export const registerSchema = z
  .object({
    username: z
      .string({ required_error: 'Логин обязателен' })
      .trim()
      .min(3, 'Логин должен содержать не менее 3 символов')
      .max(50, 'Логин не может превышать 50 символов')
      .regex(/^[a-zA-Z0-9_.-]+$/, 'Логин может содержать только латинские буквы, цифры, дефис, точку и подчеркивание'),
    password: z
      .string({ required_error: 'Пароль обязателен' })
      .min(12, 'Пароль должен содержать не менее 12 символов')
      .max(128, 'Пароль не должен превышать 128 символов'),
    patientName: z.string().max(100, 'ФИО пациента не может превышать 100 символов').optional().default(''),
  })
  .superRefine((data, ctx) => {
    const errorMsg = validateNewPassword(data.password, data.username);
    if (errorMsg) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: errorMsg,
        path: ['password'],
      });
    }
  });

/**
 * Middleware для валидации тела запроса
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const message = firstIssue?.message || 'Ошибка валидации входящих данных';
      return res.status(400).json({
        error: message,
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
