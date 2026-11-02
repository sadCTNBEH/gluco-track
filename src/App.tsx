/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DiaryEntry, UserSettings } from './types/diabetes';
import { DEFAULT_SETTINGS, calculateMonthlyStats, evaluateGlucose } from './utils/diabetes';
import { generateSampleData } from './data/sampleData';
import { Header, ActiveTab, ViewMode } from './components/Header';
import { DiaryTable } from './components/DiaryTable';
import { MobileCardView } from './components/MobileCardView';
import { MonthlyCharts } from './components/MonthlyCharts';
import { DoctorReportPdf } from './components/DoctorReportPdf';
import { EntryModal } from './components/EntryModal';
import { SettingsModal } from './components/SettingsModal';
import { Plus, HeartPulse, ShieldCheck, Activity, Award } from 'lucide-react';

const STORAGE_KEY_ENTRIES = 'diabetes_diary_entries_v1';
const STORAGE_KEY_SETTINGS = 'diabetes_diary_settings_v1';

export default function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ENTRIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load diary entries from localStorage', e);
    }
    // Если пусто — инициализируем реалистичными демонстрационными данными
    return generateSampleData();
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return DEFAULT_SETTINGS;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('table');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Сохранение в LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
    } catch (e) {
      console.error('Failed to save entries to localStorage', e);
    }
  }, [entries]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  }, [settings]);

  // Добавление или сохранение записи
  const handleSaveEntry = (data: Omit<DiaryEntry, 'id' | 'createdAt'> & { id?: string }) => {
    if (data.id) {
      // Обновление существующей записи
      setEntries((prev) =>
        prev.map((item) =>
          item.id === data.id
            ? { ...item, ...data, id: data.id }
            : item
        )
      );
    } else {
      // Создание новой записи
      const newEntry: DiaryEntry = {
        ...data,
        id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: Date.now(),
      };
      setEntries((prev) => [newEntry, ...prev]);
    }
  };

  const handleEditEntry = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setIsEntryModalOpen(true);
  };

  const handleDeleteEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleResetToSample = () => {
    const samples = generateSampleData();
    setEntries(samples);
  };

  const handleClearAll = () => {
    setEntries([]);
  };

  // Метрики последних 7 дней для быстрой полосы статуса
  const recentStats = calculateMonthlyStats(entries);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors flex flex-col">
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
        entriesCount={entries.length}
      />

      {/* Быстрая информационная плашка состояния (скрывается при печати) */}
      <div className="print:hidden bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800/80 py-2.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Пациент: <strong>{settings.patientName}</strong></span>
            </div>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
              <span>Цель гликемии: <strong>{settings.targetLow} – {settings.targetHigh} ммоль/л</strong></span>
            </div>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
            <div className="hidden md:flex items-center gap-1.5 text-slate-500">
              <span>ХЕ: <strong>1 ХЕ = {settings.xeRatio} г углеводов</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {recentStats.avgGlucose !== null && (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                <span>Ср. сахар месяца:</span>
                <strong className="text-teal-600 dark:text-teal-400 font-mono">
                  {recentStats.avgGlucose} ммоль/л
                </strong>
              </div>
            )}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 font-medium">
              <Award className="w-3.5 h-3.5" />
              <span>TIR: <strong>{recentStats.tir.normalPercent}% в норме</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'table' && (
          <>
            {/* На десктопе всегда таблица. На мобильном - выбор между карточками и компактной таблицей */}
            <div className="hidden md:block">
              <DiaryTable
                entries={entries}
                onAddClick={() => {
                  setEditingEntry(null);
                  setIsEntryModalOpen(true);
                }}
                onEditClick={handleEditEntry}
                onDeleteClick={handleDeleteEntry}
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
            onUpdateSettings={setSettings}
          />
        )}
      </main>

      {/* Плавающая кнопка быстрого добавления (FAB) для мобильных телефонов */}
      <button
        onClick={() => {
          setEditingEntry(null);
          setIsEntryModalOpen(true);
        }}
        className="print:hidden md:hidden fixed right-5 bottom-6 z-40 w-14 h-14 rounded-full bg-teal-600 active:bg-teal-700 text-white shadow-xl shadow-teal-600/40 flex items-center justify-center transition-transform active:scale-95"
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
        onUpdateSettings={setSettings}
        entries={entries}
        onImportData={setEntries}
        onResetToSample={handleResetToSample}
        onClearAll={handleClearAll}
      />
    </div>
  );
}
