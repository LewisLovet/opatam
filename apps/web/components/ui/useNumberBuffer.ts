'use client';

import { useEffect, useState, type ChangeEvent } from 'react';

/**
 * Buffered numeric input behaviour, shared by `Input` (numeric mode) and the
 * bare `NumberField`. Keeps a local text buffer so the field can be left empty
 * while editing — no sticky "0" that reappears on clear — and only emits parsed
 * numbers. Clamping to min/max happens on blur, never mid-keystroke, so the
 * value never fights the user. Returns props to spread onto a text `<input>`.
 */
export function useNumberBuffer(opts: {
  value: number;
  onChange: (value: number) => void;
  decimal?: boolean;
  emptyValue?: number;
  min?: number | string;
  max?: number | string;
}) {
  const { value, onChange, decimal = false, emptyValue = 0, min, max } = opts;

  const parse = (s: string): number => {
    const t = s.trim();
    if (t === '') return emptyValue;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : emptyValue;
  };
  const toText = (n: number) => (n === emptyValue ? '' : String(n));

  const [text, setText] = useState(() => toText(value));

  // Re-sync from the outside (e.g. switching deposit type) without clobbering
  // what the user is mid-typing — empty stays empty even though it maps to
  // `emptyValue`.
  useEffect(() => {
    if (parse(text) !== value) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n: number) => {
    let v = n;
    if (min != null && min !== '') v = Math.max(Number(min), v);
    if (max != null && max !== '') v = Math.min(Number(max), v);
    return v;
  };

  return {
    value: text,
    inputMode: (decimal ? 'decimal' : 'numeric') as 'decimal' | 'numeric',
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const cleaned = decimal
        ? e.target.value.replace(/[^0-9.,]/g, '')
        : e.target.value.replace(/[^0-9]/g, '');
      setText(cleaned);
      onChange(parse(cleaned));
    },
    onBlur: () => {
      const t = text.trim();
      if (t === '') {
        onChange(emptyValue);
        setText('');
      } else {
        const c = clamp(parse(t));
        onChange(c);
        setText(toText(c));
      }
    },
  };
}
