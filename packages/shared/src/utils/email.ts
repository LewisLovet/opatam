/**
 * Aides email pour les formulaires d'inscription / réservation.
 *
 * Les fautes de frappe d'email cassent tout le parcours (confirmations,
 * rappels, fidélité — la clé client est basée sur l'email). Deux défenses :
 *  - EMAIL_REGEX : validation de forme raisonnable (pas RFC-complète) ;
 *  - suggestEmailDomain : détecte les fautes sur les domaines courants
 *    (« gmial.com » → « gmail.com ») via une distance d'édition ≤ 2.
 */

/** Forme minimale exigée : local@domaine.tld (tld ≥ 2). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Domaines grand public les plus fréquents (marché FR/EN/IT). */
const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'hotmail.fr',
  'hotmail.it',
  'outlook.com',
  'outlook.fr',
  'outlook.it',
  'yahoo.com',
  'yahoo.fr',
  'yahoo.it',
  'icloud.com',
  'orange.fr',
  'free.fr',
  'sfr.fr',
  'wanadoo.fr',
  'laposte.net',
  'live.fr',
  'live.com',
  'live.it',
  'bbox.fr',
  'protonmail.com',
  'proton.me',
  'gmx.fr',
  'gmx.com',
  'msn.com',
  'libero.it',
  'virgilio.it',
  'alice.it',
  'tiscali.it',
];

/** Distance de Levenshtein bornée (early-exit au-delà de `max`). */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let best = i;
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = prev[j];
      prev[j] = cur;
      if (cur < best) best = cur;
    }
    if (best > max) return max + 1;
  }
  return prev[b.length];
}

/**
 * Si le domaine de `email` ressemble fortement à un domaine courant sans
 * en être un, retourne l'adresse corrigée — sinon null.
 *
 *   suggestEmailDomain('lea@gmial.com')  → 'lea@gmail.com'
 *   suggestEmailDomain('lea@gmail.com')  → null
 *   suggestEmailDomain('lea@monentreprise.fr') → null (trop différent)
 */
export function suggestEmailDomain(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain.length < 4) return null;
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDist = 3;
  for (const candidate of COMMON_EMAIL_DOMAINS) {
    const d = editDistance(domain, candidate, 2);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best ? `${local}@${best}` : null;
}
