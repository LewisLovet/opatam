'use client';

import { forwardRef, type InputHTMLAttributes, useId } from 'react';

type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'url' | 'date' | 'time' | 'datetime-local';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType;
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ type = 'text', label, error, hint, disabled, className = '', id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : hint ? hintId : undefined}
          className={`
            w-full px-3 py-2 rounded-lg border text-base
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${
              hasError
                ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
                : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-error-600 dark:text-error-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, type InputProps, type InputType };
