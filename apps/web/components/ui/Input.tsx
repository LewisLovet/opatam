'use client';

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type MouseEventHandler,
  type ReactNode,
} from 'react';
import { Calendar, Clock } from 'lucide-react';
import { useNumberBuffer } from './useNumberBuffer';

type InputType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'url' | 'date' | 'time' | 'datetime-local';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  type?: InputType;
  label?: string;
  error?: string;
  hint?: string;
  /** Trailing adornment shown inside the field (e.g. "%", "€", "heures"). */
  suffix?: ReactNode;
  /**
   * Numeric mode. When `onNumericChange` is provided the field manages its own
   * text buffer so it can be left empty while editing (no sticky "0" that comes
   * back on clear), renders as `inputMode` text (no native spinner — far easier
   * to type, especially on mobile), and emits parsed numbers. `value`/`onChange`
   * are ignored in this mode — use `numericValue`/`onNumericChange`.
   */
  numericValue?: number;
  onNumericChange?: (value: number) => void;
  /** Allow a decimal part (prices). Default false → integers (%, minutes…). */
  decimal?: boolean;
  /** Value emitted when the field is left empty. Default 0. */
  emptyValue?: number;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      type = 'text',
      label,
      error,
      hint,
      suffix,
      disabled,
      className = '',
      id,
      onClick,
      numericValue,
      onNumericChange,
      decimal = false,
      emptyValue = 0,
      min,
      max,
      value,
      onChange,
      onBlur,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const hasError = !!error;

    // ── Numeric mode (buffered text input — see useNumberBuffer) ───────
    const numeric = typeof onNumericChange === 'function';
    const numProps = useNumberBuffer({
      value: numericValue ?? 0,
      onChange: onNumericChange ?? (() => {}),
      decimal,
      emptyValue,
      min,
      max,
    });

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

    // Horizontal padding: leave room on the right for the suffix / date icon.
    const suffixLen = suffix == null ? 0 : String(suffix).length;
    const padX = isDateTime
      ? 'pr-10'
      : suffix != null
        ? suffixLen <= 1
          ? 'pl-3 pr-8'
          : 'pl-3 pr-12'
        : 'px-3';

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
          type={numeric ? 'text' : type}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : hint ? hintId : undefined}
          onClick={isDateTime ? handleClick : onClick}
          {...(numeric
            ? {
                value: numProps.value,
                inputMode: numProps.inputMode,
                onChange: numProps.onChange,
                onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
                  numProps.onBlur();
                  onBlur?.(e);
                },
              }
            : { value, onChange, onBlur, min, max })}
          className={`
            w-full ${padX} py-2 rounded-lg border text-base
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 dark:disabled:bg-gray-900
            ${
              isDateTime
                ? 'appearance-none min-h-[2.625rem] cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-date-and-time-value]:text-left'
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
        {suffix != null && !isDateTime && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-gray-500">
            {suffix}
          </span>
        )}
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
