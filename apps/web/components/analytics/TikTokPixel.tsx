'use client';
/**
 * TikTokPixel — chargement du pixel TikTok, gaté sur le consentement.
 *
 * Copie conforme de <MetaPixel>, même bannière, mêmes règles :
 *  - rien n'est rendu ni chargé tant que le visiteur n'a pas accepté ;
 *  - à l'acceptation, le snippet officiel est injecté UNE fois et la
 *    première page vue part ; les suivantes suivent la navigation ;
 *  - si le consentement est retiré ensuite, `revokeConsent()` fait taire
 *    le script — il reste en mémoire, TikTok ne prévoit pas de le décharger ;
 *  - sans NEXT_PUBLIC_TIKTOK_PIXEL_ID (local, aperçus), ne fait rien.
 *
 * Rapprochement avancé : l'e-mail et l'identifiant du compte sont passés
 * à `ttq.identify()` HACHÉS en SHA-256 ici même, jamais en clair.
 */
import { useContext, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useConsent } from '@/hooks/useConsent';
import { AuthContext } from '@/contexts/AuthContext';
import { TIKTOK_PIXEL_ID, setTikTokConsent } from '@/lib/tiktok-pixel';

const SCRIPT_DOM_ID = 'tiktok-pixel-snippet';

/**
 * Téléphone au format E.164 (« +33612345678 »), le seul que TikTok
 * rapproche. Les fiches portent souvent un numéro français en 06… ou avec
 * des espaces : on normalise avant de hacher. `null` si inexploitable.
 */
function telephoneE164(brut: string | null | undefined): string | null {
  const chiffres = (brut ?? '').replace(/\D/g, '');
  if (chiffres.length < 8) return null;
  if (chiffres.length === 10 && chiffres.startsWith('0')) return `+33${chiffres.slice(1)}`;
  if (chiffres.startsWith('33') && chiffres.length === 11) return `+${chiffres}`;
  return `+${chiffres}`;
}

/** SHA-256 hexadécimal, minuscules — le format attendu par TikTok. */
async function sha256(valeur: string): Promise<string> {
  const data = new TextEncoder().encode(valeur.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Port fidèle du snippet fourni par TikTok Ads Manager : la file `ttq` est
 * créée avant le script, pour que les appels faits avant son arrivée soient
 * rejoués. Idempotent.
 */
function injecterScript(pixelId: string): void {
  if (document.getElementById(SCRIPT_DOM_ID)) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.ttq) return;
  const t = 'ttq';
  w.TiktokAnalyticsObject = t;
  const ttq: any = (w[t] = w[t] || []);
  ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent'];
  ttq.setAndDefer = function (obj: any, method: string) {
    obj[method] = function () {
      // eslint-disable-next-line prefer-rest-params
      obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
    };
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.instance = function (id: string) {
    const e = ttq._i[id] || [];
    for (const m of ttq.methods) ttq.setAndDefer(e, m);
    return e;
  };
  ttq.load = function (id: string, options?: Record<string, unknown>) {
    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._i[id]._u = url;
    ttq._t = ttq._t || {};
    ttq._t[id] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[id] = options || {};
    const script = document.createElement('script');
    script.id = SCRIPT_DOM_ID;
    script.type = 'text/javascript';
    script.async = true;
    script.src = `${url}?sdkid=${id}&lib=${t}`;
    document.head.appendChild(script);
  };
  ttq.load(pixelId);
  ttq.page();
}

export function TikTokPixel() {
  const { status } = useConsent();
  const auth = useContext(AuthContext);
  const firebaseUser = auth?.firebaseUser ?? null;
  const telephone = telephoneE164(auth?.user?.phone);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const premierePageVue = useRef(false);
  const dernierUid = useRef<string | null | undefined>(undefined);

  // 1. Injection + consentement + identification hachée au changement de compte.
  useEffect(() => {
    if (!TIKTOK_PIXEL_ID) return;
    if (status === 'denied') {
      setTikTokConsent(false);
      return;
    }
    if (status !== 'granted') return;

    if (!document.getElementById(SCRIPT_DOM_ID)) {
      injecterScript(TIKTOK_PIXEL_ID);
      premierePageVue.current = true;
    }
    setTikTokConsent(true);

    if (firebaseUser?.uid !== dernierUid.current) {
      dernierUid.current = firebaseUser?.uid ?? null;
      if (firebaseUser?.email && window.ttq && typeof crypto?.subtle?.digest === 'function') {
        void Promise.all([sha256(firebaseUser.email), sha256(firebaseUser.uid), telephone ? sha256(telephone) : Promise.resolve(null)])
          .then(([email, external_id, phone_number]) =>
            window.ttq?.identify(phone_number ? { email, external_id, phone_number } : { email, external_id }),
          )
          .catch(() => undefined);
      }
    }
  }, [status, firebaseUser?.uid, firebaseUser?.email, telephone]);

  // 2. Une page vue à chaque navigation côté client.
  useEffect(() => {
    if (status !== 'granted') return;
    if (!premierePageVue.current) {
      premierePageVue.current = true;
      return;
    }
    try { window.ttq?.page(); } catch { /* silencieux */ }
  }, [pathname, searchParams, status]);

  return null;
}
