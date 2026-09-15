/**
 * Pixel TikTok — enveloppe typée autour du global `ttq`.
 *
 * Même contrat que lib/meta-pixel.ts : le script n'est chargé par
 * <TikTokPixel> qu'après consentement, et toutes les fonctions ci-dessous
 * ne font RIEN tant que `window.ttq` n'existe pas. Les points d'appel
 * n'ont donc aucune garde à écrire.
 *
 * L'identifiant du pixel vient de l'environnement (NEXT_PUBLIC_TIKTOK_PIXEL_ID) :
 * absent en local et sur les aperçus, le pixel ne se charge pas.
 */

export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? '';

/** Les événements standard TikTok utilisés ici (catalogue « Events API »). */
export type TikTokStandardEvent =
  | 'ViewContent'
  | 'ClickButton'
  | 'SubmitForm'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  | 'CompletePayment'
  | 'Subscribe'
  | 'Contact';

export interface TikTokEventParams {
  value?: number;
  currency?: string;
  content_name?: string;
  content_type?: string;
  content_id?: string;
  contents?: { content_id: string; content_name?: string; price?: number; quantity?: number }[];
}

export interface TikTokEventOptions {
  /** Identifiant d'événement, pour la déduplication avec l'API serveur. */
  event_id?: string;
}

type Ttq = {
  page: () => void;
  track: (name: string, params?: TikTokEventParams, options?: TikTokEventOptions) => void;
  identify: (data: Record<string, string>) => void;
  grantConsent: () => void;
  revokeConsent: () => void;
  load: (id: string) => void;
};

declare global {
  interface Window {
    ttq?: Ttq;
  }
}

export function trackTikTok(
  name: TikTokStandardEvent,
  params?: TikTokEventParams,
  options?: TikTokEventOptions,
): void {
  if (typeof window === 'undefined' || !window.ttq) return;
  try {
    window.ttq.track(name, params ?? {}, options);
  } catch {
    // Une mesure ne casse jamais la page.
  }
}

export function setTikTokConsent(granted: boolean): void {
  if (typeof window === 'undefined' || !window.ttq) return;
  try {
    if (granted) window.ttq.grantConsent();
    else window.ttq.revokeConsent();
  } catch {
    // Idem.
  }
}
