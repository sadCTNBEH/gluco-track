import React, { useState } from 'react';
import {
  Activity,
  Lock,
  User,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Database,
  Sparkles,
  Server,
  KeyRound,
} from 'lucide-react';
import { api, AuthResponse } from '../api/client';

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
        if (!password || password.length < 5) {
          throw new Error('Пароль должен содержать не менее 5 символов');
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
    } catch (err: any) {
      setError(err?.message || 'Произошла ошибка при авторизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      
      {/* Фоновые градиентные сферы для глубины */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md my-auto relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-400 text-white shadow-xl shadow-teal-500/25 mb-4 border border-teal-400/30">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1.5 flex items-center justify-center gap-2">
            GlucoTrack <span className="text-teal-400">Pro</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
            Клинический дневник самоконтроля: глюкоза, РинФаст, Тресиба и ХЕ
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/85 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          
          {/* Tabs */}
          <div className="flex bg-slate-950/80 p-1 rounded-2xl mb-6 border border-slate-800/80">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                !isRegister
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                isRegister
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 animate-ping" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Логин
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Придумайте логин"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                />
              </div>
            </div>

            {/* Patient Name (registration only) */}
            {isRegister && (
              <div className="animate-fadeIn">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  ФИО пациента (по желанию)
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Например: Иванов Иван"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Минимум 5 знаков' : 'Ваш пароль'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-2xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition"
                />
              </div>
            </div>

            {/* Consent checkbox for 152-ФЗ РФ */}
            {isRegister && (
              <div className="pt-1 animate-fadeIn">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
                  <input
                    type="checkbox"
                    required
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-950 text-teal-600 focus:ring-teal-500 accent-teal-600 shrink-0 cursor-pointer"
                  />
                  <span className="text-[11px] leading-relaxed text-slate-400">
                    Я подтверждаю согласие на обработку персональных данных и трансграничную передачу на сервер в Нидерландах (ст. 10 и ст. 12 152-ФЗ РФ), и принимаю{' '}
                    <button
                      type="button"
                      onClick={() => onOpenPolicy('policy')}
                      className="text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer"
                    >
                      Политику конфиденциальности
                    </button>.
                  </span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all cursor-pointer"
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
            </button>
          </form>

          {/* Trust badges */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col gap-2.5 text-[11px] text-slate-500 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 font-medium">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span>Сервер в Нидерландах • БД SQLite • Бэкап 00:00 МСК</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onOpenPolicy('policy')}
                className="hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
              >
                152-ФЗ Конфиденциальность
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => onOpenPolicy('medical')}
                className="hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
              >
                Медицинский отказ
              </button>
            </div>
          </div>

        </div>

      </div>

      <div className="mt-6 text-center text-[11px] text-slate-500 relative z-10 font-mono">
        GlucoTrack Pro © 2026 • Безопасный учет гликемии и инсулинотерапии
      </div>

    </div>
  );
};
