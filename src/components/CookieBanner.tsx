import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck, X } from 'lucide-react';

interface CookieBannerProps {
  onOpenPolicy: () => void;
}

const STORAGE_KEY = 'cookie_consent_accepted_v1';

export const CookieBanner: React.FC<CookieBannerProps> = ({ onOpenPolicy }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) {
        // Небольшая задержка для плавного появления
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {
      setVisible(false);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      aria-label="Уведомление об использовании файлов cookie"
      className="print:hidden fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-fadeIn"
    >
      <div className="bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col gap-3">
        
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs text-slate-300">
            <p className="font-bold text-white text-xs flex items-center gap-1.5">
              <span>Файлы cookie и локальное хранилище</span>
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            </p>
            <p className="text-[11px] leading-relaxed text-slate-400">
              Этот сайт использует файлы cookie и LocalStorage исключительно для поддержания защищенной сессии авторизации и надежного сохранения замеров в соответствии с{' '}
              <button
                type="button"
                onClick={onOpenPolicy}
                className="text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer"
              >
                152-ФЗ РФ
              </button>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={onOpenPolicy}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            Подробнее
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="px-4 py-1.5 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Принять и продолжить
          </button>
        </div>

      </div>
    </aside>
  );
};
