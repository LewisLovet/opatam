'use client';

import { forwardRef, type InputHTMLAttributes, type MouseEventHandler, useId } from 'react';
import { Calendar, Clock } from 'lucide-react';

type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'url' | 'date' | 'time' | 'datetime-local';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType;
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ type = 'text', label, error, hint, disabled, className = '', id, onClick, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const hasError = !!error;

    // Native date/time inputs are finicky on mobile (iOS): they have an
    // intrinsic min-width that ignores width:100% (overflow), collapse in
    // height, and give no obvious affordance once styled. We tame them:
    // appearance-none (no overflow), an explicit min-height, our own
    // calendar/clock icon, and open the OS picker on click via showPicker().
    const isDateTime =
      type === 'date' || type === 'time' || type === 'datetime-local';
    const DateIcon = type === 'time' ? Clock : Calendar;

    const handleClick: MouseEventHandler<HTMLInputElement> = (e) => {
      onClick?.(e);
      if (isDateTime && !disabled) {
        try {
          (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
        } catch {
          // showPicker is gesture-gated / unsupported on older browsers — the
          // input still works (type the value), so swallow.
        }
      }
    };

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
        <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : hint ? hintId : undefined}
          onClick={isDateTime ? handleClick : onClick}
          className={`
            w-full px-3 py-2 rounded-lg border text-base
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${
              isDateTime
                ? 'appearance-none min-h-[2.625rem] pr-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:text-left'
                : ''
            }
            ${
              hasError
                ? 'border-error-500 focus:border-error-500 focus:ring-error-500'
                : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-primary-500'
            }
            ${className}
          `}
          {...props}
        />
        {isDateTime && (
          <DateIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        )}
        </div>
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
