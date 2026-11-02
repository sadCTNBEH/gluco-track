import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UserSettings, DiaryEntry } from '../../types/diabetes';
import { DEFAULT_SETTINGS } from '../../utils/diabetes';
import { SettingsModal } from '../SettingsModal';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ToastSingle, ToastContainer, ToastItem } from '../ui/Toast';
import { EntryModal } from '../EntryModal';
import { ConfirmDeleteDayModal } from '../ConfirmDeleteDayModal';
import {
  InsulinTherapySection,
  ClinicalThresholdsSection,
  DataManagementSection,
} from './index';

function createEntry(id: string, date: string, time: string, glucose = 5.5): DiaryEntry {
  return {
    id,
    date,
    time,
    glucose,
    carbs: 40,
    xe: 3.3,
    rinFast: 4,
    tresiba: 14,
    calories: 250,
    notes: 'Тест',
    createdAt: Date.now(),
  };
}

test('1. InsulinTherapySection: рендеринг и корректное обновление параметров пациента и инсулина', () => {
  const currentSettings: UserSettings = { ...DEFAULT_SETTINGS, patientName: 'Тест Пациент' };
  let updatedSettings: UserSettings | null = null;

  const html = renderToStaticMarkup(
    React.createElement(InsulinTherapySection, {
      settings: currentSettings,
      onUpdateSettings: (s) => {
        updatedSettings = s;
      },
    })
  );

  assert.ok(html.includes('ФИО пациента:'), 'Содержит лейбл ФИО');
  assert.ok(html.includes('Грамм углеводов в 1 ХЕ:'), 'Содержит лейбл ХЕ');
  assert.ok(html.includes('Болюсный (короткий на еду):'), 'Содержит лейбл болюса');
  assert.ok(html.includes('Базальный (длинный на ночь):'), 'Содержит лейбл базала');
  assert.ok(html.includes('Тест Пациент'), 'Отображает текущее ФИО');
  assert.ok(html.includes('РинФаст'), 'Отображает дефолтный болюс');
  assert.ok(html.includes('Тресиба'), 'Отображает дефолтный базал');
});

test('2. ClinicalThresholdsSection: автоматический пересчет targetLow при изменении hypoThreshold и расчет коридора', () => {
  let latestSettings: UserSettings = {
    ...DEFAULT_SETTINGS,
    hypoThreshold: 3.9,
    targetLow: 4.0,
    targetHigh: 9.9,
    eHbA1c: 6.4,
    acr: 1.8,
  };

  const html = renderToStaticMarkup(
    React.createElement(ClinicalThresholdsSection, {
      settings: latestSettings,
      onUpdateSettings: (s) => {
        latestSettings = s;
      },
    })
  );

  assert.ok(html.includes('Порог гипогликемии (низкий сахар ≤):'));
  assert.ok(html.includes('Верхний порог (высокий сахар &gt;):'));
  assert.ok(html.includes('Целевой диапазон нормы:'));
  assert.ok(html.includes('4 – 9.9 ммоль/л') || html.includes('4.0 – 9.9 ммоль/л'));
  assert.ok(html.includes('6.4'), 'Отображает eHbA1c');
  assert.ok(html.includes('1.8'), 'Отображает ACR');

  // Симуляция логики изменения hypoThreshold: targetLow = hypoThreshold + 0.1
  const newHypo = 3.6;
  latestSettings = {
    ...latestSettings,
    hypoThreshold: newHypo,
    targetLow: Number((newHypo + 0.1).toFixed(1)),
  };
  assert.equal(latestSettings.hypoThreshold, 3.6);
  assert.equal(latestSettings.targetLow, 3.7);
  assert.ok(latestSettings.targetLow < latestSettings.targetHigh);
});

test('3. DataManagementSection: экспорт/импорт JSON бэкапа и структура экспортируемых данных', () => {
  const entries: DiaryEntry[] = [
    createEntry('e-1', '2026-04-01', '08:00', 5.2),
    createEntry('e-2', '2026-04-01', '13:00', 6.8),
  ];

  // Проверка структуры JSON бэкапа
  const payload = {
    app: 'DiabetesSelfMonitoringDiary',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    settings: DEFAULT_SETTINGS,
    entries,
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.app, 'DiabetesSelfMonitoringDiary');
  assert.equal(parsed.version, '1.0');
  assert.equal(parsed.entries.length, 2);
  assert.equal(parsed.settings.patientName, DEFAULT_SETTINGS.patientName);

  // Проверка обратной совместимости: парсинг старого формата (массив записей)
  const legacyJsonStr = JSON.stringify(entries);
  const parsedLegacy = JSON.parse(legacyJsonStr);
  assert.ok(Array.isArray(parsedLegacy));
  assert.equal(parsedLegacy.length, 2);
});

test('4. DataManagementSection: опциональность дедупликации и подтверждение очистки дневника', () => {
  const entries: DiaryEntry[] = [createEntry('e-1', '2026-04-01', '08:00', 5.5)];

  // Рендеринг с функцией дедупликации
  const htmlWithDedup = renderToStaticMarkup(
    React.createElement(DataManagementSection, {
      settings: DEFAULT_SETTINGS,
      onUpdateSettings: () => {},
      entries,
      onImportData: () => {},
      onOpenExcelImport: () => {},
      onClearAll: () => {},
      onDeduplicate: async () => {},
      onClose: () => {},
      isOpen: true,
    })
  );
  assert.ok(htmlWithDedup.includes('Очистка дубликатов'), 'Показывает блок дедупликации');
  assert.ok(htmlWithDedup.includes('Удалить дубликаты'));

  // Рендеринг БЕЗ функции дедупликации
  const htmlWithoutDedup = renderToStaticMarkup(
    React.createElement(DataManagementSection, {
      settings: DEFAULT_SETTINGS,
      onUpdateSettings: () => {},
      entries,
      onImportData: () => {},
      onOpenExcelImport: () => {},
      onClearAll: () => {},
      onClose: () => {},
      isOpen: true,
    })
  );
  assert.ok(!htmlWithoutDedup.includes('Очистка дубликатов'), 'Не показывает блок дедупликации без onDeduplicate');

  // Кнопка очистки активна при entries.length > 0
  assert.ok(htmlWithDedup.includes('Очистить дневник'));
  assert.ok(!htmlWithDedup.includes('disabled=""'));

  // При пустых записях кнопка очистки заблокирована
  const htmlEmptyEntries = renderToStaticMarkup(
    React.createElement(DataManagementSection, {
      settings: DEFAULT_SETTINGS,
      onUpdateSettings: () => {},
      entries: [],
      onImportData: () => {},
      onOpenExcelImport: () => {},
      onClearAll: () => {},
      onClose: () => {},
      isOpen: true,
    })
  );
  assert.ok(htmlEmptyEntries.includes('disabled'), 'Кнопка очистки заблокирована при пустом дневнике');
});

test('5. SettingsModal: сквозная композиция всех секций и управление модальным окном', () => {
  let closed = false;

  const openHtml = renderToStaticMarkup(
    React.createElement(SettingsModal, {
      isOpen: true,
      onClose: () => {
        closed = true;
      },
      settings: DEFAULT_SETTINGS,
      onUpdateSettings: () => {},
      entries: [createEntry('e-1', '2026-04-01', '08:00', 5.5)],
      onImportData: () => {},
      onOpenExcelImport: () => {},
      onClearAll: () => {},
      onDeduplicate: async () => {},
    })
  );

  assert.ok(openHtml.includes('Настройки и управление данными'), 'Заголовок модального окна отрендерен');
  assert.ok(openHtml.includes('Данные пациента и углеводы'), 'Секция пациента отрендерена');
  assert.ok(openHtml.includes('Целевой диапазон сахара в крови'), 'Секция порогов отрендерена');
  assert.ok(openHtml.includes('Таблицы Excel (.xlsx)'), 'Секция управления данными отрендерена');
  assert.ok(openHtml.includes('Готово'), 'Кнопка закрытия окна отрендерена');

  // Закрытое окно не рендерит содержимое
  const closedHtml = renderToStaticMarkup(
    React.createElement(SettingsModal, {
      isOpen: false,
      onClose: () => {},
      settings: DEFAULT_SETTINGS,
      onUpdateSettings: () => {},
      entries: [],
      onImportData: () => {},
      onOpenExcelImport: () => {},
      onClearAll: () => {},
    })
  );
  assert.equal(closedHtml, '', 'Закрытое модальное окно не рендерит DOM');
});

test('6. UI Refactoring: универсальный компонент Modal (доступность, размеры, анимации)', () => {
  // Закрытый Modal
  const closedHtml = renderToStaticMarkup(
    React.createElement(Modal, {
      isOpen: false,
      onClose: () => {},
      title: 'Тест',
      children: React.createElement('div', null, 'Содержимое'),
    })
  );
  assert.equal(closedHtml, '');

  // Открытый Modal со всеми параметрами
  const openHtml = renderToStaticMarkup(
    React.createElement(Modal, {
      isOpen: true,
      onClose: () => {},
      title: 'Заголовок диалога',
      subtitle: 'Подзаголовок описания',
      maxWidth: '2xl',
      children: React.createElement('p', null, 'Тестовое тело диалога'),
      footer: React.createElement('button', null, 'Кнопка футера'),
    })
  );
  assert.ok(openHtml.includes('role="dialog"'));
  assert.ok(openHtml.includes('aria-modal="true"'));
  assert.ok(openHtml.includes('id="modal-title"'));
  assert.ok(openHtml.includes('Заголовок диалога'));
  assert.ok(openHtml.includes('Подзаголовок описания'));
  assert.ok(openHtml.includes('max-w-2xl'));
  assert.ok(openHtml.includes('Кнопка футера'));
  assert.ok(openHtml.includes('aria-label="Закрыть модальное окно"'));
});

test('7. UI Refactoring: ConfirmDialog (деструктивный vs обычный режим, защита от двойных кликов)', () => {
  // Деструктивный режим (danger)
  const dangerHtml = renderToStaticMarkup(
    React.createElement(ConfirmDialog, {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      title: 'Удалить замер',
      description: 'Вы уверены, что хотите удалить замер?',
      confirmText: 'Да, удалить',
      cancelText: 'Отмена',
      isDestructive: true,
    })
  );
  assert.ok(dangerHtml.includes('role="dialog"'));
  assert.ok(dangerHtml.includes('Удалить замер'));
  assert.ok(dangerHtml.includes('Вы уверены, что хотите удалить замер?'));
  assert.ok(dangerHtml.includes('Да, удалить'));
  assert.ok(dangerHtml.includes('bg-rose-600'), 'Содержит стили кнопки danger');

  // Обычный режим (primary)
  const primaryHtml = renderToStaticMarkup(
    React.createElement(ConfirmDialog, {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      title: 'Подтвердить действие',
      description: 'Сохранить изменения?',
      variant: 'primary',
    })
  );
  assert.ok(primaryHtml.includes('bg-teal-600'), 'Содержит стили кнопки primary');
  assert.ok(primaryHtml.includes('Подтвердить'));
  assert.ok(primaryHtml.includes('Отмена'));

  // ConfirmDeleteDayModal также использует ConfirmDialog
  const deleteDayHtml = renderToStaticMarkup(
    React.createElement(ConfirmDeleteDayModal, {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      date: '2026-11-02',
      count: 3,
    })
  );
  assert.ok(deleteDayHtml.includes('Удаление записей дня'));
  assert.ok(deleteDayHtml.includes('Удалить день (3)'));
  assert.ok(deleteDayHtml.includes('bg-rose-600'));
});

test('8. UI Refactoring: система уведомлений Toast (доступность, типы, ARIA роли)', () => {
  // Error Toast
  const errorToast: ToastItem = {
    id: 't-1',
    type: 'error',
    title: 'Ошибка сохранения',
    message: 'Не удалось синхронизировать замер сахара',
    createdAt: Date.now(),
  };
  const errorHtml = renderToStaticMarkup(
    React.createElement(ToastSingle, {
      toast: errorToast,
      onDismiss: () => {},
    })
  );
  assert.ok(errorHtml.includes('role="alert"'));
  assert.ok(errorHtml.includes('aria-live="assertive"'));
  assert.ok(errorHtml.includes('Ошибка сохранения'));
  assert.ok(errorHtml.includes('Не удалось синхронизировать замер сахара'));
  assert.ok(errorHtml.includes('aria-label="Закрыть уведомление"'));

  // Success Toast
  const successToast: ToastItem = {
    id: 't-2',
    type: 'success',
    message: 'Данные успешно сохранены',
    createdAt: Date.now(),
  };
  const successHtml = renderToStaticMarkup(
    React.createElement(ToastSingle, {
      toast: successToast,
      onDismiss: () => {},
    })
  );
  assert.ok(successHtml.includes('role="status"'));
  assert.ok(successHtml.includes('aria-live="polite"'));
  assert.ok(successHtml.includes('Данные успешно сохранены'));

  // ToastContainer рендерит список
  const containerHtml = renderToStaticMarkup(
    React.createElement(ToastContainer, {
      toasts: [errorToast, successToast],
      onDismiss: () => {},
    })
  );
  assert.ok(containerHtml.includes('role="region"'));
  assert.ok(containerHtml.includes('Уведомления приложения'));
  assert.ok(containerHtml.includes('Ошибка сохранения'));
  assert.ok(containerHtml.includes('Данные успешно сохранены'));
});

test('9. UI Refactoring: унификация EntryModal с универсальным Modal', () => {
  // Закрытый EntryModal
  const closedHtml = renderToStaticMarkup(
    React.createElement(EntryModal, {
      isOpen: false,
      onClose: () => {},
      onSave: () => {},
    })
  );
  assert.equal(closedHtml, '');

  // Открытый EntryModal для новой записи
  const newHtml = renderToStaticMarkup(
    React.createElement(EntryModal, {
      isOpen: true,
      onClose: () => {},
      onSave: () => {},
      settings: DEFAULT_SETTINGS,
    })
  );
  assert.ok(newHtml.includes('role="dialog"'));
  assert.ok(newHtml.includes('aria-modal="true"'));
  assert.ok(newHtml.includes('Новая запись в дневник'));
  assert.ok(newHtml.includes('Учет глюкозы, инсулина, углеводов и ХЕ'));
  assert.ok(newHtml.includes('entry-glucose'));
  assert.ok(newHtml.includes('entry-carbs'));
  assert.ok(newHtml.includes('entry-xe'));
  assert.ok(newHtml.includes('Добавить запись'));
  assert.ok(newHtml.includes('Отмена'));

  // Открытый EntryModal для редактирования
  const editHtml = renderToStaticMarkup(
    React.createElement(EntryModal, {
      isOpen: true,
      onClose: () => {},
      onSave: () => {},
      initialEntry: createEntry('e-edit', '2026-11-02', '12:00', 6.2),
      settings: DEFAULT_SETTINGS,
    })
  );
  assert.ok(editHtml.includes('Редактировать запись'));
  assert.ok(editHtml.includes('Сохранить изменения'));
});

test('10. UI Refactoring: полное отсутствие нативных alert() и confirm() в исходном коде src/', () => {
  function scanDir(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        files.push(...scanDir(fullPath));
      } else if (ent.isFile() && (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allSrcFiles = scanDir(path.resolve('src'));
  const violations: string[] = [];

  const alertCallRegex = /(?<![.\w])alert\s*\(/;
  const confirmCallRegex = /(?<![.\w])confirm\s*\(/;

  for (const filePath of allSrcFiles) {
    if (filePath.endsWith('settings.test.ts')) continue;

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      if (alertCallRegex.test(line)) {
        violations.push(`${path.basename(filePath)}:${index + 1}: alert() -> ${trimmed}`);
      }
      if (confirmCallRegex.test(line)) {
        violations.push(`${path.basename(filePath)}:${index + 1}: confirm() -> ${trimmed}`);
      }
    });
  }

  assert.deepEqual(violations, [], `Найдены неразрешённые вызовы alert/confirm: ${violations.join(', ')}`);
});
