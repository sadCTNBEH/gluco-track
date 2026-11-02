import { useState, useCallback } from 'react';
import { DiaryEntry } from '../types/diabetes';

export interface DayToDeletePayload {
  date: string;
  count: number;
}

export type PrivacyModalTab = 'policy' | 'medical';

/**
 * Хук централизованного управления состоянием всех модальных окон приложения GlucoTrack Pro.
 * Изолирует видимость окон, временные полезные нагрузки (payloads) и методы открытия/закрытия.
 */
export function useModalState() {
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [privacyModalTab, setPrivacyModalTab] = useState<PrivacyModalTab>('policy');

  const [dayToDelete, setDayToDelete] = useState<DayToDeletePayload | null>(null);

  // Добавление новой записи
  const openCreateEntry = useCallback(() => {
    setEditingEntry(null);
    setIsEntryModalOpen(true);
  }, []);

  // Редактирование существующей записи
  const openEditEntry = useCallback((entry: DiaryEntry) => {
    setEditingEntry(entry);
    setIsEntryModalOpen(true);
  }, []);

  const closeEntryModal = useCallback(() => {
    setIsEntryModalOpen(false);
    setEditingEntry(null);
  }, []);

  // Настройки
  const openSettings = useCallback(() => {
    setIsSettingsModalOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsSettingsModalOpen(false);
  }, []);

  // Импорт Excel / CSV
  const openExcelImport = useCallback(() => {
    setIsExcelModalOpen(true);
  }, []);

  const closeExcelImport = useCallback(() => {
    setIsExcelModalOpen(false);
  }, []);

  // Политика конфиденциальности и правовая информация (152-ФЗ)
  const openPrivacyModal = useCallback((tab: PrivacyModalTab = 'policy') => {
    setPrivacyModalTab(tab);
    setIsPrivacyModalOpen(true);
  }, []);

  const closePrivacyModal = useCallback(() => {
    setIsPrivacyModalOpen(false);
  }, []);

  // Удаление дня
  const openDeleteDay = useCallback((date: string, count: number) => {
    setDayToDelete({ date, count });
  }, []);

  const closeDeleteDay = useCallback(() => {
    setDayToDelete(null);
  }, []);

  // Закрытие всех диалогов (при смене аккаунта или выходе)
  const closeAll = useCallback(() => {
    setIsEntryModalOpen(false);
    setEditingEntry(null);
    setIsSettingsModalOpen(false);
    setIsExcelModalOpen(false);
    setIsPrivacyModalOpen(false);
    setDayToDelete(null);
  }, []);

  return {
    isEntryModalOpen,
    editingEntry,
    openCreateEntry,
    openEditEntry,
    closeEntryModal,

    isSettingsModalOpen,
    openSettings,
    closeSettings,

    isExcelModalOpen,
    openExcelImport,
    closeExcelImport,

    isPrivacyModalOpen,
    privacyModalTab,
    openPrivacyModal,
    closePrivacyModal,

    dayToDelete,
    openDeleteDay,
    closeDeleteDay,

    closeAll,
  };
}

export type ModalStateReturn = ReturnType<typeof useModalState>;
