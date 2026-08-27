import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * Résolution des noms du staff — la fiche staffMembers d'abord, puis repli
 * sur le compte Firebase Auth (displayName, sinon le début de l'e-mail).
 *
 * Sans le repli, tout uid sans fiche (un admin qui teste, une fiche
 * supprimée) devenait « Un membre » dans le fil de nouvelles et « ? » sur
 * les badges d'attribution — exactement l'inverse d'un système incitatif.
 */

export interface NomStaff {
  nom: string;
  initiales: string;
}

export function initialesDe(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  return mots.length === 0 ? '?' : mots.slice(0, 2).map((m) => m[0]!.toUpperCase()).join('');
}

/**
 * uids → { nom, initiales }. `fiches` = ce que staffMembers connaît déjà
 * (uid → displayName) ; les uids restants sont résolus via Firebase Auth
 * (par lots de 100, la limite de getUsers), best-effort.
 */
export async function resolveStaffNames(
  fiches: Map<string, string>,
  uids: Iterable<string>,
): Promise<Record<string, NomStaff>> {
  const resultat: Record<string, NomStaff> = {};
  const inconnus: string[] = [];
  for (const uid of new Set(uids)) {
    const fiche = fiches.get(uid);
    if (fiche) resultat[uid] = { nom: fiche, initiales: initialesDe(fiche) };
    else inconnus.push(uid);
  }

  for (let i = 0; i < inconnus.length; i += 100) {
    try {
      const { users } = await getAdminAuth().getUsers(
        inconnus.slice(i, i + 100).map((uid) => ({ uid })),
      );
      for (const u of users) {
        const nom = u.displayName || u.email?.split('@')[0] || 'Un membre';
        resultat[u.uid] = { nom, initiales: initialesDe(nom) };
      }
    } catch {
      // best-effort : les uids restants garderont le libellé générique
    }
  }
  for (const uid of inconnus) {
    if (!resultat[uid]) resultat[uid] = { nom: 'Un membre', initiales: '?' };
  }
  return resultat;
}
