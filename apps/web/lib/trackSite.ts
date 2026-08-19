'use client';

import type { SiteMetricKey } from './siteMetrics';

/**
 * Envoie un événement de mesure du site, sans jamais retarder l'interface.
 *
 * `sendBeacon` en priorité : il survit à la navigation, ce qui compte pour
 * les clics sortants — un `fetch` lancé au moment où l'on quitte la page est
 * annulé par le navigateur, et le clic sur « App Store » n'aurait jamais été
 * compté. `fetch` avec `keepalive` sert de repli.
 *
 * Aucune erreur ne remonte : une mesure d'audience ne doit jamais casser ce
 * qu'elle mesure.
 */
export function trackSite(key: SiteMetricKey): void {
  try {
    const body = JSON.stringify({ key });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics/track-site',
        new Blob([body], { type: 'application/json' })
      );
      return;
    }
    void fetch('/api/analytics/track-site', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Volontairement silencieux.
  }
}
