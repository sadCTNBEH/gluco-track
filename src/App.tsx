/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DiaryEntry, UserSettings } from './types/diabetes';
import { DEFAULT_SETTINGS, calculateMonthlyStats } from './utils/diabetes';
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
import { Plus, Loader2 } from 'lucide-react';
import {
  getUserCachedEntries,
  setUserCachedEntries,
  removeUserCachedEntries,
  getUserCachedSettings,
  setUserCachedSettings,
  clearUserStorage,
  getLegacyUnmigratedEntries,
  getLegacyUnmigratedSettings,
  cleanupLegacyStorage,
} from './utils/userStorage';
import { LegacyDataMigrationModal } from './components/LegacyDataMigrationModal';

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Ссылки для предотвращения race condition при смене пользователей и выходе
  const currentUserIdRef = useRef<string | null>(null);
  const loadRequestIdRef = useRef<number>(0);

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

  // Состояние безопасной миграции устаревшего общего кэша (версии 1.0)
  const [legacyMigrationOpen, setLegacyMigrationOpen] = useState(false);
  const [legacyEntriesToMigrate, setLegacyEntriesToMigrate] = useState<DiaryEntry[]>([]);
  const [legacySettingsToMigrate, setLegacySettingsToMigrate] = useState<Partial<UserSettings> | null>(null);

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

  // Загрузка данных пользователя (Сервер — основной источник истины)
  const loadUserData = useCallback(async (targetUser: AuthUser) => {
    const targetUserId = targetUser.id;
    currentUserIdRef.current = targetUserId;
    const currentRequestId = ++loadRequestIdRef.current;

    setLoadingData(true);
    try {
      const [serverEntries, serverSettings] = await Promise.all([
        api.getEntries(),
        api.getSettings(),
      ]);

      // Защита от race condition: если во время загрузки пользователь сменился или вышел
      if (currentRequestId !== loadRequestIdRef.current || currentUserIdRef.current !== targetUserId) {
        return;
      }

      // 1. Серверные настройки — источник истины
      if (serverSettings) {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...serverSettings };
        setSettings(mergedSettings);
        setUserCachedSettings(targetUserId, mergedSettings);
      }

      // 2. Серверные записи — источник истины
      const validEntries = Array.isArray(serverEntries) ? serverEntries : [];
      setEntries(validEntries);
      setUserCachedEntries(targetUserId, validEntries);

      // 3. Проверка наличия немигрированного старого локального кэша (без автоимпорта!)
      const unmigrated = getLegacyUnmigratedEntries();
      if (unmigrated.length > 0) {
        setLegacyEntriesToMigrate(unmigrated);
        setLegacySettingsToMigrate(getLegacyUnmigratedSettings());
        setLegacyMigrationOpen(true);
      }
    } catch (err) {
      // Защита от race condition
      if (currentRequestId !== loadRequestIdRef.current || currentUserIdRef.current !== targetUserId) {
        return;
      }
      console.error('Ошибка загрузки данных с сервера:', err);

      // При ошибке сети изолированный fallback ТОЛЬКО на локальный кэш текущего пользователя
      const userEntriesCache = getUserCachedEntries(targetUserId);
      const userSettingsCache = getUserCachedSettings(targetUserId);

      setEntries(userEntriesCache);
      if (userSettingsCache) {
        setSettings({ ...DEFAULT_SETTINGS, ...userSettingsCache });
      }
    } finally {
      if (currentRequestId === loadRequestIdRef.current && currentUserIdRef.current === targetUserId) {
        setLoadingData(false);
      }
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
            await loadUserData(res.user);
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

  // Кэширование в LocalStorage для оффлайн-доступа строго по user.id
  useEffect(() => {
    if (user?.id) {
      setUserCachedEntries(user.id, entries);
    }
  }, [entries, user]);

  useEffect(() => {
    if (user?.id) {
      setUserCachedSettings(user.id, settings);
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
      // Создание новой записи с криптографически безопасным UUID (SEC-11)
      const tempId = crypto.randomUUID();
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

  const handleClearAll = async () => {
    if (!user) return;
    setEntries([]);
    removeUserCachedEntries(user.id);
    try {
      await api.clearEntries();
    } catch (err) {
      console.error('Ошибка очистки на сервере:', err);
    }
  };

  const handleUpdateSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    if (user?.id) {
      setUserCachedSettings(user.id, newSettings);
    }
    try {
      await api.updateSettings(newSettings);
    } catch (err) {
      console.error('Ошибка обновления настроек на сервере:', err);
    }
  };

  // Импорт из файла Excel
  const handleExcelImport = async (importedEntries: DiaryEntry[], replaceAll: boolean) => {
    const updatedEntries = replaceAll ? importedEntries : [...importedEntries, ...entries];
    setEntries(updatedEntries);
    if (user?.id) {
      setUserCachedEntries(user.id, updatedEntries);
    }
    await api.importEntries(importedEntries, replaceAll);
  };

  // Подтвержденная пользователем безопасная миграция старых записей
  const handleConfirmLegacyMigration = async () => {
    if (!user || legacyEntriesToMigrate.length === 0) return;
    const toMigrate = [...legacyEntriesToMigrate];
    const updated = [...toMigrate, ...entries];
    setEntries(updated);
    if (user.id) {
      setUserCachedEntries(user.id, updated);
    }
    cleanupLegacyStorage();
    setLegacyEntriesToMigrate([]);
    setLegacySettingsToMigrate(null);
    try {
      await api.importEntries(toMigrate, false);
    } catch (err) {
      console.error('Ошибка импорта мигрированных записей на сервер:', err);
    }
  };

  // Отклонение и удаление старого кэша
  const handleDiscardLegacy = () => {
    cleanupLegacyStorage();
    setLegacyEntriesToMigrate([]);
    setLegacySettingsToMigrate(null);
  };

  // Выход из системы
  const handleLogout = async () => {
    if (confirm('Выйти из дневника?')) {
      const loggingOutUserId = user?.id;

      // 1. Отменяем любые выполняющиеся асинхронные запросы
      loadRequestIdRef.current++;
      currentUserIdRef.current = null;

      // 2. Очищаем состояние в памяти
      setUser(null);
      setEntries([]);
      setSettings(DEFAULT_SETTINGS);
      setLegacyMigrationOpen(false);
      setLegacyEntriesToMigrate([]);
      setLegacySettingsToMigrate(null);

      // 3. Очищаем чувствительные данные пользователя из локального хранилища
      if (loggingOutUserId) {
        clearUserStorage(loggingOutUserId);
      }

      // 4. Отзываем сессию на сервере и удаляем токен
      try {
        await api.logout();
      } catch (err) {
        console.error('Ошибка при выходе на сервере:', err);
      }
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
            loadUserData(authData.user);
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
  const recentStats = calculateMonthlyStats(entries, undefined, settings);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 flex flex-col selection:bg-teal-500/20 selection:text-teal-900 dark:selection:text-teal-200">
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
                    bolusName={settings.bolusName}
                    basalName={settings.basalName}
                    settings={settings}
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
                      bolusName={settings.bolusName}
                      basalName={settings.basalName}
                      settings={settings}
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
                      bolusName={settings.bolusName}
                      basalName={settings.basalName}
                      settings={settings}
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
              <MonthlyCharts
                entries={entries}
                bolusName={settings.bolusName}
                basalName={settings.basalName}
                settings={settings}
              />
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
        type="button"
        onClick={() => {
          setEditingEntry(null);
          setIsEntryModalOpen(true);
        }}
        className="print:hidden md:hidden fixed right-5 bottom-6 z-40 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-lg border border-teal-500/30 flex items-center justify-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        aria-label="Быстро добавить замер"
      >
        <Plus className="w-6 h-6" />
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
        bolusName={settings.bolusName}
        basalName={settings.basalName}
        settings={settings}
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

      {/* Модальное окно безопасной миграции старых локальных записей */}
      <LegacyDataMigrationModal
        isOpen={legacyMigrationOpen}
        onClose={() => setLegacyMigrationOpen(false)}
        username={user.username}
        legacyEntries={legacyEntriesToMigrate}
        legacySettings={legacySettingsToMigrate}
        onConfirmMigration={handleConfirmLegacyMigration}
        onDiscardLegacy={handleDiscardLegacy}
      />

      {/* Подвал сайта */}
      <Footer
        onOpenPolicy={() => handleOpenPolicy('policy')}
        onOpenMedical={() => handleOpenPolicy('medical')}
      />
    </div>
  );
}
