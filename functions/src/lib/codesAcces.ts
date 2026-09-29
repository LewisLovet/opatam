/**
 * Codes d'accès des membres au planning — opérations en base (Admin SDK).
 *
 * Le code vivait dans la fiche du membre, en lecture publique. Il vit
 * désormais dans `memberAccessCodes/{code}` (identifiant = code), que seul
 * le gérant lit. `rangerCodeAcces` y déplace un code encore écrit dans une
 * fiche — c'est le travail de la migration, et celui du trigger pour les
 * anciennes versions de l'app qui l'y écrivent encore.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { codeParMembre, decider, genererCode, normaliserCode, type Rangement } from './codesAccesRegles';

export interface ResultatRangement {
  action: Rangement | 'rien' | 'membre-absent';
  /** Le code qui ouvre désormais le planning de ce membre. */
  code: string | null;
  /** Ce qui était écrit dans la fiche. */
  ancien: string | null;
}

/**
 * Déplace le code écrit dans la fiche de ce membre vers `memberAccessCodes`,
 * puis l'efface de la fiche — en UNE transaction : il n'existe jamais
 * d'instant où le membre n'a plus de code nulle part.
 *
 * `ecrire: false` ne fait que lire et dire ce qui serait fait (dry-run).
 * Rien n'étant écrit, un dry-run sur plusieurs membres doit tenir lui-même
 * le registre des codes qu'il AURAIT attribués (`simules`) : sans lui, deux
 * membres portant le même code paraissaient tous deux « rangés », alors que
 * l'application réelle signale la collision du second.
 */
export async function rangerCodeAcces(
  db: Firestore,
  providerId: string,
  memberId: string,
  { ecrire = true, simules }: { ecrire?: boolean; simules?: Map<string, { providerId: string; memberId: string }> } = {},
): Promise<ResultatRangement> {
  const refMembre = db.collection('providers').doc(providerId).collection('members').doc(memberId);
  const refCode = (code: string) => db.collection('memberAccessCodes').doc(code);

  const resultat = await db.runTransaction(async (tx) => {
    const fiche = await tx.get(refMembre);
    if (!fiche.exists) return { action: 'membre-absent', code: null, ancien: null } as ResultatRangement;
    const brut = fiche.get('accessCode');
    if (typeof brut !== 'string' || !brut) return { action: 'rien', code: null, ancien: null } as ResultatRangement;

    /** Ce que contient déjà `memberAccessCodes/{code}` — en base, ou attribué par ce dry-run. */
    const occupant = async (c: string) => {
      if (simules?.has(c)) return simules.get(c)!;
      const snap = await tx.get(refCode(c));
      return snap.exists ? snap.data()! : null;
    };
    const lisible = normaliserCode(brut);
    const action = decider(brut, lisible ? await occupant(lisible) : null, providerId, memberId);

    let code = action === 'ranger' || action === 'deja-range' ? lisible : null;
    // Collision ou code illisible : on en tire un neuf, libre.
    for (let essai = 0; !code && essai < 12; essai++) {
      const candidat = genererCode(fiche.get('name'), essai < 8 ? 4 : 6);
      if (!(await occupant(candidat))) code = candidat;
    }
    if (!code) throw new Error(`aucun code libre pour ${providerId}/${memberId}`);

    simules?.set(code, { providerId, memberId });
    if (ecrire) {
      if (action !== 'deja-range') {
        tx.create(refCode(code), { providerId, memberId, createdAt: FieldValue.serverTimestamp() });
      }
      tx.update(refMembre, { accessCode: FieldValue.delete() });
    }
    return { action, code, ancien: brut } as ResultatRangement;
  });

  // Une ancienne app qui RÉGÉNÈRE écrit le nouveau code dans la fiche :
  // l'ancien, déjà rangé, ne doit plus rien ouvrir.
  if (ecrire && resultat.code) await retirerCodesDuMembre(db, providerId, memberId, resultat.code);
  return resultat;
}

/** Retire les codes d'un membre — tous, ou tous sauf `garder`. */
export async function retirerCodesDuMembre(
  db: Firestore,
  providerId: string,
  memberId: string,
  garder?: string,
): Promise<number> {
  // Égalité seule, filtre en mémoire : aucun index composite.
  const snap = await db.collection('memberAccessCodes').where('providerId', '==', providerId).get();
  const cibles = snap.docs.filter((d) => d.get('memberId') === memberId && d.id !== garder);
  await Promise.all(cibles.map((d) => d.ref.delete()));
  return cibles.length;
}

/**
 * Le code de chaque membre d'un salon (e-mails du planning). La fiche
 * d'avant la migration sert de repli : `ficheParMembre` donne ce qu'elle
 * porte encore.
 */
export async function codesDuSalon(
  db: Firestore,
  providerId: string,
  ficheParMembre: Map<string, unknown> = new Map(),
): Promise<Map<string, string>> {
  const snap = await db.collection('memberAccessCodes').where('providerId', '==', providerId).get();
  const codes = codeParMembre(
    snap.docs.map((d) => ({ code: d.id, memberId: d.get('memberId'), creeLe: d.get('createdAt')?.toMillis?.() ?? 0 })),
  );
  for (const [memberId, ancien] of ficheParMembre) {
    if (!codes.has(memberId) && typeof ancien === 'string' && ancien) codes.set(memberId, ancien);
  }
  return codes;
}
