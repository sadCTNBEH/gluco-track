import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: React.ReactNode;
  duration?: number;
  createdAt: number;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (type: ToastType, message: React.ReactNode, options?: ToastOptions) => string;
  removeToast: (id: string) => void;
  success: (message: React.ReactNode, options?: ToastOptions) => string;
  error: (message: React.ReactNode, options?: ToastOptions) => string;
  warning: (message: React.ReactNode, options?: ToastOptions) => string;
  info: (message: React.ReactNode, options?: ToastOptions) => string;
}

const defaultToastContext: ToastContextValue = {
  toasts: [],
  addToast: () => '',
  removeToast: () => {},
  success: () => '',
  error: () => '',
  warning: () => '',
  info: () => '',
};

export const ToastContext = createContext<ToastContextValue>(defaultToastContext);

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 8000,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: React.ReactNode, options?: ToastOptions): string => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const duration = options?.duration !== undefined ? options.duration : DEFAULT_DURATIONS[type];

      const newItem: ToastItem = {
        id,
        type,
        title: options?.title,
        message,
        duration,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev, newItem]);
      return id;
    },
    []
  );

  const success = useCallback(
    (message: React.ReactNode, options?: ToastOptions) => addToast('success', message, options),
    [addToast]
  );
  const error = useCallback(
    (message: React.ReactNode, options?: ToastOptions) => addToast('error', message, options),
    [addToast]
  );
  const warning = useCallback(
    (message: React.ReactNode, options?: ToastOptions) => addToast('warning', message, options),
    [addToast]
  );
  const info = useCallback(
    (message: React.ReactNode, options?: ToastOptions) => addToast('info', message, options),
    [addToast]
  );

  const contextValue: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-4 sm:px-0 pointer-events-none"
      role="region"
      aria-label="Уведомления приложения"
    >
      {toasts.map((toast) => (
        <ToastSingle key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

export const ToastSingle: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const config = {
    success: {
      container:
        'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
      closeHover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300',
      role: 'status',
    },
    error: {
      container:
        'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100 shadow-rose-900/10',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />,
      closeHover: 'hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-300',
      role: 'alert',
    },
    warning: {
      container:
        'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />,
      closeHover: 'hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-600 dark:text-amber-300',
      role: 'alert',
    },
    info: {
      container:
        'bg-teal-50 dark:bg-teal-950/90 border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-100',
      icon: <Info className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />,
      closeHover: 'hover:bg-teal-100 dark:hover:bg-teal-900/50 text-teal-600 dark:text-teal-300',
      role: 'status',
    },
  }[toast.type];

  return (
    <div
      role={config.role}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto w-full p-3.5 sm:p-4 rounded-xl border shadow-lg flex items-start gap-3 transition duration-200 animate-fadeIn ${config.container}`}
    >
      <div className="pt-0.5">{config.icon}</div>
      <div className="flex-1 min-w-0 text-xs sm:text-sm">
        {toast.title && <div className="font-semibold mb-0.5">{toast.title}</div>}
        <div className="leading-snug break-words">{toast.message}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={`p-1 rounded-lg transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center shrink-0 ${config.closeHover}`}
        aria-label="Закрыть уведомление"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
