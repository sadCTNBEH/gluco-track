export type GlucoseStatus = 'low' | 'normal' | 'high' | 'very_high';

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  glucose: number | null; // ммоль/л
  carbs: number | null; // граммы углеводов
  xe: number | null; // Хлебные Единицы (углеводы / 12)
  rinFast: number | null; // Единицы короткого инсулина РинФаст
  tresiba: number | null; // Единицы длинного инсулина Тресиба
  calories: number | null; // ккал
  notes: string; // Еда / нагрузка / комментарий
  tag?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'bedtime' | 'night' | 'correction' | 'fasting' | 'other';
  createdAt: number;
}

export interface DaySummary {
  date: string;
  entriesCount: number;
  avgGlucose: number | null;
  totalRinFast: number;
  totalTresiba: number;
  totalCarbs: number;
  totalXE: number;
  totalCalories: number;
  minGlucose: number | null;
  maxGlucose: number | null;
}

export interface UserSettings {
  patientName: string;
  diabetesType: '1' | '2' | 'MODY' | 'LADA' | 'gestational';
  xeRatio: number; // сколько грамм углеводов в 1 ХЕ (по умолчанию 12)
  targetLow: number; // 4.0
  targetHigh: number; // 9.9
  hypoThreshold: number; // 3.9
  severeHyperThreshold: number; // 13.9
  bolusName?: string; // название болюсного инсулина (по умолчанию 'РинФаст')
  basalName?: string; // название базального инсулина (по умолчанию 'Тресиба')
  doctorName?: string;
  doctorNotes?: string;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  totalEntries: number;
  avgGlucose: number | null;
  estimatedHbA1c: number | null;
  tir: {
    lowCount: number;
    lowPercent: number; // < 3.9
    normalCount: number;
    normalPercent: number; // 4.0 - 9.9
    highCount: number;
    highPercent: number; // 10.0 - 13.9
    veryHighCount: number;
    veryHighPercent: number; // > 13.9
  };
  totalRinFast: number;
  avgDailyRinFast: number;
  totalTresiba: number;
  avgDailyTresiba: number;
  totalCarbs: number;
  avgDailyCarbs: number;
  totalCalories: number;
  avgDailyCalories: number;
  activeDaysCount: number;
  fullDaysCount?: number; // количество дней, где заполнены утро, день, вечер и ночь
}
