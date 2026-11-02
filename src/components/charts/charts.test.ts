import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiaryEntry, UserSettings } from '../../types/diabetes';
import { calculateMonthlyStats } from '../../utils/diabetes';
import {
  calculateAvailableMonths,
  MonthlyCharts,
} from '../MonthlyCharts';
import {
  MonthlySummaryCards,
  TirDetailedCard,
  TimeOfDayDistribution,
  calculateTimeOfDayStats,
  DailyInsulinBarChart,
  calculateDailyInsulinData,
  GlucoseSvgChart,
  getSvgCoordinates,
  CHART_DIMENSIONS,
} from './index';

function createEntry(partial: Partial<DiaryEntry> & { id: string; date: string; time: string }): DiaryEntry {
  return {
    glucose: null,
    carbs: null,
    xe: null,
    rinFast: null,
    tresiba: null,
    calories: null,
    notes: '',
    createdAt: Date.now(),
    ...partial,
  };
}

test('1. calculateAvailableMonths: корректный сбор, дедупликация и сортировка месяцев', () => {
  const emptyMonths = calculateAvailableMonths([], '2026-05');
  assert.deepEqual(emptyMonths, ['2026-05'], 'Пустой список возвращает fallback месяц');

  const entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-03-15', time: '08:00', glucose: 5.5 }),
    createEntry({ id: '2', date: '2026-01-10', time: '12:00', glucose: 6.0 }),
    createEntry({ id: '3', date: '2026-03-20', time: '18:00', glucose: 7.2 }),
    createEntry({ id: '4', date: '2025-12-31', time: '22:00', glucose: 4.8 }),
  ];

  const months = calculateAvailableMonths(entries, '2026-04');
  assert.ok(months.includes('2026-04'), 'Содержит текущий/fallback месяц');
  assert.ok(months.includes('2026-03'), 'Содержит месяц 2026-03');
  assert.ok(months.includes('2026-01'), 'Содержит месяц 2026-01');
  assert.ok(months.includes('2025-12'), 'Содержит месяц 2025-12');

  // Проверка сортировки по убыванию
  for (let i = 0; i < months.length - 1; i++) {
    assert.ok(months[i].localeCompare(months[i + 1]) >= 0, 'Месяцы отсортированы по убыванию');
  }
});

test('2. calculateTimeOfDayStats: распределение замеров по 4 периодам суток', () => {
  const entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-04-01', time: '07:30', glucose: 5.0 }), // Утро (06:00 - 12:00)
    createEntry({ id: '2', date: '2026-04-01', time: '11:59', glucose: 7.0 }), // Утро
    createEntry({ id: '3', date: '2026-04-01', time: '13:00', glucose: 6.5 }), // День (12:00 - 18:00)
    createEntry({ id: '4', date: '2026-04-01', time: '19:15', glucose: 8.0 }), // Вечер (18:00 - 23:00)
    createEntry({ id: '5', date: '2026-04-01', time: '23:30', glucose: 4.5 }), // Ночь (23:00 - 06:00)
    createEntry({ id: '6', date: '2026-04-01', time: '03:00', glucose: 5.5 }), // Ночь
    createEntry({ id: '7', date: '2026-04-01', time: '10:00', glucose: null }), // Без сахара — пропуск
    createEntry({ id: '8', date: '2026-04-01', time: 'invalid', glucose: 9.0 }), // Невалидное время — fallback 12:00 (День)
  ];

  const stats = calculateTimeOfDayStats(entries);
  assert.equal(stats.length, 4);

  const morning = stats.find((s) => s.label === 'Утро');
  assert.ok(morning);
  assert.equal(morning.count, 2);
  assert.equal(morning.avg, 6.0);

  const day = stats.find((s) => s.label === 'День');
  assert.ok(day);
  assert.equal(day.count, 2); // 6.5 + 9.0 (fallback)
  assert.equal(day.avg, 7.8);

  const evening = stats.find((s) => s.label === 'Вечер');
  assert.ok(evening);
  assert.equal(evening.count, 1);
  assert.equal(evening.avg, 8.0);

  const night = stats.find((s) => s.label === 'Ночь');
  assert.ok(night);
  assert.equal(night.count, 2);
  assert.equal(night.avg, 5.0);
});

test('3. calculateDailyInsulinData: группировка и расчет суточных доз болюса и базала', () => {
  const entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-04-01', time: '08:00', rinFast: 4, tresiba: 0, carbs: 40 }),
    createEntry({ id: '2', date: '2026-04-01', time: '13:00', rinFast: 6, tresiba: 0, carbs: 60 }),
    createEntry({ id: '3', date: '2026-04-01', time: '22:00', rinFast: 0, tresiba: 14, carbs: 0 }),
    createEntry({ id: '4', date: '2026-04-02', time: '09:00', rinFast: 5, tresiba: 0, carbs: 50 }),
    createEntry({ id: '5', date: '2026-04-02', time: '22:00', rinFast: 0, tresiba: 14, carbs: 0 }),
    createEntry({ id: '6', date: '2026-05-01', time: '08:00', rinFast: 10, tresiba: 10, carbs: 30 }), // Другой месяц
  ];

  const aprilData = calculateDailyInsulinData(entries, '2026-04');
  assert.equal(aprilData.length, 2);
  assert.equal(aprilData[0].date, '2026-04-01');
  assert.equal(aprilData[0].rinFast, 10);
  assert.equal(aprilData[0].tresiba, 14);
  assert.equal(aprilData[0].carbs, 100);

  assert.equal(aprilData[1].date, '2026-04-02');
  assert.equal(aprilData[1].rinFast, 5);
  assert.equal(aprilData[1].tresiba, 14);
  assert.equal(aprilData[1].carbs, 50);

  const mayData = calculateDailyInsulinData(entries, '2026-05');
  assert.equal(mayData.length, 1);
  assert.equal(mayData[0].date, '2026-05-01');

  const emptyData = calculateDailyInsulinData(entries, '2026-06');
  assert.equal(emptyData.length, 0);
});

test('4. getSvgCoordinates: проекция значений, ограничение экстремальных сахаров и координатные оси', () => {
  const dims = CHART_DIMENSIONS;
  const innerWidth = dims.chartWidth - dims.padding.left - dims.padding.right;
  const innerHeight = dims.chartHeight - dims.padding.top - dims.padding.bottom;

  // Экстремальный гипо (< 2.0) зажимается на minGlucoseY (2.0)
  const lowClamp = getSvgCoordinates(1.0, '2026-04-01', '12:00');
  const minExpectedY = dims.padding.top + innerHeight;
  assert.equal(lowClamp.y, minExpectedY);

  // Экстремальный гипер (> 18.0) зажимается на maxGlucoseY (18.0)
  const highClamp = getSvgCoordinates(30.0, '2026-04-01', '12:00');
  const maxExpectedY = dims.padding.top;
  assert.equal(highClamp.y, maxExpectedY);

  // Центр шкалы (10.0 при min=2.0, max=18.0)
  const midPoint = getSvgCoordinates(10.0, '2026-04-01', '12:00');
  assert.equal(midPoint.y, dims.padding.top + innerHeight / 2);

  // Ось X: день 1, 00:00 -> padding.left
  const startMonth = getSvgCoordinates(5.5, '2026-04-01', '00:00');
  assert.equal(startMonth.x, dims.padding.left);

  // Ось X: день 31, 24:00 -> padding.left + innerWidth
  const endMonth = getSvgCoordinates(5.5, '2026-04-31', '24:00');
  assert.equal(Math.round(endMonth.x), Math.round(dims.padding.left + innerWidth));
});

test('5. Рендеринг компонентов: корректная обработка пустых данных, единичного замера и кастомных настроек', () => {
  const customSettings: UserSettings = {
    patientName: 'Тестовый пациент',
    diabetesType: '1',
    targetLow: 4.2,
    targetHigh: 8.5,
    hypoThreshold: 3.5,
    severeHyperThreshold: 11.0,
    bolusName: 'НовоРапид',
    basalName: 'Лантус',
    xeRatio: 12,
  };

  // Пустая статистика
  const emptyStats = calculateMonthlyStats([], '2026-04', customSettings);

  const emptySummaryHtml = renderToStaticMarkup(
    React.createElement(MonthlySummaryCards, {
      stats: emptyStats,
      targetLow: 4.2,
      targetHigh: 8.5,
      bolusName: 'НовоРапид',
      basalName: 'Лантус',
    })
  );
  assert.ok(emptySummaryHtml.includes('—'), 'Показывает прочерк для средней глюкозы при пустых данных');
  assert.ok(emptySummaryHtml.includes('НовоРапид'), 'Использует переданное имя болюса');
  assert.ok(emptySummaryHtml.includes('Лантус'), 'Использует переданное имя базала');

  // Пустой SVG график
  const emptySvgHtml = renderToStaticMarkup(
    React.createElement(GlucoseSvgChart, {
      monthEntries: [],
      settings: customSettings,
    })
  );
  assert.ok(emptySvgHtml.includes('В выбранном месяце нет измерений сахара'));

  // Единичный замер сахара
  const singleEntry = createEntry({
    id: 'single-1',
    date: '2026-04-15',
    time: '14:30',
    glucose: 6.2,
    rinFast: 3,
    carbs: 36,
    xe: 3.0,
    notes: 'Перекус',
  });

  const singleSvgHtml = renderToStaticMarkup(
    React.createElement(GlucoseSvgChart, {
      monthEntries: [singleEntry],
      settings: customSettings,
      bolusName: 'НовоРапид',
      basalName: 'Лантус',
    })
  );
  assert.ok(!singleSvgHtml.includes('В выбранном месяце нет измерений сахара'));
  assert.ok(singleSvgHtml.includes('<circle'), 'Рендерит SVG точку замера');
  assert.ok(singleSvgHtml.includes('d="M '), 'Рендерит путь тренда');

  // Детализация TIR
  const tirHtml = renderToStaticMarkup(
    React.createElement(TirDetailedCard, {
      tir: {
        lowCount: 1,
        lowPercent: 10,
        normalCount: 7,
        normalPercent: 70,
        highCount: 2,
        highPercent: 20,
        veryHighCount: 0,
        veryHighPercent: 0,
      },
      totalEntries: 10,
      targetLow: 4.2,
      targetHigh: 8.5,
    })
  );
  assert.ok(tirHtml.includes('70%'), 'Отображает TIR в процентах');
  assert.ok(tirHtml.includes('4.2 – 8.5'), 'Отображает целевой диапазон');

  // Распределение по времени суток
  const todHtml = renderToStaticMarkup(
    React.createElement(TimeOfDayDistribution, {
      monthEntries: [singleEntry],
      settings: customSettings,
      basalName: 'Лантус',
    })
  );
  assert.ok(todHtml.includes('Утро'));
  assert.ok(todHtml.includes('День'));
  assert.ok(todHtml.includes('Вечер'));
  assert.ok(todHtml.includes('Ночь'));
  assert.ok(todHtml.includes('6.2 ммоль/л'));

  // Суточный график инсулинов
  const insulinBarHtml = renderToStaticMarkup(
    React.createElement(DailyInsulinBarChart, {
      entries: [singleEntry],
      selectedMonth: '2026-04',
      bolusName: 'НовоРапид',
      basalName: 'Лантус',
    })
  );
  assert.ok(insulinBarHtml.includes('НовоРапид: 3 ед'));

  // Интеграционный рендеринг MonthlyCharts
  const fullChartsHtml = renderToStaticMarkup(
    React.createElement(MonthlyCharts, {
      entries: [singleEntry],
      bolusName: 'НовоРапид',
      basalName: 'Лантус',
      settings: customSettings,
    })
  );
  assert.ok(fullChartsHtml.includes('Аналитика:'), 'Заголовок аналитики отрендерен');
  assert.ok(fullChartsHtml.includes('НовоРапид'), 'Имя болюса передано компонентам');
  assert.ok(fullChartsHtml.includes('Лантус'), 'Имя базала передано компонентам');
});
