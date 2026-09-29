/**
 * Codes d'accès des membres au planning — côté SERVEUR uniquement.
 *
 * Les codes vivent dans `memberAccessCodes/{code}` (l'identifiant du
 * document est le code), que les règles ne laissent lire qu'au gérant.
 * La connexion au planning ne peut donc se faire qu'ici, par l'Admin SDK.
 *
 * REPLI TEMPORAIRE : tant que la migration n'a pas tourné, un code peut
 * encore n'exister que dans la fiche du membre (ancien emplacement). On l'y
 * cherche en second. Après la migration, ce champ n'existe plus nulle part
 * et le repli ne trouve rien ; il pourra alors être retiré.
 */
import { getAdminFirestore } from '@/lib/firebase-admin';

/**
 * Forme d'un code : lettres, chiffres, tirets. Vérifiée AVANT toute lecture —
 * le code devient un chemin de document, un « / » y ouvrirait une autre
 * collection.
 */
const FORMAT_CODE = /^[A-Z0-9-]{2,24}$/;

/** « jean-ab12 » → « JEAN-AB12 », ou `null` si ce n'est pas un code. */
export function normaliserCode(brut: unknown): string | null {
  if (typeof brut !== 'string') return null;
  const code = brut.trim().toUpperCase();
  return FORMAT_CODE.test(code) ? code : null;
}

export interface MembreDuPlanning {
  id: string;
  providerId: string;
  name: string;
  email: string;
  locationId: string;
  isActive: boolean;
}

function versMembre(id: string, providerId: string, data: FirebaseFirestore.DocumentData): MembreDuPlanning {
  return {
    id,
    providerId,
    name: String(data.name ?? ''),
    email: String(data.email ?? ''),
    locationId: String(data.locationId ?? ''),
    isActive: data.isActive === true,
  };
}

/** Le membre que ce code ouvre, ou `null`. */
export async function membreParCode(brut: unknown): Promise<MembreDuPlanning | null> {
  const code = normaliserCode(brut);
  if (!code) return null;
  const db = getAdminFirestore();

  const entree = await db.collection('memberAccessCodes').doc(code).get();
  if (entree.exists) {
    const { providerId, memberId } = entree.data() as { providerId?: string; memberId?: string };
    if (!providerId || !memberId) return null;
    const fiche = await db.collection('providers').doc(providerId).collection('members').doc(memberId).get();
    return fiche.exists ? versMembre(fiche.id, providerId, fiche.data()!) : null;
  }

  // Repli : code encore écrit dans la fiche (avant migration).
  const ancien = await db.collectionGroup('members').where('accessCode', '==', code).limit(1).get();
  const fiche = ancien.docs[0];
  const providerId = fiche?.ref.parent.parent?.id;
  return fiche && providerId ? versMembre(fiche.id, providerId, fiche.data()) : null;
}

/** Le code d'un membre (e-mails envoyés par le serveur), ou `null`. */
export async function codeDuMembre(providerId: string, memberId: string): Promise<string | null> {
  const db = getAdminFirestore();
  // Égalité seule, tri en mémoire : aucun index composite à créer.
  const snap = await db.collection('memberAccessCodes').where('providerId', '==', providerId).get();
  const siens = snap.docs
    .filter((d) => d.get('memberId') === memberId)
    .sort((a, b) => (b.get('createdAt')?.toMillis?.() ?? 0) - (a.get('createdAt')?.toMillis?.() ?? 0));
  if (siens[0]) return siens[0].id;
  // Repli : fiche d'avant la migration.
  const fiche = await db.collection('providers').doc(providerId).collection('members').doc(memberId).get();
  const ancien = fiche.get('accessCode');
  return typeof ancien === 'string' && ancien ? ancien : null;
}
