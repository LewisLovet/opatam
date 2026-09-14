'use client';

import type { ProviderAttribution } from '@booking-app/shared';

/**
 * Attribution de campagne, SANS cookie.
 *
 * Ce qu'on veut savoir : quelle publicité a produit quel prestataire. Ce
 * qu'on refuse : suivre un visiteur. D'où ce compromis.
 *
 *  1. Les paramètres du lien d'arrivée (utm_*, fbclid, gclid) sont RECOPIÉS
 *     sur les liens vers l'inscription : si le visiteur clique « Créer ma
 *     vitrine » depuis l'accueil, l'inscription les lit dans sa propre URL.
 *     Aucun stockage.
 *  2. En filet, ils sont gardés dans le `sessionStorage` : effacé à la
 *     fermeture de l'onglet, jamais partagé entre sites, pas un cookie. Il
 *     couvre le visiteur qui va voir la démo ou les tarifs avant de revenir
 *     s'inscrire dans la même session.
 *
 * Tout est enveloppé de try : une mesure ne doit jamais casser la page.
 */

const CLE = 'opatam-campagne';
const MAX = 120;

const UTM: Record<string, keyof ProviderAttribution> = {
  utm_source: 'source',
  utm_medium: 'medium',
  utm_campaign: 'campaign',
  utm_content: 'content',
  utm_term: 'term',
};

function propre(v: string | null): string | null {
  const t = (v ?? '').trim().slice(0, MAX);
  return t || null;
}

/** Ce que le lien d'arrivée dit, et rien d'autre. */
export function lireCampagneUrl(search: string): ProviderAttribution {
  const q = new URLSearchParams(search);
  const a: ProviderAttribution = {};
  for (const [param, champ] of Object.entries(UTM)) {
    const v = propre(q.get(param));
    if (v) (a as Record<string, unknown>)[champ] = v;
  }
  if (q.has('fbclid')) a.clickId = 'fbclid';
  else if (q.has('gclid')) a.clickId = 'gclid';
  return a;
}

function estVide(a: ProviderAttribution): boolean {
  return !a.source && !a.medium && !a.campaign && !a.content && !a.term && !a.clickId;
}

/**
 * À appeler une fois à l'arrivée sur une page publique. Mémorise la
 * campagne de CETTE session si le lien en porte une — la première l'emporte,
 * c'est elle qui a amené le visiteur. Sans paramètres mais avec un site
 * référent externe, on retient le référent comme source.
 */
export function memoriserCampagne(): void {
  try {
    if (typeof window === 'undefined' || sessionStorage.getItem(CLE)) return;
    const a = lireCampagneUrl(window.location.search);
    const ref = document.referrer ? new URL(document.referrer).hostname : '';
    const externe = ref && !ref.endsWith('opatam.com') ? ref : null;
    if (estVide(a) && !externe) return;
    if (estVide(a) && externe) {
      a.source = externe;
      a.medium = 'referral';
    }
    a.referrer = externe;
    a.landing = window.location.pathname.slice(0, 200);
    sessionStorage.setItem(CLE, JSON.stringify(a));
  } catch {
    // Volontairement silencieux.
  }
}

/** La campagne mémorisée dans cette session, ou `null`. */
export function campagneMemorisee(): ProviderAttribution | null {
  try {
    const brut = sessionStorage.getItem(CLE);
    return brut ? (JSON.parse(brut) as ProviderAttribution) : null;
  } catch {
    return null;
  }
}

/**
 * Les paramètres de campagne de l'URL courante, prêts à être recopiés sur
 * un lien : `?utm_source=meta&utm_campaign=lancement` ou une chaîne vide.
 */
export function suffixeCampagne(search: string): string {
  try {
    const q = new URLSearchParams(search);
    const garde = new URLSearchParams();
    for (const param of [...Object.keys(UTM), 'fbclid', 'gclid']) {
      const v = q.get(param);
      if (v) garde.set(param, v.slice(0, MAX));
    }
    const s = garde.toString();
    return s ? `?${s}` : '';
  } catch {
    return '';
  }
}

/**
 * L'attribution à écrire sur le compte à l'inscription : l'URL de la page
 * d'inscription d'abord (le lien recopié), la session en filet.
 */
export function attributionInscription(search: string): ProviderAttribution | undefined {
  const url = lireCampagneUrl(search);
  if (!estVide(url)) {
    const memo = campagneMemorisee();
    return { ...url, referrer: memo?.referrer ?? null, landing: memo?.landing ?? null };
  }
  const memo = campagneMemorisee();
  return memo && !estVide(memo) ? memo : undefined;
}
