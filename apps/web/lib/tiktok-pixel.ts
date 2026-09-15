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
  | 'Search'
  | 'Lead'
  | 'SubmitForm'
  | 'CompleteRegistration'
  | 'InitiateCheckout'
  /** « Achat » dans TikTok Ads Manager — l'acompte payé. */
  | 'Purchase'
  | 'Subscribe'
  | 'Contact';

/** Un élément de `contents`, tel que TikTok le décrit dans son code généré. */
export interface TikTokContent {
  /** Identifiant de la chose vue ou achetée (slug, id de réservation…). */
  content_id: string;
  /** `product` ou `product_group`. */
  content_type: 'product' | 'product_group';
  /** Nom lisible de la page ou du produit. */
  content_name?: string;
  price?: number;
  quantity?: number;
}

/**
 * Paramètres d'événement, au format du code que TikTok génère : les détails
 * dans un tableau `contents`, la valeur et la devise au niveau supérieur.
 */
export interface TikTokEventParams {
  contents?: TikTokContent[];
  value?: number;
  currency?: string;
  /** Pour `Search` seulement. */
  search_string?: string;
}

/** Raccourci : un seul élément dans `contents`. */
export function contenu(content_id: string, content_name?: string, content_type: TikTokContent['content_type'] = 'product'): TikTokContent[] {
  return [{ content_id, content_type, content_name }];
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
