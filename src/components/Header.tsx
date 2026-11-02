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
  LogOut,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { Theme } from '../utils/theme';

export type ActiveTab = 'table' | 'charts' | 'report';
export type ViewMode = 'table' | 'cards';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onAddClick: () => void;
  onSettingsClick: () => void;
  onLogout?: () => void;
  username?: string;
  entriesCount: number;
  theme?: Theme;
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  onAddClick,
  onSettingsClick,
  onLogout,
  username,
  entriesCount,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header className="print:hidden sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>

            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                GlucoTrack
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                Дневник самоконтроля
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              onClick={() => onTabChange('table')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Дневник</span>
              {entriesCount > 0 && (
                <span className="text-xs px-1.5 py-0.2 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  {entriesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('charts')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'charts'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Аналитика</span>
            </button>

            <button
              onClick={() => onTabChange('report')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Отчет для врача</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            
            {/* Переключатель вида (Карточки / Таблица) на мобильных */}
            {activeTab === 'table' && (
              <div className="flex md:hidden items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => onViewModeChange('cards')}
                  className={`p-1.5 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title="Вид: Карточки"
                  aria-label="Вид: Карточки"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onViewModeChange('table')}
                  className={`p-1.5 rounded-md transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                  title="Вид: Таблица"
                  aria-label="Вид: Таблица"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Переключатель темы (Темная / Светлая) */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
                aria-label="Сменить тему оформления"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>
            )}

            {/* Настройки */}
            <button
              onClick={onSettingsClick}
              className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Настройки параметров дневника"
              aria-label="Настройки"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Пользователь и Выход */}
            {username && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="max-w-[100px] truncate">{username}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                    title="Выйти из аккаунта"
                    aria-label="Выйти"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Главная кнопка Добавить */}
            <button
              onClick={onAddClick}
              className="h-10 min-h-[44px] px-3.5 sm:px-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить запись</span>
              <span className="sm:hidden">Запись</span>
            </button>
          </div>

        </div>

        {/* Мобильная нижняя навигация */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-200 dark:border-slate-800 text-xs">
          <button
            onClick={() => onTabChange('table')}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeTab === 'table'
                ? 'text-teal-700 dark:text-teal-300 bg-slate-100 dark:bg-slate-800'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <TableIcon className="w-4 h-4" />
            <span>Дневник</span>
          </button>
          <button
            onClick={() => onTabChange('charts')}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeTab === 'charts'
                ? 'text-teal-700 dark:text-teal-300 bg-slate-100 dark:bg-slate-800'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Аналитика</span>
          </button>
          <button
            onClick={() => onTabChange('report')}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-lg font-semibold transition-colors min-h-[44px] ${
              activeTab === 'report'
                ? 'text-teal-700 dark:text-teal-300 bg-slate-100 dark:bg-slate-800'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Отчет PDF</span>
          </button>
        </div>

      </div>
    </header>
  );
};
