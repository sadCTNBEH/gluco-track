import React, { useState } from 'react';
import {
  Activity,
  Lock,
  User,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api, AuthResponse } from '../api/client';
import { Button } from './ui/Button';

interface AuthScreenProps {
  onSuccess: (authData: AuthResponse) => void;
  onOpenPolicy: (tab?: 'policy' | 'medical') => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess, onOpenPolicy }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [patientName, setPatientName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister && !consentAccepted) {
      setError('Для создания аккаунта необходимо согласие на обработку данных (152-ФЗ РФ)');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        if (!username.trim() || username.trim().length < 3) {
          throw new Error('Логин должен содержать не менее 3 символов');
        }
        if (!password || password.length < 12) {
          throw new Error('Пароль должен содержать не менее 12 символов');
        }
        const data = await api.register(username.trim(), password, patientName.trim());
        onSuccess(data);
      } else {
        if (!username.trim() || !password) {
          throw new Error('Введите логин и пароль');
        }
        const data = await api.login(username.trim(), password);
        onSuccess(data);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Произошла ошибка при авторизации';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      <div className="w-full max-w-md my-auto">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 mb-3 shadow-xs">
            <Activity className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            GlucoTrack
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Клинический дневник самоконтроля
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm">
          
          {/* Segmented Control Tabs */}
          <div
            role="tablist"
            aria-label="Режим авторизации"
            className="flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-6 border border-slate-200 dark:border-slate-700/60"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors min-h-[38px] flex items-center justify-center cursor-pointer ${
                !isRegister
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors min-h-[38px] flex items-center justify-center cursor-pointer ${
                isRegister
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label
                htmlFor="auth-username"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Логин
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Логин"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            {/* Patient Name (registration only) */}
            {isRegister && (
              <div>
                <label
                  htmlFor="auth-patient-name"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  ФИО пациента <span className="text-slate-400 font-normal">(по желанию)</span>
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-patient-name"
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Например: Иванов Иван"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Пароль
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Минимум 12 знаков' : 'Ваш пароль'}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            {/* Consent checkbox for 152-ФЗ РФ */}
            {isRegister && (
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs select-none">
                  <input
                    type="checkbox"
                    required
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-teal-600 focus:ring-teal-500 accent-teal-600 shrink-0 cursor-pointer"
                  />
                  <span className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    Я подтверждаю согласие на обработку персональных данных (ст. 10 и ст. 12 152-ФЗ РФ) и принимаю{' '}
                    <button
                      type="button"
                      onClick={() => onOpenPolicy('policy')}
                      className="text-teal-600 dark:text-teal-400 hover:underline font-semibold cursor-pointer"
                    >
                      Политику конфиденциальности
                    </button>.
                  </span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={loading}
                className="w-full justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Проверка...</span>
                  </>
                ) : isRegister ? (
                  <>
                    <span>Создать аккаунт</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    <span>Войти в дневник</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Links */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            <button
              type="button"
              onClick={() => onOpenPolicy('policy')}
              className="hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
            >
              152-ФЗ Конфиденциальность
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => onOpenPolicy('medical')}
              className="hover:text-teal-600 dark:hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
            >
              Медицинский дисклеймер
            </button>
          </div>

        </div>

        <div className="mt-6 text-center text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          GlucoTrack © 2026 • Безопасный учет гликемии и инсулинотерапии
        </div>

      </div>
    </div>
  );
};
