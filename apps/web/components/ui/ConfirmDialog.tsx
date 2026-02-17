'use client';

import { type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { Button } from './Button';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'warning';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  loading = false,
  variant = 'danger',
}: ConfirmDialogProps) {
  const isDanger = variant === 'danger';

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm">
      <ModalHeader title={title} onClose={onClose} />

      <ModalBody>
        <div className="flex gap-3">
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            ${isDanger
              ? 'bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400'
              : 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400'}
          `}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 pt-2">
            {message}
          </p>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onConfirm}
          disabled={loading}
          className={isDanger
            ? 'bg-error-600 hover:bg-error-700 focus:ring-error-500 dark:bg-error-600 dark:hover:bg-error-700'
            : 'bg-warning-600 hover:bg-warning-700 focus:ring-warning-500 dark:bg-warning-600 dark:hover:bg-warning-700'}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {confirmLabel}
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export type { ConfirmDialogProps };
