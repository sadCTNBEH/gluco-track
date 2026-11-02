import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiaryEntry, UserSettings, DiaryTag } from '../types/diabetes';
import { DEFAULT_SETTINGS, groupEntriesByDay } from '../utils/diabetes';
import {
  DIARY_TAGS,
  CONTEXT_TAGS,
  getDiaryTagConfig,
  getDiaryTagLabel,
} from './diaryTags';
import { DiaryTable } from '../components/DiaryTable';
import { MobileCardView } from '../components/MobileCardView';

function createEntry(partial: Partial<DiaryEntry> & { id: string; date: string; time: string }): DiaryEntry {
  return {
    glucose: 5.5,
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

test('1. DIARY_TAGS: полнота справочника, корректность названий, стилей и функций хелперов', () => {
  const expectedTags: DiaryTag[] = [
    'fasting',
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'bedtime',
    'correction',
    'night',
    'other',
  ];

  for (const tag of expectedTags) {
    const config = DIARY_TAGS[tag];
    assert.ok(config, `Тег ${tag} должен присутствовать в DIARY_TAGS`);
    assert.equal(config.id, tag);
    assert.ok(config.label.length > 0, `Тег ${tag} должен иметь непустое название`);
    assert.ok(config.className.length > 0, `Тег ${tag} должен иметь CSS классы`);
  }

  // Проверка русских названий
  assert.equal(DIARY_TAGS.fasting.label, 'Натощак');
  assert.equal(DIARY_TAGS.breakfast.label, 'Завтрак');
  assert.equal(DIARY_TAGS.lunch.label, 'Обед');
  assert.equal(DIARY_TAGS.dinner.label, 'Ужин');
  assert.equal(DIARY_TAGS.snack.label, 'Перекус');
  assert.equal(DIARY_TAGS.bedtime.label, 'На ночь');
  assert.equal(DIARY_TAGS.correction.label, 'Коррекция (ДПС)');
  assert.equal(DIARY_TAGS.other.label, 'Другое');

  // getDiaryTagConfig: возвращает null для 'other', пустых или невалидных
  assert.equal(getDiaryTagConfig('other'), null);
  assert.equal(getDiaryTagConfig(null), null);
  assert.equal(getDiaryTagConfig(undefined), null);
  assert.equal(getDiaryTagConfig('invalid_tag'), null);
  assert.equal(getDiaryTagConfig('breakfast')?.label, 'Завтрак');

  // getDiaryTagLabel: локализованные подписи для экспорта
  assert.equal(getDiaryTagLabel('fasting'), 'Натощак');
  assert.equal(getDiaryTagLabel('correction'), 'Коррекция (ДПС)');
  assert.equal(getDiaryTagLabel('other'), 'Другое');
  assert.equal(getDiaryTagLabel(null), '');
  assert.equal(getDiaryTagLabel('custom'), 'custom');

  // CONTEXT_TAGS: список для модального окна содержит ровно 8 контекстов
  assert.equal(CONTEXT_TAGS.length, 8);
  assert.deepEqual(
    CONTEXT_TAGS.map((t) => t.id),
    ['fasting', 'breakfast', 'lunch', 'dinner', 'snack', 'bedtime', 'correction', 'other']
  );
});

test('2. DiaryTable: корректный рендеринг всех тегов и стилей в табличном представлении', () => {
  const entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-04-01', time: '07:30', tag: 'fasting' }),
    createEntry({ id: '2', date: '2026-04-01', time: '08:00', tag: 'breakfast' }),
    createEntry({ id: '3', date: '2026-04-01', time: '13:00', tag: 'lunch' }),
    createEntry({ id: '4', date: '2026-04-01', time: '19:00', tag: 'dinner' }),
    createEntry({ id: '5', date: '2026-04-01', time: '16:00', tag: 'snack' }),
    createEntry({ id: '6', date: '2026-04-01', time: '22:00', tag: 'bedtime' }),
    createEntry({ id: '7', date: '2026-04-01', time: '15:00', tag: 'correction' }),
    createEntry({ id: '8', date: '2026-04-01', time: '12:00', tag: 'other' }),
    createEntry({ id: '9', date: '2026-04-01', time: '11:00' }), // без тега
  ];

  const html = renderToStaticMarkup(
    React.createElement(DiaryTable, {
      entries,
      onAddClick: () => {},
      onEditClick: () => {},
      onDeleteClick: () => {},
      settings: DEFAULT_SETTINGS,
    })
  );

  // Проверка наличия бейджей тегов в HTML
  assert.ok(html.includes('Натощак'));
  assert.ok(html.includes('Завтрак'));
  assert.ok(html.includes('Обед'));
  assert.ok(html.includes('Ужин'));
  assert.ok(html.includes('Перекус'));
  assert.ok(html.includes('На ночь'));
  assert.ok(html.includes('Коррекция (ДПС)'));

  // Тег 'other' не должен отображаться как плашка
  assert.ok(!html.includes('font-sans font-medium w-fit bg-slate-100 dark:bg-slate-800 text-slate-600'));
});

test('3. MobileCardView: корректный рендеринг тегов в мобильных карточках', () => {
  const entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-04-01', time: '08:00', tag: 'breakfast' }),
    createEntry({ id: '2', date: '2026-04-01', time: '13:00', tag: 'lunch' }),
    createEntry({ id: '3', date: '2026-04-01', time: '22:00', tag: 'bedtime' }),
  ];

  const html = renderToStaticMarkup(
    React.createElement(MobileCardView, {
      entries,
      onAddClick: () => {},
      onEditClick: () => {},
      onDeleteClick: () => {},
      settings: DEFAULT_SETTINGS,
    })
  );

  assert.ok(html.includes('Завтрак'));
  assert.ok(html.includes('Обед'));
  assert.ok(html.includes('На ночь'));
});

test('4. groupEntriesByDay: корректная группировка по датам и сортировка по времени', () => {
  const entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-04-02', time: '13:00', glucose: 6.5 }),
    createEntry({ id: '2', date: '2026-04-01', time: '20:00', glucose: 7.0 }),
    createEntry({ id: '3', date: '2026-04-02', time: '08:00', glucose: 5.0 }),
    createEntry({ id: '4', date: '2026-04-01', time: '09:00', glucose: 5.2 }),
  ];

  const grouped = groupEntriesByDay(entries);

  // Сортировка дней по убыванию
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].date, '2026-04-02');
  assert.equal(grouped[1].date, '2026-04-01');

  // Сортировка записей внутри дня по возрастанию времени
  assert.equal(grouped[0].entries[0].time, '08:00');
  assert.equal(grouped[0].entries[1].time, '13:00');
  assert.equal(grouped[1].entries[0].time, '09:00');
  assert.equal(grouped[1].entries[1].time, '20:00');

  // Расчет агрегатов дня
  assert.equal(grouped[0].summary.entriesCount, 2);
  assert.equal(grouped[0].summary.avgGlucose, 5.8);
});

test('5. Обновление записей и отсутствие устаревших данных при мемоизации', () => {
  let entries: DiaryEntry[] = [
    createEntry({ id: '1', date: '2026-04-01', time: '08:00', glucose: 5.0, tag: 'breakfast' }),
  ];

  const initialGrouped = groupEntriesByDay(entries);
  assert.equal(initialGrouped.length, 1);
  assert.equal(initialGrouped[0].entries[0].glucose, 5.0);

  // Добавление новой записи
  entries = [
    ...entries,
    createEntry({ id: '2', date: '2026-04-01', time: '13:00', glucose: 7.2, tag: 'lunch' }),
  ];
  const updatedGrouped = groupEntriesByDay(entries);
  assert.equal(updatedGrouped[0].entries.length, 2);
  assert.equal(updatedGrouped[0].summary.avgGlucose, 6.1);

  // Редактирование записи
  entries = entries.map((e) => (e.id === '1' ? { ...e, glucose: 5.4, tag: 'fasting' } : e));
  const editedGrouped = groupEntriesByDay(entries);
  assert.equal(editedGrouped[0].entries[0].glucose, 5.4);
  assert.equal(editedGrouped[0].entries[0].tag, 'fasting');

  // Удаление записи
  entries = entries.filter((e) => e.id !== '2');
  const deletedGrouped = groupEntriesByDay(entries);
  assert.equal(deletedGrouped[0].entries.length, 1);
  assert.equal(deletedGrouped[0].entries[0].id, '1');
});
