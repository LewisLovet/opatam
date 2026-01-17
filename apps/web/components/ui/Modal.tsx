'use client';

import {
  forwardRef,
  useEffect,
  useCallback,
  type HTMLAttributes,
  type ReactNode,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
}

interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {}

interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      closeOnOverlay = true,
      closeOnEscape = true,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const handleEscape = useCallback(
      (event: KeyboardEvent) => {
        if (closeOnEscape && event.key === 'Escape') {
          onClose();
        }
      },
      [closeOnEscape, onClose]
    );

    const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
      if (closeOnOverlay && event.target === event.currentTarget) {
        onClose();
      }
    };

    useEffect(() => {
      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    const modalContent = (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          ref={ref}
          className={`
            relative z-10 w-full max-w-lg
            bg-white dark:bg-gray-800
            rounded-xl shadow-xl
            transform transition-all
            max-h-[90vh] overflow-hidden flex flex-col
            ${className}
          `}
          {...props}
        >
          {children}
        </div>
      </div>
    );

    if (typeof window === 'undefined') return null;

    return createPortal(modalContent, document.body);
  }
);

Modal.displayName = 'Modal';

const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ title, onClose, showCloseButton = true, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          flex items-center justify-between gap-4
          px-6 py-4 border-b border-gray-100 dark:border-gray-700
          ${className}
        `}
        {...props}
      >
        {title ? (
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        ) : (
          children
        )}
        {showCloseButton && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="
              p-1 rounded-lg
              text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
              hover:bg-gray-100 dark:hover:bg-gray-700
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-primary-500
            "
            aria-label="Fermer"
          >
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

ModalHeader.displayName = 'ModalHeader';

const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          px-6 py-4 overflow-y-auto flex-1
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalBody.displayName = 'ModalBody';

const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          flex items-center justify-end gap-3
          px-6 py-4 border-t border-gray-100 dark:border-gray-700
          bg-gray-50 dark:bg-gray-800/50
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ModalFooter.displayName = 'ModalFooter';

export {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  type ModalProps,
  type ModalHeaderProps,
  type ModalBodyProps,
  type ModalFooterProps,
};
