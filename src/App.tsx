/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DiaryEntry, UserSettings } from './types/diabetes';
import { DEFAULT_SETTINGS, calculateMonthlyStats } from './utils/diabetes';
import { generateSampleData } from './data/sampleData';
import { Header, ActiveTab, ViewMode } from './components/Header';
import { DiaryTable } from './components/DiaryTable';
import { MobileCardView } from './components/MobileCardView';
import { MonthlyCharts } from './components/MonthlyCharts';
import { DoctorReportPdf } from './components/DoctorReportPdf';
import { EntryModal } from './components/EntryModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthScreen } from './components/AuthScreen';
import { ExcelImportModal } from './components/ExcelImportModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { ConfirmDeleteDayModal } from './components/ConfirmDeleteDayModal';
import { CookieBanner } from './components/CookieBanner';
import { Footer } from './components/Footer';
import { TelemetryBar } from './components/TelemetryBar';
import { Theme, getInitialTheme, applyTheme } from './utils/theme';
import { api, AuthUser } from './api/client';
import { Plus, Award, Loader2 } from 'lucide-react';

const STORAGE_KEY_ENTRIES = 'diabetes_diary_entries_v1';
const STORAGE_KEY_SETTINGS = 'diabetes_diary_settings_v1';

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Применяем тему оформления при монтировании и изменении
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loadingData, setLoadingData] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [privacyModalTab, setPrivacyModalTab] = useState<'policy' | 'medical'>('policy');
  const [dayToDelete, setDayToDelete] = useState<{ date: string; count: number } | null>(null);

  const handleDeleteDayClick = (date: string, count: number) => {
    setDayToDelete({ date, count });
  };

  const handleConfirmDeleteDay = async () => {
    if (!dayToDelete) return;
    const targetDate = dayToDelete.date;
    setEntries((prev) => prev.filter((e) => e.date !== targetDate));
    setDayToDelete(null);
    try {
      await api.deleteDay(targetDate);
    } catch (err) {
      console.error('Ошибка удаления дня на сервере:', err);
    }
  };

  const handleOpenPolicy = (tab: 'policy' | 'medical' = 'policy') => {
    setPrivacyModalTab(tab);
    setIsPrivacyModalOpen(true);
  };

  // Загрузка данных пользователя с сервера
  const loadUserData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [serverEntries, serverSettings] = await Promise.all([
        api.getEntries(),
        api.getSettings(),
      ]);

      if (serverSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...serverSettings });
      }

      if (Array.isArray(serverEntries) && serverEntries.length > 0) {
        setEntries(serverEntries);
      } else {
        // Если база пустая, проверяем локальный кэш или оставляем пустой
        const localSaved = localStorage.getItem(STORAGE_KEY_ENTRIES);
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setEntries(parsed);
              // Синхронизируем локальные данные на сервер
              await api.importEntries(parsed, false).catch(() => {});
            }
          } catch {
            setEntries([]);
          }
        } else {
          setEntries([]);
        }
      }
    } catch (err) {
      console.error('Ошибка загрузки данных с сервера:', err);
      // Fallback на LocalStorage в случае сетевого сбоя
      const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
      if (saved) {
        try {
          setEntries(JSON.parse(saved));
        } catch {
          setEntries([]);
        }
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Первоначальная проверка авторизации
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.getMe();
        if (isMounted) {
          if (res?.user) {
            setUser(res.user);
            await loadUserData();
          } else {
            setUser(null);
          }
        }
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setAuthChecking(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [loadUserData]);

  // Кэширование в LocalStorage для оффлайн-доступа
  useEffect(() => {
    if (user && entries.length > 0) {
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
    }
  }, [entries, user]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    }
  }, [settings, user]);

  // Добавление или сохранение записи
  const handleSaveEntry = async (data: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }) => {
    if (data.id) {
      // Обновление существующей записи
      const updatedItem = {
        ...data,
        id: data.id,
      };
      setEntries((prev) =>
        prev.map((item) => (item.id === data.id ? { ...item, ...updatedItem } : item))
      );
      try {
        await api.updateEntry(data.id, data);
      } catch (err) {
        console.error('Ошибка сохранения на сервер:', err);
      }
    } else {
      // Создание новой записи
      const tempId = `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newEntry: DiaryEntry = {
        ...data,
        id: tempId,
        createdAt: Date.now(),
      };
      setEntries((prev) => [newEntry, ...prev]);
      try {
        const saved = await api.createEntry(newEntry);
        if (saved?.id) {
          setEntries((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, id: saved.id } : item))
          );
        }
      } catch (err) {
        console.error('Ошибка отправки записи на сервер:', err);
      }
    }
  };

  const handleEditEntry = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setIsEntryModalOpen(true);
  };

  const handleDeleteEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteEntry(id);
    } catch (err) {
      console.error('Ошибка удаления записи на сервере:', err);
    }
  };

  const handleResetToSample = async () => {
    const samples = generateSampleData();
    setEntries(samples);
    try {
      await api.importEntries(samples, true);
    } catch (err) {
      console.error('Ошибка загрузки демо-данных на сервер:', err);
    }
  };

  const handleClearAll = async () => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY_ENTRIES);
    try {
      await api.clearEntries();
    } catch (err) {
      console.error('Ошибка очистки на сервере:', err);
    }
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    try {
      await api.updateSettings(newSettings);
    } catch (err) {
      console.error('Ошибка обновления настроек на сервере:', err);
    }
  };

  // Импорт из файла Excel
  const handleExcelImport = async (importedEntries: DiaryEntry[], replaceAll: boolean) => {
    if (replaceAll) {
      setEntries(importedEntries);
    } else {
      setEntries((prev) => [...importedEntries, ...prev]);
    }
    await api.importEntries(importedEntries, replaceAll);
  };

  // Выход из системы
  const handleLogout = async () => {
    if (confirm('Выйти из дневника?')) {
      await api.logout();
      setUser(null);
      setEntries([]);
      localStorage.removeItem(STORAGE_KEY_ENTRIES);
    }
  };

  // Индикатор начальной проверки
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <p className="text-xs text-slate-400">Загрузка дневника...</p>
      </div>
    );
  }

  // Если не авторизован — показываем экран логина / регистрации
  if (!user) {
    return (
      <>
        <AuthScreen
          onSuccess={(authData) => {
            setUser(authData.user);
            loadUserData();
          }}
          onOpenPolicy={handleOpenPolicy}
        />
        <PrivacyPolicyModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
          defaultTab={privacyModalTab}
        />
        <CookieBanner onOpenPolicy={() => handleOpenPolicy('policy')} />
      </>
    );
  }

  // Метрики месяца для плашки статуса
  const recentStats = calculateMonthlyStats(entries);

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 flex flex-col selection:bg-teal-500/20 selection:text-teal-900 dark:selection:text-teal-200">
      {/* Шапка приложения */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddClick={() => {
          setEditingEntry(null);
          setIsEntryModalOpen(true);
        }}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        onExcelImportClick={() => setIsExcelModalOpen(true)}
        onLogout={handleLogout}
        username={user.username}
        entriesCount={entries.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Клинический телеметрический статус-бар */}
      <TelemetryBar
        entries={entries}
        settings={settings}
        patientName={settings.patientName || user.username}
      />

      {/* Основной контент */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {loadingData && entries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>Загрузка данных из базы...</span>
          </div>
        ) : (
          <>
            {activeTab === 'table' && (
              <>
                <div className="hidden md:block">
                  <DiaryTable
                    entries={entries}
                    onAddClick={() => {
                      setEditingEntry(null);
                      setIsEntryModalOpen(true);
                    }}
                    onEditClick={handleEditEntry}
                    onDeleteClick={handleDeleteEntry}
                    onDeleteDayClick={handleDeleteDayClick}
                  />
                </div>
                <div className="md:hidden">
                  {viewMode === 'cards' ? (
                    <MobileCardView
                      entries={entries}
                      onAddClick={() => {
                        setEditingEntry(null);
                        setIsEntryModalOpen(true);
                      }}
                      onEditClick={handleEditEntry}
                      onDeleteClick={handleDeleteEntry}
                      onDeleteDayClick={handleDeleteDayClick}
                    />
                  ) : (
                    <DiaryTable
                      entries={entries}
                      onAddClick={() => {
                        setEditingEntry(null);
                        setIsEntryModalOpen(true);
                      }}
                      onEditClick={handleEditEntry}
                      onDeleteClick={handleDeleteEntry}
                      onDeleteDayClick={handleDeleteDayClick}
                    />
                  )}
                </div>
              </>
            )}

            {activeTab === 'charts' && (
              <MonthlyCharts entries={entries} />
            )}

            {activeTab === 'report' && (
              <DoctorReportPdf
                entries={entries}
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
              />
            )}
          </>
        )}
      </main>

      {/* Плавающая кнопка быстрого добавления (FAB) для мобильных телефонов */}
      <button
        onClick={() => {
          setEditingEntry(null);
          setIsEntryModalOpen(true);
        }}
        className="print:hidden md:hidden fixed right-5 bottom-6 z-40 w-14 h-14 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-500 active:scale-90 text-white shadow-xl shadow-teal-500/35 border border-white/20 flex items-center justify-center transition-transform cursor-pointer"
        aria-label="Быстро добавить замер"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Модальное окно добавления/редактирования записи */}
      <EntryModal
        isOpen={isEntryModalOpen}
        onClose={() => {
          setIsEntryModalOpen(false);
          setEditingEntry(null);
        }}
        onSave={handleSaveEntry}
        initialEntry={editingEntry}
        xeRatio={settings.xeRatio}
      />

      {/* Модальное окно настроек */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        entries={entries}
        onImportData={async (imported) => {
          setEntries(imported);
          await api.importEntries(imported, false);
        }}
        onOpenExcelImport={() => setIsExcelModalOpen(true)}
        onResetToSample={handleResetToSample}
        onClearAll={handleClearAll}
      />

      {/* Модальное окно импорта из Excel */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImport={handleExcelImport}
        xeRatio={settings.xeRatio}
      />

      {/* Модальное окно подтверждения удаления целого дня */}
      <ConfirmDeleteDayModal
        isOpen={!!dayToDelete}
        onClose={() => setDayToDelete(null)}
        onConfirm={handleConfirmDeleteDay}
        date={dayToDelete?.date || ''}
        count={dayToDelete?.count || 0}
      />

      {/* Модальное окно правовой информации и политики 152-ФЗ */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        defaultTab={privacyModalTab}
      />

      {/* Уведомление об использовании Cookie и LocalStorage (152-ФЗ) */}
      <CookieBanner onOpenPolicy={() => handleOpenPolicy('policy')} />

      {/* Подвал сайта */}
      <Footer
        onOpenPolicy={() => handleOpenPolicy('policy')}
        onOpenMedical={() => handleOpenPolicy('medical')}
      />
    </div>
  );
}
