/**
 * Centralised metadata for the six provider-client tags on mobile.
 *
 * Mirrors the web version (apps/web/app/pro/clients/components/
 * tagMeta.ts) — same labels, same hints, same rules. Kept in sync
 * with CLIENT_TAG_THRESHOLDS in functions/src/lib/providerStatsAgg.ts;
 * if a threshold ever moves on the backend, update both clients.
 *
 * The mobile Badge component uses 'neutral' instead of 'default'
 * and offers no 'info' equivalent — we map 'new' to 'info' here
 * since mobile Badge does support 'info'.
 *
 * i18n: the tag VALUES ('new', 'vip', 'at_risk'…) are what's stored
 * in Firestore — never translate them. Only the display strings
 * (label / shortLabel / hint / rule) go through i18n. They're
 * exposed as lazy getters so `i18n.t` runs at render time (the
 * consuming screens re-render on language change via
 * useTranslation), not once at module load.
 */

import type { ProviderClientTag } from '@booking-app/shared';
import type { BadgeVariant } from '../../Badge';
import i18n from '../../../lib/i18n';

export interface TagMeta {
  value: ProviderClientTag;
  label: string;
  /** Shorter form for tight spaces (chips, list rows). */
  shortLabel: string;
  variant: BadgeVariant;
  hint: string;
  rule: string;
}

/** Firestore value → camelCase i18n key segment. */
const TAG_I18N_KEY: Record<ProviderClientTag, string> = {
  new: 'new',
  regular: 'regular',
  vip: 'vip',
  at_risk: 'atRisk',
  lost: 'lost',
  noshow_prone: 'noshowProne',
};

const TAG_DEFS: { value: ProviderClientTag; variant: BadgeVariant }[] = [
  { value: 'new', variant: 'info' },
  { value: 'regular', variant: 'success' },
  { value: 'vip', variant: 'success' },
  { value: 'at_risk', variant: 'warning' },
  { value: 'lost', variant: 'error' },
  { value: 'noshow_prone', variant: 'warning' },
];

export const TAG_META: TagMeta[] = TAG_DEFS.map(({ value, variant }) => {
  const base = `proClients.tags.${TAG_I18N_KEY[value]}`;
  return {
    value,
    variant,
    get label() {
      return i18n.t(`${base}.label`);
    },
    get shortLabel() {
      return i18n.t(`${base}.shortLabel`);
    },
    get hint() {
      return i18n.t(`${base}.hint`);
    },
    get rule() {
      return i18n.t(`${base}.rule`);
    },
  };
});

export const TAG_META_BY_VALUE: Record<ProviderClientTag, TagMeta> =
  TAG_META.reduce(
    (acc, m) => {
      acc[m.value] = m;
      return acc;
    },
    {} as Record<ProviderClientTag, TagMeta>,
  );

/** "0 €" / "1 234 €" — never "Gratuit". Same rationale as the web
 *  helper: cumulative revenue should read as a number, not as a
 *  service price modifier. */
export function formatRevenue(cents: number, currency = 'EUR'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat(i18n.language, {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
