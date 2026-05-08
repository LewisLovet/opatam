/**
 * Centralised metadata for the six provider-client tags.
 *
 * Single source of truth for label / variant / hint / rule. Every UI
 * surface that displays a tag (filter chips, row badges, drawer
 * header, legend popover) reads from here so the explanations stay
 * consistent — and stay aligned with the actual cron rules in
 * functions/src/lib/providerStatsAgg.ts → CLIENT_TAG_THRESHOLDS.
 *
 * If a threshold ever moves on the backend, update both `hint` and
 * `rule` here at the same time so the UI doesn't lie to the pro.
 */

import type { ProviderClientTag } from '@booking-app/shared';
import type { BadgeVariant } from '@/components/ui';

export interface TagMeta {
  value: ProviderClientTag;
  /** Short display label — used on chips, badges, and the legend. */
  label: string;
  /** Badge colour variant. Conveys urgency: green = retain, amber =
   *  watch out, red = act now or write off. */
  variant: BadgeVariant;
  /** One-line summary suitable for the `title` attribute (browser
   *  tooltip on hover / long-press). */
  hint: string;
  /** Long-form rule shown in the legend block — explains the exact
   *  thresholds the cron applies. */
  rule: string;
}

/** Order matters — chips render in the order shown. New / Habitué /
 *  VIP first since those are the most actionable categories. */
export const TAG_META: TagMeta[] = [
  {
    value: 'new',
    label: 'Nouveau',
    variant: 'info',
    hint: 'Premier RDV il y a moins de 30 jours.',
    rule: 'Premier RDV (toutes statuts confondus) il y a moins de 30 jours.',
  },
  {
    value: 'regular',
    label: 'Habitué',
    variant: 'success',
    hint: 'Au moins 3 RDV confirmés et vu il y a moins de 90 jours.',
    rule: 'Au moins 3 RDV confirmés ET dernière visite il y a moins de 90 jours.',
  },
  {
    value: 'vip',
    label: 'VIP',
    variant: 'success',
    hint: 'Au moins 10 RDV confirmés ou 500 € cumulés.',
    rule: 'Au moins 10 RDV confirmés OU au moins 500 € de CA cumulé sur les RDV confirmés.',
  },
  {
    value: 'at_risk',
    label: 'À risque',
    variant: 'warning',
    hint: 'Pas revenu depuis 60 à 180 jours.',
    rule: 'Dernière visite remonte à 60 à 180 jours — fenêtre idéale pour relancer.',
  },
  {
    value: 'lost',
    label: 'Perdu',
    variant: 'error',
    hint: 'Pas revenu depuis plus de 180 jours.',
    rule: 'Dernière visite il y a plus de 180 jours — considéré perdu.',
  },
  {
    value: 'noshow_prone',
    label: 'Absent fréquent',
    variant: 'warning',
    hint: 'Plus de 20 % de no-show sur 3 RDV ou plus.',
    rule: 'Au moins 3 RDV au total ET plus de 20 % d\'absences (no-show).',
  },
];

/** Quick lookup by tag value — handy for badges that only have the
 *  raw enum value to render. */
export const TAG_META_BY_VALUE: Record<ProviderClientTag, TagMeta> =
  TAG_META.reduce(
    (acc, m) => {
      acc[m.value] = m;
      return acc;
    },
    {} as Record<ProviderClientTag, TagMeta>,
  );
