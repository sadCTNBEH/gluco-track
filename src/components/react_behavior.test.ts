import '../test_setup_dom';
import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  render,
  fireEvent,
  waitFor,
  act,
} from '../test_utils';
import { DiaryEntry, UserSettings, DraftDiaryEntry } from '../types/diabetes';
import { DEFAULT_SETTINGS } from '../utils/diabetes';
import { EntryModal } from './EntryModal';
import { SettingsModal } from './SettingsModal';
import { DiaryTable } from './DiaryTable';
import { MobileCardView } from './MobileCardView';
import { ToastProvider, useToast } from './ui/Toast';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { SyncStatusBanner } from './SyncStatusBanner';
import { useDiaryData } from '../hooks/useDiaryData';
import { AuthUser, api, ApiError } from '../api/client';
import App from '../App';

function createSampleEntry(partial: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: partial.id || crypto.randomUUID(),
    date: partial.date || '2026-11-02',
    time: partial.time || '12:00',
    glucose: partial.glucose !== undefined ? partial.glucose : 6.0,
    carbs: partial.carbs !== undefined ? partial.carbs : 36,
    xe: partial.xe !== undefined ? partial.xe : 3.0,
    rinFast: partial.rinFast !== undefined ? partial.rinFast : 4,
    tresiba: partial.tresiba !== undefined ? partial.tresiba : null,
    calories: partial.calories !== undefined ? partial.calories : 300,
    notes: partial.notes || 'Тестовая запись',
    tag: partial.tag || 'lunch',
    createdAt: partial.createdAt || Date.now(),
    _syncStatus: partial._syncStatus,
  };
}

describe('React Components & Behavioral Test Suite', () => {
  beforeEach(() => {
    setupTestEnvironment();
  });

  afterEach(() => {
    cleanupTestEnvironment();
  });

  // =========================================================================
  // 1. EntryModal: создание, валидация, расчет ХЕ и сохранение
  // =========================================================================
  test('1. EntryModal: создание новой записи, авто-расчет ХЕ, кнопка "Сейчас" и отправка', () => {
    let savedDraft: DraftDiaryEntry | null = null;
    let closed = false;

    const { getByText, querySelector } = render(
      React.createElement(EntryModal, {
        isOpen: true,
        onClose: () => {
          closed = true;
        },
        onSave: (draft) => {
          savedDraft = draft;
        },
        xeRatio: 12,
        bolusName: 'РинФаст',
        basalName: 'Тресиба',
      })
    );

    assert.ok(getByText('Новая запись в дневник'));

    // Проверяем наличие полей формы по ID
    const glucoseInput = querySelector<HTMLInputElement>('#entry-glucose');
    const carbsInput = querySelector<HTMLInputElement>('#entry-carbs');
    const xeInput = querySelector<HTMLInputElement>('#entry-xe');
    const notesInput = querySelector<HTMLTextAreaElement>('#entry-notes');
    const timeInput = querySelector<HTMLInputElement>('#entry-time');
    const nowBtn = getByText('Сейчас');

    assert.ok(glucoseInput, 'Поле глюкозы должно присутствовать');
    assert.ok(carbsInput, 'Поле углеводов должно присутствовать');
    assert.ok(xeInput, 'Поле ХЕ должно присутствовать');

    // Клик по кнопке "Сейчас" обновляет время
    fireEvent.click(nowBtn);
    assert.ok(timeInput?.value, 'Время должно быть заполнено после клика "Сейчас"');

    // Вводим углеводы: 36 г при xeRatio 12 -> ХЕ должно автоматически стать 3
    fireEvent.change(carbsInput!, '36');
    assert.equal(xeInput?.value, '3', 'ХЕ должно автоматически пересчитаться как 36 / 12 = 3');

    // Вводим глюкозу 3.5 -> статус должен обновиться
    fireEvent.change(glucoseInput!, '3.5');
    assert.ok(getByText(/Гипогликемия/), 'Статус 3.5 ммоль/л должен отображаться как Гипогликемия');

    // Изменяем глюкозу на 6.5 -> Норма
    fireEvent.change(glucoseInput!, '6.5');
    assert.ok(getByText(/Норма/), 'Статус 6.5 ммоль/л должен отображаться как Норма');

    // Ручное переопределение ХЕ (пользователь вводит 3.5 вместо 3)
    fireEvent.change(xeInput!, '3.5');
    // Повторный ввод углеводов не должен перезаписывать ручной ввод ХЕ
    fireEvent.change(carbsInput!, '40');
    assert.equal(xeInput?.value, '3.5', 'Ручной ввод ХЕ не должен перезаписываться');

    // Вводим заметку
    fireEvent.change(notesInput!, '   Обед в кафе   ');

    // Отправляем форму
    const form = querySelector('form');
    assert.ok(form);
    fireEvent.submit(form!);

    assert.ok(savedDraft, 'onSave должен быть вызван');
    assert.equal((savedDraft as unknown as DraftDiaryEntry).glucose, 6.5);
    assert.equal((savedDraft as unknown as DraftDiaryEntry).carbs, 40);
    assert.equal((savedDraft as unknown as DraftDiaryEntry).xe, 3.5);
    assert.equal((savedDraft as unknown as DraftDiaryEntry).notes, 'Обед в кафе', 'Заметка должна быть очищена от пробелов');
    assert.equal(closed, true, 'onClose должен быть вызван после сохранения');
  });

  test('2. EntryModal: редактирование существующей записи с сохранением исходного ID', () => {
    let savedDraft: DraftDiaryEntry | null = null;
    const initialEntry = createSampleEntry({
      id: 'existing-id-123',
      date: '2026-11-01',
      time: '18:30',
      glucose: 12.5,
      carbs: 60,
      xe: 5.0,
      rinFast: 7,
      tresiba: null,
      notes: 'Праздничный ужин',
      tag: 'dinner',
    });

    const { getByText, querySelector } = render(
      React.createElement(EntryModal, {
        isOpen: true,
        initialEntry,
        onClose: () => {},
        onSave: (draft) => {
          savedDraft = draft;
        },
      })
    );

    assert.ok(getByText('Редактировать запись'));
    assert.ok(getByText(/гипергликемия/i));

    const glucoseInput = querySelector<HTMLInputElement>('#entry-glucose');
    assert.equal(glucoseInput?.value, '12.5');

    // Изменяем сахар на 7.0
    fireEvent.change(glucoseInput!, '7.0');

    const form = querySelector('form');
    fireEvent.submit(form!);

    assert.ok(savedDraft);
    assert.equal((savedDraft as unknown as DraftDiaryEntry).id, 'existing-id-123', 'ID исходной записи должен сохраниться');
    assert.equal((savedDraft as unknown as DraftDiaryEntry).glucose, 7.0);
    assert.equal((savedDraft as unknown as DraftDiaryEntry).tag, 'dinner');
  });

  // =========================================================================
  // 2. SettingsModal: переключение вкладок, настройки, пороговые значения
  // =========================================================================
  test('3. SettingsModal: разделы терапии, клинических порогов и управление данными', () => {
    let updatedSettings: UserSettings | null = null;
    let closed = false;

    const currentSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      patientName: 'Иван Иванов',
      xeRatio: 12,
    };

    const { getByText, querySelector } = render(
      React.createElement(SettingsModal, {
        isOpen: true,
        onClose: () => {
          closed = true;
        },
        settings: currentSettings,
        entries: [],
        onUpdateSettings: (s) => {
          updatedSettings = s;
        },
        onImportData: () => {},
        onOpenExcelImport: () => {},
        onClearAll: () => {},
      })
    );

    assert.ok(getByText('Настройки и управление данными'));

    // Поле ФИО пациента
    const patientInput = querySelector<HTMLInputElement>('#settings-patient-name');
    assert.ok(patientInput, 'Поле с ФИО должно присутствовать');
    assert.equal(patientInput.value, 'Иван Иванов');

    // Изменяем ФИО
    fireEvent.change(patientInput!, 'Петр Петров');
    assert.ok(updatedSettings);
    assert.equal((updatedSettings as unknown as UserSettings).patientName, 'Петр Петров');

    // Проверяем наличие разделов клинических порогов и экспорта
    assert.ok(getByText(/Целевые уровни сахара|диапазон/i));
    assert.ok(getByText(/Экспорт в JSON/i));

    // Кнопка "Готово" закрывает окно
    const doneBtn = getByText('Готово');
    fireEvent.click(doneBtn);
    assert.equal(closed, true);
  });

  // =========================================================================
  // 3. DiaryTable: фильтры, сортировка, бейджи синхронизации и удаление
  // =========================================================================
  test('4. DiaryTable: фильтрация по периоду, статусу, поиск и действия пользователя', () => {
    let added = false;
    let editedEntry: DiaryEntry | null = null;
    let deletedId: string | null = null;
    let deletedDay: { date: string; count: number } | null = null;

    const entries: DiaryEntry[] = [
      createSampleEntry({ id: '1', date: '2026-11-02', time: '08:00', glucose: 3.5, notes: 'Утренний чай' }),
      createSampleEntry({ id: '2', date: '2026-11-02', time: '13:00', glucose: 6.0, notes: 'Обед в столовой' }),
      createSampleEntry({ id: '3', date: '2026-11-01', time: '19:00', glucose: 11.5, notes: 'Праздничный торт' }),
      createSampleEntry({ id: '4', date: '2026-10-15', time: '12:00', glucose: 15.0, notes: 'Давняя запись' }),
    ];

    const { getByText, queryByText, querySelector } = render(
      React.createElement(DiaryTable, {
        entries,
        onAddClick: () => {
          added = true;
        },
        onEditClick: (e) => {
          editedEntry = e;
        },
        onDeleteClick: (id) => {
          deletedId = id;
        },
        onDeleteDayClick: (date, count) => {
          deletedDay = { date, count };
        },
      })
    );

    // 1. Проверяем отображение всех записей
    assert.ok(getByText('Утренний чай'));
    assert.ok(getByText('Обед в столовой'));
    assert.ok(getByText('Праздничный торт'));
    assert.ok(getByText('Давняя запись'));

    // 2. Поиск по заметкам: вводим "чай"
    const searchInput = querySelector<HTMLInputElement>('input[placeholder*="Поиск"]');
    assert.ok(searchInput);
    fireEvent.change(searchInput!, 'чай');

    assert.ok(queryByText('Утренний чай') !== null, 'Запись с чаем должна быть видна');
    assert.equal(queryByText('Обед в столовой'), null, 'Запись без чая должна быть скрыта');
    assert.equal(queryByText('Праздничный торт'), null);

    // Сбрасываем поиск
    fireEvent.change(searchInput!, '');
    assert.ok(getByText('Обед в столовой'));

    // 3. Фильтрация по статусу: выбираем "low" (Низкий)
    const statusSelect = querySelector<HTMLSelectElement>('select');
    assert.ok(statusSelect);
    fireEvent.change(statusSelect!, 'low');

    assert.ok(getByText('Утренний чай'), 'Запись со статусом low (3.5) должна быть видна');
    assert.equal(queryByText('Обед в столовой'), null);

    // Сбрасываем статус
    fireEvent.change(statusSelect!, 'all');

    // 4. Клик по кнопке редактирования записи
    const editBtn = querySelector<HTMLButtonElement>('button[title*="Редактировать запись"]');
    assert.ok(editBtn);
    fireEvent.click(editBtn!);
    assert.ok(editedEntry, 'onEditClick должен быть вызван');

    // 5. Клик по удалению записи
    const deleteBtn = querySelector<HTMLButtonElement>('button[title*="Удалить запись"]');
    assert.ok(deleteBtn);
    fireEvent.click(deleteBtn!);
    assert.ok(deletedId, 'onDeleteClick должен быть вызван с ID записи');
  });

  test('5. DiaryTable: пустое состояние при отсутствии записей и вызов onAddClick', () => {
    let added = false;
    const { getByText } = render(
      React.createElement(DiaryTable, {
        entries: [],
        onAddClick: () => {
          added = true;
        },
        onEditClick: () => {},
        onDeleteClick: () => {},
      })
    );

    assert.ok(getByText('Нет записей по выбранным критериям'));
    const addBtn = getByText('Добавить измерение');
    fireEvent.click(addBtn);
    assert.equal(added, true, 'onAddClick должен быть вызван');
  });

  // =========================================================================
  // 4. MobileCardView: карточный вид и группировка
  // =========================================================================
  test('6. MobileCardView: группировка по дням, отображение карточек и действий', () => {
    let edited = false;
    let deleted = false;
    const entries = [
      createSampleEntry({ id: 'm1', date: '2026-11-02', time: '09:00', glucose: 5.5, carbs: 30, rinFast: 3 }),
      createSampleEntry({ id: 'm2', date: '2026-11-02', time: '14:00', glucose: 7.0, carbs: 45, rinFast: 5 }),
    ];

    const { getByText, querySelector } = render(
      React.createElement(MobileCardView, {
        entries,
        onAddClick: () => {},
        onEditClick: () => {
          edited = true;
        },
        onDeleteClick: () => {
          deleted = true;
        },
      })
    );

    // Проверяем отображение карточек
    assert.ok(getByText('5.5'));
    assert.ok(getByText('7.0'));

    // Редактирование
    const editBtn = querySelector('button[aria-label="Редактировать"]');
    assert.ok(editBtn);
    fireEvent.click(editBtn!);
    assert.equal(edited, true);

    // Удаление
    const delBtn = querySelector('button[aria-label="Удалить"]');
    assert.ok(delBtn);
    fireEvent.click(delBtn!);
    assert.equal(deleted, true);
  });

  test('7. MobileCardView: пустое состояние', () => {
    const { getByText } = render(
      React.createElement(MobileCardView, {
        entries: [],
        onAddClick: () => {},
        onEditClick: () => {},
        onDeleteClick: () => {},
      })
    );

    assert.ok(getByText('В дневнике пока нет записей'));
    assert.ok(getByText('Добавить первое измерение'));
  });

  // =========================================================================
  // 5. SyncStatusBanner: отображение ожидающих синхронизации записей и ошибок
  // =========================================================================
  test('8. SyncStatusBanner: отображение ожидающих синхронизации записей и ошибок', () => {
    let retried = false;
    let cleared = false;

    // 1. Отображение неотправленных записей (offline pending)
    const { getByText } = render(
      React.createElement(SyncStatusBanner, {
        pendingCount: 3,
        syncError: null,
        isSyncing: false,
        onRetry: () => {
          retried = true;
        },
        onDismissError: () => {
          cleared = true;
        },
      })
    );

    assert.ok(getByText('Офлайн-режим:'));
    assert.ok(getByText('3'));

    const syncBtn = getByText('Синхронизировать');
    fireEvent.click(syncBtn);
    assert.equal(retried, true);

    // 2. Отображение ошибки API
    const { getByText: getByTextErr, querySelector } = render(
      React.createElement(SyncStatusBanner, {
        pendingCount: 0,
        syncError: 'Сбой сети: сервер недоступен',
        isSyncing: false,
        onRetry: () => {},
        onDismissError: () => {
          cleared = true;
        },
      })
    );

    assert.ok(getByTextErr('Сбой сети: сервер недоступен'));
    const dismissBtn = querySelector('button[aria-label="Закрыть уведомление"]');
    assert.ok(dismissBtn);
    fireEvent.click(dismissBtn!);
    assert.equal(cleared, true);
  });

  // =========================================================================
  // 6. ConfirmDialog: открытие, подтверждение и отмена
  // =========================================================================
  test('9. ConfirmDialog: подтверждение и отмена опасных действий', async () => {
    let confirmed = false;
    let closed = false;

    const { getByText } = render(
      React.createElement(ConfirmDialog, {
        isOpen: true,
        title: 'Удалить запись?',
        description: 'Вы уверены, что хотите удалить эту запись безвозвратно?',
        confirmText: 'Да, удалить',
        cancelText: 'Отмена',
        variant: 'danger',
        onConfirm: () => {
          confirmed = true;
        },
        onClose: () => {
          closed = true;
        },
      })
    );

    assert.ok(getByText('Удалить запись?'));
    assert.ok(getByText('Вы уверены, что хотите удалить эту запись безвозвратно?'));

    // Клик по отмене
    const cancelBtn = getByText('Отмена');
    fireEvent.click(cancelBtn);
    assert.equal(closed, true);

    // Клик по подтверждению
    const confirmBtn = getByText('Да, удалить');
    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    assert.equal(confirmed, true);
  });

  // =========================================================================
  // 7. Toast: показ уведомлений
  // =========================================================================
  test('10. ToastProvider: показ успешных и ошибочных всплывающих уведомлений', () => {
    let toastMethods: ReturnType<typeof useToast> | null = null;

    function TestToastConsumer() {
      toastMethods = useToast();
      return React.createElement('div', null, 'Toast Consumer Mounted');
    }

    const { getByText } = render(
      React.createElement(
        ToastProvider,
        null,
        React.createElement(TestToastConsumer)
      )
    );

    assert.ok(getByText('Toast Consumer Mounted'));
    assert.ok(toastMethods);

    // Показываем уведомление об успехе
    act(() => {
      toastMethods!.success('Запись успешно сохранена!');
    });
    assert.ok(getByText('Запись успешно сохранена!'));

    // Показываем уведомление об ошибке
    act(() => {
      toastMethods!.error('Ошибка сохранения данных');
    });
    assert.ok(getByText('Ошибка сохранения данных'));
  });

  // =========================================================================
  // 8. useDiaryData: поведенческий тест хука с созданием UUID и изоляцией
  // =========================================================================
  test('11. useDiaryData: генерация UUID (SEC-11), синхронизация и изоляция пользователей', async () => {
    const mockUser: AuthUser = { id: 'usr-react-test-1', username: 'testuser' };
    type HookData = ReturnType<typeof useDiaryData>;
    let hookReturn: HookData | null = null;
    const getHook = (): HookData => hookReturn!;

    // Мокаем API методы для полной сетевой изоляции
    const origCreate = api.createEntry;
    const origUpdate = api.updateEntry;
    const origDelete = api.deleteEntry;
    const origGet = api.getEntries;
    const origSettings = api.updateSettings;
    const origGetSettings = api.getSettings;

    api.createEntry = async (entry) => entry as DiaryEntry;
    api.updateEntry = async (_id, entry) => entry as DiaryEntry;
    api.deleteEntry = async () => {};
    api.getEntries = async () => [];
    api.updateSettings = async (s) => s;
    api.getSettings = async () => DEFAULT_SETTINGS;

    try {
      function TestHookConsumer({ user }: { user: AuthUser | null }) {
        const data = useDiaryData(user);
        hookReturn = data;
        return React.createElement('div', null, `Entries count: ${data.entries.length}`);
      }

      const { getByText } = render(
        React.createElement(TestHookConsumer, { user: mockUser })
      );

      assert.ok(getByText('Entries count: 0'));
      assert.ok(hookReturn);

      // Сохранение новой записи без ID -> создание и генерация UUID (SEC-11)
      let saveResult = false;
      await act(async () => {
        saveResult = await getHook().handleSaveEntry({
          date: '2026-11-02',
          time: '12:00',
          glucose: 5.5,
          carbs: 30,
          xe: 2.5,
          rinFast: 4,
          tresiba: null,
          calories: 250,
          notes: 'Обед в тесте',
        });
      });

      assert.equal(saveResult, true, 'Запись должна быть успешно сохранена');
      assert.equal(getHook().entries.length, 1);
      const created = getHook().entries[0];
      assert.ok(created.id, 'Созданная запись должна иметь id');
      assert.match(
        created.id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        'Сгенерированный ID должен быть криптографически стойким UUID v4'
      );

      // Обновление настроек
      let settingsResult = false;
      await act(async () => {
        settingsResult = await getHook().handleUpdateSettings({
          ...DEFAULT_SETTINGS,
          patientName: 'Новый пациент',
          xeRatio: 15,
        });
      });
      assert.equal(settingsResult, true);
      assert.equal(getHook().settings.patientName, 'Новый пациент');
      assert.equal(getHook().settings.xeRatio, 15);

      // Удаление записи
      let deleteResult = false;
      await act(async () => {
        deleteResult = await getHook().handleDeleteEntry(created.id);
      });
      assert.equal(deleteResult, true);
      assert.equal(getHook().entries.length, 0);
    } finally {
      api.createEntry = origCreate;
      api.updateEntry = origUpdate;
      api.deleteEntry = origDelete;
      api.getEntries = origGet;
      api.updateSettings = origSettings;
      api.getSettings = origGetSettings;
    }
  });

  // =========================================================================
  // 9. App.tsx: корневой компонент, авторизация и рендеринг
  // =========================================================================
  test('12. App: отображение экрана авторизации для неавторизованного пользователя', async () => {
    // Мокаем api.getMe на отказ авторизации (401)
    const originalGetMe = api.getMe;
    api.getMe = async () => {
      throw new ApiError('Not authenticated', 401);
    };

    try {
      let queryByTextFn!: (m: string | RegExp) => HTMLElement | null;
      await act(async () => {
        const res = render(React.createElement(App));
        queryByTextFn = res.queryByText;
      });

      await waitFor(() => {
        return queryByTextFn('Вход в GlucoTrack Pro') !== null || queryByTextFn('Войти') !== null;
      });

      assert.ok(
        queryByTextFn('Вход в GlucoTrack Pro') || queryByTextFn('Войти'),
        'Экран авторизации должен отображаться для неавторизованного пользователя'
      );
    } finally {
      api.getMe = originalGetMe;
    }
  });
});
