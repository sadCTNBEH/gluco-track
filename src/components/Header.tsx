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
  FileSpreadsheet,
  LogOut,
  User,
  Sun,
  Moon,
  Sparkles,
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
  onExcelImportClick: () => void;
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
  onExcelImportClick,
  onLogout,
  username,
  entriesCount,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header className="print:hidden sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-teal-500/25 group-hover:scale-105 transition-transform duration-200">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white truncate">
                  GlucoTrack <span className="text-teal-600 dark:text-teal-400">Pro</span>
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  РинФаст &amp; Тресиба
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden md:block">
                Клинический самоконтроль гликемии, доз инсулина и углеводов
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop & Tablet) */}
          <nav className="hidden md:flex items-center p-1 bg-slate-100/90 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/50 shadow-inner">
            <button
              onClick={() => onTabChange('table')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm shadow-slate-900/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Дневник</span>
              {entriesCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
                  {entriesCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('charts')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'charts'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm shadow-slate-900/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Аналитика</span>
            </button>

            <button
              onClick={() => onTabChange('report')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm shadow-slate-900/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Отчет PDF</span>
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            
            {/* Переключатель вида (Карточки / Таблица) на мобильных */}
            {activeTab === 'table' && (
              <div className="flex md:hidden items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl text-xs border border-slate-200/60 dark:border-slate-700/50">
                <button
                  onClick={() => onViewModeChange('cards')}
                  className={`p-1.5 rounded-lg transition-all ${
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
                  className={`p-1.5 rounded-lg transition-all ${
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

            {/* Импорт из Excel / CSV */}
            <button
              onClick={onExcelImportClick}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-97 transition cursor-pointer"
              title="Импорт записей из файла .xlsx или .csv"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Импорт Excel</span>
            </button>

            {/* Переключатель темы (Темная / Светлая) */}
            {onToggleTheme && (
              <button
                onClick={onToggleTheme}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
                title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на темную тему'}
                aria-label="Сменить тему оформления"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-500 transition-transform hover:-rotate-12" />
                )}
              </button>
            )}

            {/* Настройки */}
            <button
              onClick={onSettingsClick}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition cursor-pointer"
              title="Настройки параметров дневника"
              aria-label="Настройки"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Пользователь и Выход */}
            {username && (
              <div className="flex items-center gap-1 pl-1 border-l border-slate-200/80 dark:border-slate-800/80">
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/50">
                  <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span className="max-w-[100px] truncate">{username}</span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition cursor-pointer"
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
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-97 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-600/25 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить замер</span>
              <span className="sm:hidden">Замер</span>
            </button>
          </div>

        </div>

        {/* Мобильная нижняя навигация */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            onClick={() => onTabChange('table')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-xl font-bold transition-all ${
              activeTab === 'table'
                ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Дневник</span>
          </button>
          <button
            onClick={() => onTabChange('charts')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-xl font-bold transition-all ${
              activeTab === 'charts'
                ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Графики</span>
          </button>
          <button
            onClick={() => onTabChange('report')}
            className={`flex items-center gap-1.5 py-1 px-3 rounded-xl font-bold transition-all ${
              activeTab === 'report'
                ? 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Отчет PDF</span>
          </button>
          <button
            onClick={onExcelImportClick}
            className="flex items-center gap-1.5 py-1 px-3 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>

      </div>
    </header>
  );
};
