import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from '../lib/config';

/**
 * Codes d'accès des membres au planning — `memberAccessCodes/{code}`.
 *
 * POURQUOI UNE COLLECTION À PART. Le code vivait dans la fiche du membre,
 * or cette fiche est en lecture publique (la page du salon affiche
 * l'équipe) : n'importe qui pouvait lire le code de chaque membre et ouvrir
 * son planning. Ici, les règles ne laissent lire un code qu'au gérant du
 * salon ; la connexion au planning le vérifie côté serveur (Admin SDK).
 *
 * LE CODE EST L'IDENTIFIANT DU DOCUMENT : l'unicité est garantie par la base
 * elle-même. Les règles n'autorisent que la CRÉATION — écrire sur un code
 * déjà pris est une mise à jour, refusée. On n'a donc plus besoin de lire
 * les codes des autres salons pour en choisir un libre.
 */
export interface MemberAccessCodeDoc {
  providerId: string;
  memberId: string;
}

export class MemberAccessCodeRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  private ref(code: string) {
    return doc(this.db, 'memberAccessCodes', code);
  }

  /**
   * Réserve `code` pour ce membre. `false` si le code est déjà pris (la
   * règle refuse l'écriture sur un document existant) ; toute autre erreur
   * remonte.
   */
  async reserver(code: string, providerId: string, memberId: string): Promise<boolean> {
    try {
      await setDoc(this.ref(code), { providerId, memberId, createdAt: serverTimestamp() });
      return true;
    } catch (err) {
      if ((err as { code?: string })?.code === 'permission-denied') return false;
      throw err;
    }
  }

  /** Les codes d'un salon — lisibles par son gérant seulement. */
  async listByProvider(providerId: string): Promise<Array<MemberAccessCodeDoc & { code: string; createdAt: Date | null }>> {
    const snap = await getDocs(query(collection(this.db, 'memberAccessCodes'), where('providerId', '==', providerId)));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        code: d.id,
        providerId: data.providerId,
        memberId: data.memberId,
        createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate() : null,
      };
    });
  }

  async delete(code: string): Promise<void> {
    await deleteDoc(this.ref(code));
  }
}

export const memberAccessCodeRepository = new MemberAccessCodeRepository();
