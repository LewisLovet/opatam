'use client';

/**
 * ActionCodeModal — confirmation gate for sensitive admin actions
 * (force-update / maintenance, broadcasting a notification to a wide
 * audience). Shows a recap of what is about to happen and requires a
 * confirmation code (verified server-side) before proceeding.
 */

import { useEffect, useState } from 'react';
import { X, Loader2, ShieldAlert } from 'lucide-react';

export interface RecapRow {
  label: string;
  value: string;
  warn?: boolean;
}

interface Props {
  open: boolean;
  title: string;
  intro?: string;
  recap: RecapRow[];
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (code: string) => void;
  onClose: () => void;
}

export function ActionCodeModal({
  open,
  title,
  intro,
  recap,
  confirmLabel,
  loading = false,
  onConfirm,
  onClose,
}: Props) {
  const [code, setCode] = useState('');

  useEffect(() => {
    if (open) setCode('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 p-5 pb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
              {intro && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{intro}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Recap */}
          <div className="px-5">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {recap.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{r.label}</span>
                  <span
                    className={`font-medium text-right truncate ${
                      r.warn ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Code */}
          <div className="p-5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Votre code admin
            </label>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.trim() && !loading) onConfirm(code.trim());
              }}
              placeholder="Saisir le code…"
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Annuler
              </button>
              <button
                onClick={() => onConfirm(code.trim())}
                disabled={!code.trim() || loading}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
