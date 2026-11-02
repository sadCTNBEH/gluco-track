import React, { useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  isDestructive?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  children,
  confirmText,
  cancelText = 'Отмена',
  variant,
  isDestructive = false,
  isLoading: externalLoading = false,
  icon,
  maxWidth = 'md',
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = externalLoading || internalLoading;

  const isDanger = variant === 'danger' || isDestructive;
  const defaultConfirmText = isDanger ? 'Удалить' : 'Подтвердить';
  const effectiveConfirmText = confirmText || defaultConfirmText;

  const defaultIcon = isDanger ? (
    <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
  ) : (
    <HelpCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
  );

  const iconClassName = isDanger
    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
    : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800';

  const handleConfirm = async () => {
    if (loading) return;
    try {
      setInternalLoading(true);
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  const handleSafeClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleSafeClose}
      title={title}
      subtitle={subtitle}
      icon={icon || defaultIcon}
      iconClassName={iconClassName}
      maxWidth={maxWidth}
    >
      <div className="space-y-4 text-xs sm:text-sm">
        {description && (
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>
        )}
        {children}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={handleSafeClose}
            disabled={loading}
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={isDanger ? 'danger' : 'primary'}
            size="md"
            onClick={handleConfirm}
            disabled={loading}
            loading={loading}
          >
            {effectiveConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
