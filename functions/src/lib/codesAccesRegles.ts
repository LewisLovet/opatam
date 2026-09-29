/**
 * Codes d'accès des membres au planning — les DÉCISIONS, sans base.
 *
 * Partagé par le trigger `onMemberWriteAccessCode` et la migration
 * `scripts/membres/migration-codes-acces.mjs` (via `functions/dist`) : les
 * deux rangent un code trouvé dans une fiche membre de la même façon.
 * Pur (aucun import) : testé par `codesAccesRegles.node.test.mjs`.
 */

/**
 * Forme d'un code : lettres, chiffres, tirets — celle qu'accepte la
 * connexion au planning (`apps/web/lib/member-access-code.ts`). Un « / »
 * ferait du code un autre chemin de document.
 */
export const FORMAT_CODE = /^[A-Z0-9-]{2,24}$/;

export function normaliserCode(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const code = brut.trim().toUpperCase();
  return FORMAT_CODE.test(code) ? code : null;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I

/** PRENOM-XXXX, comme `memberService` côté client. `alea` : tests. */
export function genererCode(nom: unknown, longueur = 4, alea: () => number = Math.random): string {
  const prenom =
    String(nom ?? '')
      .split(' ')[0]
      .toUpperCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z]/g, '')
      .substring(0, 6) || 'MEMBRE';
  let suite = '';
  for (let i = 0; i < longueur; i++) suite += ALPHABET.charAt(Math.floor(alea() * ALPHABET.length));
  return `${prenom}-${suite}`;
}

export type Rangement =
  /** Le code est libre : on le range pour ce membre. */
  | 'ranger'
  /** Déjà rangé pour CE membre (migration relancée, trigger rejoué). */
  | 'deja-range'
  /** Pris par un AUTRE membre : ce membre reçoit un nouveau code. */
  | 'collision'
  /** Illisible comme code (caractères interdits) : nouveau code aussi. */
  | 'invalide';

/**
 * Que faire du code `brut` trouvé dans la fiche de (providerId, memberId),
 * sachant ce que `memberAccessCodes/{code}` contient déjà (`null` = libre).
 */
export function decider(
  brut: unknown,
  existant: { providerId?: unknown; memberId?: unknown } | null,
  providerId: string,
  memberId: string,
): Rangement {
  if (!normaliserCode(brut)) return 'invalide';
  if (!existant) return 'ranger';
  return existant.providerId === providerId && existant.memberId === memberId ? 'deja-range' : 'collision';
}

/**
 * Le code le plus récent de chaque membre, parmi les entrées d'un salon.
 * Plusieurs par membre n'arrive qu'après une régénération interrompue.
 */
export function codeParMembre(
  entrees: Array<{ code: string; memberId: unknown; creeLe: number }>,
): Map<string, string> {
  const meilleur = new Map<string, { code: string; t: number }>();
  for (const e of entrees) {
    if (typeof e.memberId !== 'string') continue;
    const actuel = meilleur.get(e.memberId);
    if (!actuel || e.creeLe > actuel.t) meilleur.set(e.memberId, { code: e.code, t: e.creeLe });
  }
  return new Map([...meilleur].map(([m, v]) => [m, v.code]));
}
