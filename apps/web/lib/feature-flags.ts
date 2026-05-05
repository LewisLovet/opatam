/**
 * Feature flags for staged rollouts.
 *
 * Single source of truth: flip a flag here and the whole app picks it up.
 * Whenever a flag gates a real launch, every gate site is annotated with
 * a FIXME marker so cleanup is easy:
 *
 *     // FIXME(deposits-launch): remove gate, see lib/feature-flags.ts
 *
 * To find every gate site for the deposits launch:
 *
 *     grep -rn "FIXME(deposits-launch)" apps/ packages/
 *
 * Steps to launch a flag:
 *  1. Flip the flag value below to `true`
 *  2. (optional) grep the FIXME marker and delete the now-redundant
 *     `if (!user.isAdmin) return ...` checks — they become dead code
 *  3. Announce in the dashboard, ship a release note
 */

export const FEATURE_FLAGS = {
  /**
   * Acomptes Stripe (deposits add-on + Connect onboarding).
   *
   *   false → admins only — UI tab hidden, API endpoints return 403 to non-admins
   *   true  → public — every pro on a paid plan can activate
   *
   * Gates protected by this flag (FIXME(deposits-launch) markers):
   *   - apps/web/app/pro/parametres/page.tsx          (sidebar tab)
   *   - apps/web/app/pro/parametres/components/PaymentsSection.tsx (UI guard)
   *   - apps/web/app/api/pro/stripe-connect/create-account/route.ts
   *   - apps/web/app/api/pro/stripe-connect/refresh-link/route.ts
   *   - apps/web/app/api/pro/stripe-connect/status/route.ts
   *   - apps/web/app/api/pro/deposits-addon/activate/route.ts
   *   - apps/web/app/api/pro/deposits-addon/deactivate/route.ts
   */
  depositsPublic: true,
} as const;

/**
 * Server-side gate for the deposits feature.
 * Pass the result of `getAdminFirestore().collection('users').doc(uid).get()`.
 *
 * FIXME(deposits-launch): once depositsPublic === true, callers can drop
 * this check entirely since the function will always return true.
 */
export function canUseDepositsServer(userIsAdmin: boolean): boolean {
  if (FEATURE_FLAGS.depositsPublic) return true;
  return userIsAdmin === true;
}

/**
 * Client-side gate. Use in components when deciding whether to render a
 * deposits-related UI (tabs, toggles, modals).
 *
 * FIXME(deposits-launch): same comment as canUseDepositsServer.
 */
export function canUseDepositsClient(user: { isAdmin?: boolean } | null | undefined): boolean {
  if (FEATURE_FLAGS.depositsPublic) return true;
  return user?.isAdmin === true;
}
