import React from 'react';
import {
  Activity,
  Table as TableIcon,
  TrendingUp,
  FileText,
  Settings,
  Plus,
  LayoutGrid,
  List,
} from 'lucide-react';

export type ActiveTab = 'table' | 'charts' | 'report';
export type ViewMode = 'table' | 'cards';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddClick: () => void;
  onSettingsClick: () => void;
  entriesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  onAddClick,
  onSettingsClick,
  entriesCount,
}) => {
  return (
    <header className="print:hidden sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate flex items-center gap-2">
                Дневник Диабета
                <span className="hidden md:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  РинФаст &amp; Тресиба
                </span>
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Учет глюкозы, углеводов, ХЕ, калорий и инсулинотерапии
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => onTabChange('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Дневник (Таблица)</span>
            </button>

            <button
              onClick={() => onTabChange('charts')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'charts'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Графики за месяц</span>
            </button>

            <button
              onClick={() => onTabChange('report')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'report'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Отчет для врача (PDF)</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            
            {/* Переключатель вида (Карточки / Таблица) при просмотре дневника */}
            {activeTab === 'table' && (
              <div className="flex md:hidden items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
                <button
                  onClick={() => onViewModeChange('cards')}
                  className={`p-1.5 rounded-lg ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-xs'
                      : 'text-slate-400'
                  }`}
                  title="Вид: Карточки"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onViewModeChange('table')}
                  className={`p-1.5 rounded-lg ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-xs'
                      : 'text-slate-400'
                  }`}
                  title="Вид: Таблица"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Настройки */}
            <button
              onClick={onSettingsClick}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Настройки и бэкап"
              aria-label="Настройки"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Главная кнопка Добавить */}
            <button
              onClick={onAddClick}
              className="px-3.5 sm:px-4 py-2 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/20 flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить замер</span>
              <span className="sm:hidden">Запись</span>
            </button>
          </div>

        </div>

        {/* Мобильная нижняя навигация (когда экран узкий) */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => onTabChange('table')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-bold transition ${
              activeTab === 'table'
                ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/40'
                : 'text-slate-500'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Дневник</span>
          </button>
          <button
            onClick={() => onTabChange('charts')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-bold transition ${
              activeTab === 'charts'
                ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/40'
                : 'text-slate-500'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Графики</span>
          </button>
          <button
            onClick={() => onTabChange('report')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-lg font-bold transition ${
              activeTab === 'report'
                ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/40'
                : 'text-slate-500'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Отчет PDF</span>
          </button>
        </div>

      </div>
    </header>
  );
};
