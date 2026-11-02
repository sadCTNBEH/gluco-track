import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateGlucose,
  calculateXE,
  calculateDayAggregates,
  calculateMonthlyStats,
  groupEntriesByDay,
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
