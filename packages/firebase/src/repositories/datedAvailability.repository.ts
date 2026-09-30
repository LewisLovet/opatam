import {
  getFirestore,
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { DatedAvailability } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

type Reglage = Omit<DatedAvailability, 'createdAt'>;

/**
 * Horaires DATÉS des membres — `providers/{pid}/datedAvailability/{id}`.
 *
 * Lecture publique (comme `availability`) : le calcul des créneaux tourne
 * aussi dans l'app de la cliente. Les dates sont des chaînes « YYYY-MM-DD »
 * (dates calendaires du lieu) : les comparer comme chaînes EST les comparer
 * comme dates. `createdAt` (horloge du serveur) départage les réglages qui se
 * recouvrent : le plus récent l'emporte.
 */
export class DatedAvailabilityRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  private col(providerId: string) {
    return collection(this.db, 'providers', providerId, 'datedAvailability');
  }

  private versModele(id: string, data: Record<string, unknown>): WithId<DatedAvailability> {
    const d = convertTimestamps<DatedAvailability>(data);
    return {
      id,
      ...d,
      weekdays: Array.isArray(d.weekdays) ? d.weekdays : [],
      slots: Array.isArray(d.slots) ? d.slots : [],
      // Écriture encore en attente côté client : horodatage du serveur pas
      // encore connu — « maintenant », il est le plus récent.
      createdAt: d.createdAt instanceof Date ? d.createdAt : new Date(),
    };
  }

  async create(providerId: string, reglage: Reglage): Promise<string> {
    const ref = await addDoc(
      this.col(providerId),
      removeUndefined({ ...reglage, createdAt: serverTimestamp() } as Record<string, unknown>),
    );
    return ref.id;
  }

  /** Plusieurs réglages d'un coup (copie de semaine) : un seul lot. */
  async createMany(providerId: string, reglages: Reglage[]): Promise<string[]> {
    const lot = writeBatch(this.db);
    const ids: string[] = [];
    for (const r of reglages) {
      const ref = doc(this.col(providerId));
      ids.push(ref.id);
      lot.set(ref, removeUndefined({ ...r, createdAt: serverTimestamp() } as Record<string, unknown>));
    }
    await lot.commit();
    return ids;
  }

  /**
   * Les réglages qui touchent [du, au] (dates calendaires), tous membres
   * confondus. Une seule inégalité (`to >= du`) : aucun index composite ;
   * le reste se filtre en mémoire.
   */
  async getInRange(providerId: string, du: string, au: string): Promise<WithId<DatedAvailability>[]> {
    const snap = await getDocs(query(this.col(providerId), where('to', '>=', du)));
    return snap.docs.map((d) => this.versModele(d.id, d.data())).filter((r) => r.from <= au);
  }

  async getForMemberInRange(
    providerId: string,
    memberId: string,
    du: string,
    au: string,
  ): Promise<WithId<DatedAvailability>[]> {
    return (await this.getInRange(providerId, du, au)).filter((r) => r.memberId === memberId);
  }

  async delete(providerId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.col(providerId), id));
  }
}

export const datedAvailabilityRepository = new DatedAvailabilityRepository();
