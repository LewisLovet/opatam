import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { MemberAccount, MemberInvitation } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, type WithId } from './base.repository';

/**
 * Comptes et invitations de l'espace membre — LECTURE seule côté client.
 *
 * `memberAccounts/{uid}` et `memberInvitations/{id}` ne s'écrivent que par
 * le serveur (règles fermées) : inviter et retirer un accès passent par
 * `/api/pro/membres/acces`, accepter par `/api/membres/invitation`.
 * Le gérant peut aussi retirer un accès en supprimant le compte (règle).
 */
export class MemberAccountRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /** Le compte membre de l'utilisateur connecté, ou `null` s'il n'en a pas. */
  async getMine(uid: string): Promise<MemberAccount | null> {
    const snap = await getDoc(doc(this.db, 'memberAccounts', uid));
    return snap.exists() ? convertTimestamps<MemberAccount>(snap.data()) : null;
  }

  /** Les comptes reliés aux membres d'un salon — lisibles par son gérant. */
  async listByProvider(providerId: string): Promise<WithId<MemberAccount>[]> {
    const snap = await getDocs(query(collection(this.db, 'memberAccounts'), where('providerId', '==', providerId)));
    return snap.docs.map((d) => ({ id: d.id, ...convertTimestamps<MemberAccount>(d.data()) }));
  }

  /** Les invitations d'un salon — lisibles par son gérant. */
  async listInvitationsByProvider(providerId: string): Promise<WithId<MemberInvitation>[]> {
    const snap = await getDocs(query(collection(this.db, 'memberInvitations'), where('providerId', '==', providerId)));
    return snap.docs.map((d) => ({ id: d.id, ...convertTimestamps<MemberInvitation>(d.data()) }));
  }
}

export const memberAccountRepository = new MemberAccountRepository();
