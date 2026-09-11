/**
 * Objectifs de partage de stories — calcul partagé web / mobile / functions.
 *
 * Tout part des compteurs dénormalisés `provider.stats.stories` (tenus par
 * la callable recordStoryShare) et d'une configuration `StoryGoalConfig`
 * (doc `config/storyGoals`, ou `provider.settings.storyGoal` qui prime).
 * Aucune lecture de `storyEvents` : le calcul est instantané côté client.
 *
 * Pas d'interface pour l'instant (décision en attente) — mais les clés,
 * la progression et la série de semaines réussies sont prêtes.
 */

import type { StoryGoalConfig, StoryShareStats } from '../types';

/** Clé de semaine ISO 8601 (lundi → dimanche) : « 2026-W37 ». */
export function storyWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Jeudi de la même semaine ISO → détermine l'année ISO.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Clé de mois : « 2026-09 ». */
export function storyMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** La semaine ISO précédant `key` (« 2026-W01 » → « 2025-W52 »). */
export function previousStoryWeekKey(key: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) return key;
  // Le jeudi de cette semaine ISO, moins 7 jours, redonne la clé précédente.
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  const thursdayPrev = new Date(monday);
  thursdayPrev.setUTCDate(monday.getUTCDate() + 3 - 7);
  return storyWeekKey(new Date(thursdayPrev.getUTCFullYear(), thursdayPrev.getUTCMonth(), thursdayPrev.getUTCDate()));
}

export const DEFAULT_STORY_GOALS: StoryGoalConfig = {
  enabled: false,
  weeklyTarget: 1,
  monthlyTarget: 4,
  rewardLabel: null,
};

export interface StoryGoalProgress {
  enabled: boolean;
  /** Partages depuis toujours. */
  total: number;
  /** Partages cette semaine / ce mois. */
  weekCount: number;
  monthCount: number;
  weeklyTarget: number;
  monthlyTarget: number;
  /** 0 → 1, plafonné à 1 ; `null` quand l'objectif est à 0. */
  weekRatio: number | null;
  monthRatio: number | null;
  weekReached: boolean;
  monthReached: boolean;
  /**
   * Semaines consécutives (en remontant depuis la semaine courante, ou la
   * précédente si la courante n'est pas encore atteinte) où l'objectif
   * hebdomadaire a été tenu. Base d'un futur badge « régulier ».
   */
  streakWeeks: number;
  /** Type de story le plus partagé, `null` sans historique. */
  favoriteContent: string | null;
}

/** Fusionne la config plateforme et l'éventuel objectif propre au prestataire. */
export function resolveStoryGoal(
  platform: Partial<StoryGoalConfig> | null | undefined,
  providerOverride: Partial<StoryGoalConfig> | null | undefined,
): StoryGoalConfig {
  return { ...DEFAULT_STORY_GOALS, ...(platform ?? {}), ...(providerOverride ?? {}) };
}

export function getStoryGoalProgress(
  stats: StoryShareStats | null | undefined,
  goal: StoryGoalConfig,
  now: Date = new Date(),
): StoryGoalProgress {
  const byWeek = stats?.byWeek ?? {};
  const byMonth = stats?.byMonth ?? {};
  const byContent = stats?.byContent ?? {};
  const weekKey = storyWeekKey(now);
  const weekCount = byWeek[weekKey] ?? 0;
  const monthCount = byMonth[storyMonthKey(now)] ?? 0;
  const weeklyTarget = Math.max(0, Math.round(goal.weeklyTarget || 0));
  const monthlyTarget = Math.max(0, Math.round(goal.monthlyTarget || 0));
  const ratio = (count: number, target: number) =>
    target > 0 ? Math.min(1, count / target) : null;

  // Série : on part de la semaine courante si elle est déjà tenue, sinon de
  // la précédente (la semaine en cours ne casse pas une série en cours).
  let streakWeeks = 0;
  if (weeklyTarget > 0) {
    let key = weekCount >= weeklyTarget ? weekKey : previousStoryWeekKey(weekKey);
    for (let i = 0; i < 260; i++) {
      if ((byWeek[key] ?? 0) < weeklyTarget) break;
      streakWeeks++;
      key = previousStoryWeekKey(key);
    }
  }

  let favoriteContent: string | null = null;
  let best = 0;
  for (const [content, n] of Object.entries(byContent)) {
    if (n > best) {
      best = n;
      favoriteContent = content;
    }
  }

  return {
    enabled: goal.enabled === true,
    total: stats?.shared ?? 0,
    weekCount,
    monthCount,
    weeklyTarget,
    monthlyTarget,
    weekRatio: ratio(weekCount, weeklyTarget),
    monthRatio: ratio(monthCount, monthlyTarget),
    weekReached: weeklyTarget > 0 && weekCount >= weeklyTarget,
    monthReached: monthlyTarget > 0 && monthCount >= monthlyTarget,
    streakWeeks,
    favoriteContent,
  };
}
