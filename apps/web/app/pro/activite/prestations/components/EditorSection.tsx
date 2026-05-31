'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface EditorSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** When false the section is always open with no toggle (e.g. Essentiel). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Force the section open regardless of the user toggle — used to
   *  reveal a validation error hidden inside a collapsed section. */
  forceOpen?: boolean;
  /** Optional pill shown on the right of the header (e.g. a count or
   *  "À partir de 70€"). */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * A titled card section for the prestation page editor. Collapsible by
 * default so the form stays scannable: the pro opens only what they need
 * (Réglages, Disponibilité, Variations) while Essentiel stays pinned open.
 */
export function EditorSection({
  title,
  description,
  icon,
  collapsible = true,
  defaultOpen = true,
  forceOpen = false,
  badge,
  children,
}: EditorSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = !collapsible || open || forceOpen;

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      <header
        className={`flex items-center gap-3 px-4 sm:px-5 py-4 ${
          collapsible ? 'cursor-pointer select-none' : ''
        }`}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? isOpen : undefined}
      >
        {icon && (
          <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
        {badge}
        {collapsible && (
          <ChevronDown
            className={`flex-shrink-0 w-5 h-5 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        )}
      </header>

      {isOpen && (
        <div className="px-4 sm:px-5 pb-5 pt-1 space-y-5 border-t border-gray-100 dark:border-gray-700/60">
          {children}
        </div>
      )}
    </section>
  );
}
