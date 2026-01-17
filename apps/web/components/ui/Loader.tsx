'use client';

import { forwardRef, type HTMLAttributes } from 'react';

type LoaderSize = 'sm' | 'md' | 'lg';

interface LoaderProps extends HTMLAttributes<HTMLDivElement> {
  size?: LoaderSize;
}

const sizeStyles: Record<LoaderSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-4',
};

const Loader = forwardRef<HTMLDivElement, LoaderProps>(
  ({ size = 'md', className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label="Chargement"
        className={`
          animate-spin rounded-full
          border-primary-200 dark:border-primary-800
          border-t-primary-600 dark:border-t-primary-400
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        <span className="sr-only">Chargement...</span>
      </div>
    );
  }
);

Loader.displayName = 'Loader';

export { Loader, type LoaderProps, type LoaderSize };
