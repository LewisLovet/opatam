'use client';

/**
 * ClientAutocomplete — the "Informations client" trio (Nom / Email /
 * Téléphone) of the CreateBookingModal, augmented with typeahead over
 * the provider's existing clients.
 *
 * Behaviour:
 *   - Typing in ANY of the three fields searches across name + email +
 *     phone simultaneously (accent/case-insensitive; phone compared on
 *     digits only). So a pro can find a client by whichever detail they
 *     remember — exactly the "depuis le nom ou le mail ou le téléphone"
 *     ask.
 *   - Selecting a suggestion fills all three fields at once.
 *   - When the Nom field is focused and empty AND the provider has at
 *     least REGULAR_THRESHOLD regular clients (>= 2 bookings), we surface
 *     the most frequent clients as ready-to-pick suggestions. Below that
 *     threshold the list isn't useful enough to be worth the noise, so we
 *     only suggest as the pro types.
 *
 * Fully degrades: if `clients` is empty (load failed or brand-new pro),
 * it's just three plain inputs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui';
import type { ProviderClient } from '@booking-app/shared';
import { User, Star, Mail, Phone } from 'lucide-react';

type WithId<T> = { id: string } & T;

/** Min number of "regular" clients before we show frequent-client
 *  suggestions on an empty Nom field. */
const REGULAR_THRESHOLD = 10;
/** Top-N frequent clients shown when the empty Nom field is focused. */
const FREQUENT_SHOWN = 5;
/** Max typeahead matches shown at once. */
const MATCH_SHOWN = 6;

type ClientField = 'clientName' | 'clientEmail' | 'clientPhone';

interface ClientAutocompleteProps {
  clients: WithId<ProviderClient>[];
  name: string;
  email: string;
  phone: string;
  errors: { clientName?: string; clientEmail?: string; clientPhone?: string };
  onFieldChange: (field: ClientField, value: string) => void;
  onSelectClient: (client: { name: string; email: string; phone: string }) => void;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '');
}

interface IndexedClient {
  client: WithId<ProviderClient>;
  nameN: string;
  emailN: string;
  phoneD: string;
}

export function ClientAutocomplete({
  clients,
  name,
  email,
  phone,
  errors,
  onFieldChange,
  onSelectClient,
}: ClientAutocompleteProps) {
  const [focusedField, setFocusedField] = useState<ClientField | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Precompute normalized search keys once per client list.
  const indexed = useMemo<IndexedClient[]>(
    () =>
      clients.map((client) => ({
        client,
        nameN: normalize(client.name || ''),
        emailN: normalize(client.email || ''),
        phoneD: digitsOnly(client.phone || ''),
      })),
    [clients],
  );

  // Frequent clients (only worth showing past the threshold).
  const frequent = useMemo<WithId<ProviderClient>[]>(() => {
    const regulars = clients.filter((c) => (c.bookingsCount ?? 0) >= 2);
    if (regulars.length < REGULAR_THRESHOLD) return [];
    return [...clients]
      .sort((a, b) => (b.bookingsCount ?? 0) - (a.bookingsCount ?? 0))
      .slice(0, FREQUENT_SHOWN);
  }, [clients]);

  // The current query = the value of whichever field has focus.
  const query =
    focusedField === 'clientName'
      ? name
      : focusedField === 'clientEmail'
        ? email
        : focusedField === 'clientPhone'
          ? phone
          : '';

  const matches = useMemo<WithId<ProviderClient>[]>(() => {
    const qN = normalize(query);
    const qD = digitsOnly(query);
    if (!qN && qD.length < 2) return [];
    const out: WithId<ProviderClient>[] = [];
    for (const { client, nameN, emailN, phoneD } of indexed) {
      const byText = qN.length >= 1 && (nameN.includes(qN) || emailN.includes(qN));
      const byPhone = qD.length >= 2 && phoneD.includes(qD);
      if (byText || byPhone) {
        out.push(client);
        if (out.length >= MATCH_SHOWN) break;
      }
    }
    return out;
  }, [indexed, query]);

  // What the dropdown shows right now, and whether it's the "frequent" mode.
  const showFrequent =
    focusedField === 'clientName' && query.trim().length === 0 && frequent.length > 0;
  const suggestions = showFrequent ? frequent : matches;
  const open = focusedField !== null && suggestions.length > 0;

  // Reset keyboard highlight whenever the visible list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [focusedField, query, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocusedField(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const pick = (c: WithId<ProviderClient>) => {
    onSelectClient({
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
    });
    setFocusedField(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      // Only intercept Enter when a suggestion is highlighted, so the
      // pro can still type a brand-new name freely.
      if (suggestions[activeIndex]) {
        e.preventDefault();
        pick(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setFocusedField(null);
    }
  };

  const dropdown =
    open ? (
      <div
        className="absolute z-30 mt-1 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg overflow-hidden"
        role="listbox"
      >
        {showFrequent && (
          <div className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700">
            <Star className="w-3 h-3" />
            Clients fréquents
          </div>
        )}
        <ul className="max-h-64 overflow-y-auto py-1">
          {suggestions.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                // onMouseDown (not onClick) so the pick happens before the
                // input's onBlur tears the dropdown down.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  i === activeIndex
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/60'
                }`}
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300">
                  <User className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {c.name || 'Client'}
                    </span>
                    {(c.bookingsCount ?? 0) > 0 && (
                      <span className="flex-shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                        {c.bookingsCount} RDV
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {c.email && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                    )}
                    {c.phone && (
                      <span className="inline-flex items-center gap-1 flex-shrink-0">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="relative">
        <Input
          label="Nom du client"
          name="clientName"
          value={name}
          onChange={(e) => onFieldChange('clientName', e.target.value)}
          onFocus={() => setFocusedField('clientName')}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder="Ex: Marie Dupont"
          error={errors.clientName}
          required
        />
        {focusedField === 'clientName' && dropdown}
      </div>

      <div className="relative">
        <Input
          label="Email"
          name="clientEmail"
          type="email"
          value={email}
          onChange={(e) => onFieldChange('clientEmail', e.target.value)}
          onFocus={() => setFocusedField('clientEmail')}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder="marie.dupont@example.com"
          error={errors.clientEmail}
          required
        />
        {focusedField === 'clientEmail' && dropdown}
      </div>

      <div className="relative">
        <Input
          label="Téléphone"
          name="clientPhone"
          type="tel"
          value={phone}
          onChange={(e) => onFieldChange('clientPhone', e.target.value)}
          onFocus={() => setFocusedField('clientPhone')}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          placeholder="06 12 34 56 78"
          error={errors.clientPhone}
          required
        />
        {focusedField === 'clientPhone' && dropdown}
      </div>
    </div>
  );
}
