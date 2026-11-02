import React, { useState } from 'react';
import { Activity, Lock, User, UserCheck, ShieldCheck, ArrowRight, Loader2, Database, AlertTriangle } from 'lucide-react';
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
      setError('Для регистрации необходимо подтвердить согласие на обработку персональных данных (152-ФЗ РФ)');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950 flex flex-col items-center justify-center p-4 sm:p-6 text-white font-sans">
      <div className="w-full max-w-md my-auto">
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-400 shadow-xl shadow-teal-500/20 mb-3">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1.5">
            Дневник Диабета
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            Индивидуальный самоконтроль глюкозы, дозировок РинФаст и Тресиба
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
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
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Вход в дневник
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegister(true);
                setError(null);
              }}
              className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                isRegister
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Регистрация
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Логин:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите логин"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                />
              </div>
            </div>

            {/* Patient Name (only registration) */}
            {isRegister && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ФИО / Имя пациента (по желанию):
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="Например: Иванов И.И."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Пароль:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Минимум 5 символов' : 'Ваш пароль'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition"
                />
              </div>
            </div>

            {/* Чекбокс согласия с 152-ФЗ РФ (только при регистрации) */}
            {isRegister && (
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300 select-none">
                  <input
                    type="checkbox"
                    required
                    checked={consentAccepted}
                    onChange={(e) => setConsentAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-950 text-teal-600 focus:ring-teal-500 accent-teal-600 shrink-0 cursor-pointer"
                  />
                  <span className="text-[11px] leading-relaxed text-slate-400">
                    Я подтверждаю свое согласие на обработку персональных данных, включая сведения о состоянии здоровья (152-ФЗ РФ), и принимаю{' '}
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
              className="w-full mt-2 py-3 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Подождите...</span>
                </>
              ) : isRegister ? (
                <>
                  <span>Создать аккаунт</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Войти</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Плашка соответствия 152-ФЗ и локализации РФ */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col gap-2 text-[11px] text-slate-500 text-center">
            <div className="flex items-center justify-center gap-1.5 text-slate-400">
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span>База данных расположена в РФ (ч. 5 ст. 18 152-ФЗ)</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onOpenPolicy('policy')}
                className="hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
              >
                Политика конфиденциальности
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => onOpenPolicy('medical')}
                className="hover:text-teal-400 underline underline-offset-2 transition cursor-pointer"
              >
                Отказ от ответственности
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Копирайт внизу экрана авторизации */}
      <div className="mt-4 text-center text-[11px] text-slate-600">
        Дневник Диабета &amp; Самоконтроля • Защищенное хранение данных по 152-ФЗ РФ
      </div>

    </div>
  );
};
