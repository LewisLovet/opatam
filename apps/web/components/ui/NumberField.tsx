'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { useNumberBuffer } from './useNumberBuffer';

interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Allow a decimal part (prices). Default false → integers. */
  decimal?: boolean;
  /** Value emitted when the field is left empty. Default 0. */
  emptyValue?: number;
}

/**
 * Bare numeric `<input>` (no label/border chrome) for compact, inline contexts
 * like the variation/option editors. Same buffered behaviour as `Input`'s
 * numeric mode (empty-able, no spinner, blur-clamped) — pass your own
 * `className` for styling.
 */
const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ value, onChange, min, max, decimal = false, emptyValue = 0, onBlur, ...props }, ref) => {
    const num = useNumberBuffer({ value, onChange, decimal, emptyValue, min, max });
    return (
      <input
        ref={ref}
        type="text"
        value={num.value}
        inputMode={num.inputMode}
        onChange={num.onChange}
        onBlur={(e) => {
          num.onBlur();
          onBlur?.(e);
        }}
        {...props}
      />
    );
  }
);

NumberField.displayName = 'NumberField';

export { NumberField, type NumberFieldProps };
