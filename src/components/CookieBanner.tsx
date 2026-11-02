import React, { useState, useEffect } from 'react';
import { Cookie, ShieldCheck } from 'lucide-react';
import { Button } from './ui/Button';

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
        const timer = setTimeout(() => setVisible(true), 500);
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
      <div className="bg-slate-900 text-white dark:bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl flex flex-col gap-3.5">
        
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-white text-xs flex items-center gap-1.5">
              <span>Файлы cookie и хранилище данных</span>
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            </p>
            <p className="text-[11px] leading-relaxed text-slate-300">
              Сервис использует файлы cookie и LocalStorage исключительно для безопасной сессии авторизации и надежного сохранения замеров в соответствии с{' '}
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

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onOpenPolicy}
            className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[38px] flex items-center"
          >
            Подробнее
          </button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAccept}
          >
            Принять и продолжить
          </Button>
        </div>

      </div>
    </aside>
  );
};
