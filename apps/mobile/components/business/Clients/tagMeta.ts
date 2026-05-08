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
 */

import type { ProviderClientTag } from '@booking-app/shared';
import type { BadgeVariant } from '../../Badge';

export interface TagMeta {
  value: ProviderClientTag;
  label: string;
  /** Shorter form for tight spaces (chips, list rows). */
  shortLabel: string;
  variant: BadgeVariant;
  hint: string;
  rule: string;
}

export const TAG_META: TagMeta[] = [
  {
    value: 'new',
    label: 'Nouveau',
    shortLabel: 'Nouveau',
    variant: 'info',
    hint: 'Premier RDV il y a moins de 30 jours.',
    rule: 'Premier RDV (toutes statuts confondus) il y a moins de 30 jours.',
  },
  {
    value: 'regular',
    label: 'Habitué',
    shortLabel: 'Habitué',
    variant: 'success',
    hint: 'Au moins 3 RDV confirmés et vu il y a moins de 90 jours.',
    rule: 'Au moins 3 RDV confirmés ET dernière visite il y a moins de 90 jours.',
  },
  {
    value: 'vip',
    label: 'VIP',
    shortLabel: 'VIP',
    variant: 'success',
    hint: 'Au moins 10 RDV confirmés ou 500 € cumulés.',
    rule: 'Au moins 10 RDV confirmés OU au moins 500 € de CA cumulé sur les RDV confirmés.',
  },
  {
    value: 'at_risk',
    label: 'À risque',
    shortLabel: 'À risque',
    variant: 'warning',
    hint: 'Pas revenu depuis 60 à 180 jours.',
    rule: 'Dernière visite remonte à 60 à 180 jours — fenêtre idéale pour relancer.',
  },
  {
    value: 'lost',
    label: 'Perdu',
    shortLabel: 'Perdu',
    variant: 'error',
    hint: 'Pas revenu depuis plus de 180 jours.',
    rule: 'Dernière visite il y a plus de 180 jours — considéré perdu.',
  },
  {
    value: 'noshow_prone',
    label: 'Absent fréquent',
    shortLabel: 'Absent freq.',
    variant: 'warning',
    hint: 'Plus de 20 % de no-show sur 3 RDV ou plus.',
    rule: "Au moins 3 RDV au total ET plus de 20 % d'absences (no-show).",
  },
];

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
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
