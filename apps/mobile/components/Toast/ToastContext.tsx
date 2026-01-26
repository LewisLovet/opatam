/**
 * ToastContext
 * Global toast management with useToast hook
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Toast, ToastVariant } from './Toast';

interface ToastConfig {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastState extends ToastConfig {
  id: number;
  visible: boolean;
}

interface ToastProviderProps {
  children: ReactNode;
}

let toastIdCounter = 0;

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((config: ToastConfig) => {
    const id = ++toastIdCounter;
    setToast({
      id,
      message: config.message,
      variant: config.variant ?? 'info',
      duration: config.duration ?? 3000,
      visible: true,
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setToast((current) => {
      if (current) {
        return { ...current, visible: false };
      }
      return null;
    });
    // Clear toast after animation
    setTimeout(() => {
      setToast(null);
    }, 350);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          variant={toast.variant}
          duration={toast.duration}
          visible={toast.visible}
          onDismiss={handleDismiss}
        />
      )}
    </ToastContext.Provider>
  );
}

/**
 * Hook to show toasts from anywhere in the app
 *
 * @example
 * const { showToast } = useToast();
 * showToast({ message: 'Success!', variant: 'success' });
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
