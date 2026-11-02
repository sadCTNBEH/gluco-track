/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header, ActiveTab, ViewMode } from './components/Header';
import { DiaryTable } from './components/DiaryTable';
import { MobileCardView } from './components/MobileCardView';
import { EntryModal } from './components/EntryModal';
import { AuthScreen } from './components/AuthScreen';
import { ConfirmDeleteDayModal } from './components/ConfirmDeleteDayModal';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ToastProvider } from './components/ui/Toast';
import { CookieBanner } from './components/CookieBanner';
import { Footer } from './components/Footer';
import { TelemetryBar } from './components/TelemetryBar';
import { Theme, getInitialTheme, applyTheme } from './utils/theme';
import { api, AuthUser } from './api/client';
import { DraftDiaryEntry } from './types/diabetes';
import { Plus, Loader2 } from 'lucide-react';
import { clearUserStorage } from './utils/userStorage';
import { SyncStatusBanner } from './components/SyncStatusBanner';
import { useModalState } from './hooks/useModalState';
import { useDiaryData } from './hooks/useDiaryData';
import { useLegacyMigration } from './hooks/useLegacyMigration';

// Ленивая загрузка тяжёлых модальных окон и второстепенных вкладок (Code Splitting)
const SettingsModal = React.lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const ExcelImportModal = React.lazy(() =>
  import('./components/ExcelImportModal').then((m) => ({ default: m.ExcelImportModal }))
);
const PrivacyPolicyModal = React.lazy(() =>
  import('./components/PrivacyPolicyModal').then((m) => ({ default: m.PrivacyPolicyModal }))
);
const LegacyDataMigrationModal = React.lazy(() =>
  import('./components/LegacyDataMigrationModal').then((m) => ({ default: m.LegacyDataMigrationModal }))
);
const DoctorReportPdf = React.lazy(() =>
  import('./components/DoctorReportPdf').then((m) => ({ default: m.DoctorReportPdf }))
);
const MonthlyCharts = React.lazy(() =>
  import('./components/MonthlyCharts').then((m) => ({ default: m.MonthlyCharts }))
);

/**
 * Главный корневой компонент GlucoTrack Pro.
 * Выполняет роль чистого UI-компоновщика: координирует авторизацию,
 * темы оформления, специализированные хуки (данные, модальные окна, миграция)
 * и разметку адаптивного интерфейса.
 */
export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Применяем тему оформления при монтировании и изменении
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Хуки предметных областей
  const modals = useModalState();
  const diary = useDiaryData(user);
  const legacy = useLegacyMigration({
    user,
    loadingData: diary.loadingData,
    entries: diary.entries,
    importEntries: diary.importEntries,
  });

  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  // Первоначальная проверка активной сессии
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const res = await api.getMe();
        if (isMounted) {
          if (res?.user) {
            setUser(res.user);
            await diary.loadUserData(res.user);
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
  }, [diary.loadUserData]);

  // Выход из системы с безопасной очисткой пользовательского кэша (SEC-01)
  const handleConfirmLogout = async () => {
    const loggingOutUserId = user?.id;

    // 1. Очищаем состояние и отменяем асинхронные запросы
    diary.resetUserData();
    setUser(null);
    legacy.resetLegacy();
    modals.closeAll();
    setIsLogoutConfirmOpen(false);

    // 2. Очищаем чувствительные медицинские данные пользователя из localStorage
    if (loggingOutUserId) {
      clearUserStorage(loggingOutUserId);
    }

    // 3. Отзываем сессию на сервере и удаляем токен
    try {
      await api.logout();
    } catch (err) {
      console.error('Ошибка при выходе на сервере:', err);
    }
  };

  // Сохранение записи с криптографически стойким UUID (SEC-11)
  const handleSaveEntry = async (data: DraftDiaryEntry) => {
    const entryData = data.id ? data : { ...data, id: crypto.randomUUID() };
    await diary.handleSaveEntry(entryData);
  };

  // Подтверждение удаления всех записей за выбранный день
  const handleConfirmDeleteDay = async () => {
    if (!modals.dayToDelete) return;
    const targetDate = modals.dayToDelete.date;
    modals.closeDeleteDay();
    await diary.deleteDay(targetDate);
  };

  // Индикатор начальной загрузки сессии
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
        <p className="text-xs text-slate-400">Загрузка дневника...</p>
      </div>
    );
  }

  // Экран аутентификации для неавторизованных пользователей
  if (!user) {
    return (
      <>
        <AuthScreen
          onSuccess={(authData) => {
            setUser(authData.user);
            diary.loadUserData(authData.user);
          }}
          onOpenPolicy={modals.openPrivacyModal}
        />
        <React.Suspense fallback={null}>
          {modals.isPrivacyModalOpen && (
            <PrivacyPolicyModal
              isOpen={modals.isPrivacyModalOpen}
              onClose={modals.closePrivacyModal}
              defaultTab={modals.privacyModalTab}
            />
          )}
        </React.Suspense>
        <CookieBanner onOpenPolicy={() => modals.openPrivacyModal('policy')} />
      </>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 flex flex-col selection:bg-teal-500/20 selection:text-teal-900 dark:selection:text-teal-200">
      {/* Шапка приложения */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddClick={modals.openCreateEntry}
        onSettingsClick={modals.openSettings}
        onLogout={() => setIsLogoutConfirmOpen(true)}
        username={user.username}
        entriesCount={diary.entries.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Клинический телеметрический статус-бар */}
      <TelemetryBar
        entries={diary.entries}
        settings={diary.settings}
        patientName={diary.settings.patientName || user.username}
      />

      {/* Основной контент */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <SyncStatusBanner
          pendingCount={diary.pendingCount}
          syncError={diary.syncError}
          isSyncing={diary.isSyncing}
          onRetry={diary.retryPending}
          onDismissError={diary.clearSyncError}
        />

        {diary.loadingData && diary.entries.length === 0 ? (
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
                    entries={diary.entries}
                    bolusName={diary.settings.bolusName}
                    basalName={diary.settings.basalName}
                    settings={diary.settings}
                    onAddClick={modals.openCreateEntry}
                    onEditClick={modals.openEditEntry}
                    onDeleteClick={diary.handleDeleteEntry}
                    onDeleteDayClick={modals.openDeleteDay}
                  />
                </div>
                <div className="md:hidden">
                  {viewMode === 'cards' ? (
                    <MobileCardView
                      entries={diary.entries}
                      bolusName={diary.settings.bolusName}
                      basalName={diary.settings.basalName}
                      settings={diary.settings}
                      onAddClick={modals.openCreateEntry}
                      onEditClick={modals.openEditEntry}
                      onDeleteClick={diary.handleDeleteEntry}
                      onDeleteDayClick={modals.openDeleteDay}
                    />
                  ) : (
                    <DiaryTable
                      entries={diary.entries}
                      bolusName={diary.settings.bolusName}
                      basalName={diary.settings.basalName}
                      settings={diary.settings}
                      onAddClick={modals.openCreateEntry}
                      onEditClick={modals.openEditEntry}
                      onDeleteClick={diary.handleDeleteEntry}
                      onDeleteDayClick={modals.openDeleteDay}
                    />
                  )}
                </div>
              </>
            )}

            {activeTab === 'charts' && (
              <React.Suspense
                fallback={
                  <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <span>Загрузка аналитики...</span>
                  </div>
                }
              >
                <MonthlyCharts
                  entries={diary.entries}
                  bolusName={diary.settings.bolusName}
                  basalName={diary.settings.basalName}
                  settings={diary.settings}
                />
              </React.Suspense>
            )}

            {activeTab === 'report' && (
              <React.Suspense
                fallback={
                  <div className="p-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <span>Загрузка отчёта...</span>
                  </div>
                }
              >
                <DoctorReportPdf
                  entries={diary.entries}
                  settings={diary.settings}
                  onUpdateSettings={diary.handleUpdateSettings}
                />
              </React.Suspense>
            )}
          </>
        )}
      </main>

      {/* Плавающая кнопка быстрого добавления (FAB) для мобильных устройств */}
      <button
        type="button"
        onClick={modals.openCreateEntry}
        className="print:hidden md:hidden fixed right-5 bottom-6 z-40 w-14 h-14 rounded-full bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white shadow-lg border border-teal-500/30 flex items-center justify-center transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500"
        aria-label="Быстро добавить замер"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Модальное окно добавления/редактирования записи */}
      <EntryModal
        isOpen={modals.isEntryModalOpen}
        onClose={modals.closeEntryModal}
        onSave={handleSaveEntry}
        initialEntry={modals.editingEntry}
        xeRatio={diary.settings.xeRatio}
        bolusName={diary.settings.bolusName}
        basalName={diary.settings.basalName}
        settings={diary.settings}
      />

      {/* Модальное окно настроек */}
      <React.Suspense fallback={null}>
        {modals.isSettingsModalOpen && (
          <SettingsModal
            isOpen={modals.isSettingsModalOpen}
            onClose={modals.closeSettings}
            settings={diary.settings}
            onUpdateSettings={diary.handleUpdateSettings}
            entries={diary.entries}
            onImportData={async (imported) => {
              await diary.handleExcelImport(imported, false);
            }}
            onOpenExcelImport={modals.openExcelImport}
            onClearAll={diary.handleClearAll}
            onDeduplicate={diary.handleDeduplicate}
          />
        )}
      </React.Suspense>

      {/* Модальное окно импорта из Excel */}
      <React.Suspense fallback={null}>
        {modals.isExcelModalOpen && (
          <ExcelImportModal
            isOpen={modals.isExcelModalOpen}
            onClose={modals.closeExcelImport}
            onImport={diary.handleExcelImport}
            xeRatio={diary.settings.xeRatio}
          />
        )}
      </React.Suspense>

      {/* Модальное окно подтверждения удаления целого дня */}
      <ConfirmDeleteDayModal
        isOpen={!!modals.dayToDelete}
        onClose={modals.closeDeleteDay}
        onConfirm={handleConfirmDeleteDay}
        date={modals.dayToDelete?.date || ''}
        count={modals.dayToDelete?.count || 0}
      />

      {/* Модальное окно подтверждения выхода */}
      <ConfirmDialog
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={handleConfirmLogout}
        title="Выход из дневника"
        subtitle="Завершение текущей сессии"
        description="Вы уверены, что хотите выйти из дневника? Все данные сохранены на сервере и в защищенном локальном хранилище."
        confirmText="Выйти"
        cancelText="Отмена"
        isDestructive
        maxWidth="sm"
      />

      {/* Модальное окно правовой информации и политики 152-ФЗ */}
      <React.Suspense fallback={null}>
        {modals.isPrivacyModalOpen && (
          <PrivacyPolicyModal
            isOpen={modals.isPrivacyModalOpen}
            onClose={modals.closePrivacyModal}
            defaultTab={modals.privacyModalTab}
          />
        )}
      </React.Suspense>

      {/* Уведомление об использовании Cookie и LocalStorage (152-ФЗ) */}
      <CookieBanner onOpenPolicy={() => modals.openPrivacyModal('policy')} />

      {/* Модальное окно безопасной миграции старых локальных записей */}
      <React.Suspense fallback={null}>
        {legacy.legacyMigrationOpen && (
          <LegacyDataMigrationModal
            isOpen={legacy.legacyMigrationOpen}
            onClose={legacy.closeLegacyModal}
            username={user.username}
            legacyEntries={legacy.legacyEntriesToMigrate}
            legacySettings={legacy.legacySettingsToMigrate}
            onConfirmMigration={legacy.handleConfirmLegacyMigration}
            onDiscardLegacy={legacy.handleDiscardLegacy}
          />
        )}
      </React.Suspense>

      {/* Подвал сайта */}
      <Footer
        onOpenPolicy={() => modals.openPrivacyModal('policy')}
        onOpenMedical={() => modals.openPrivacyModal('medical')}
      />
    </div>
    </ToastProvider>
  );
}
