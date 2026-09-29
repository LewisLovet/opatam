import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import type { BlockedSlot } from '@booking-app/shared';
import { normaliserRecurrence } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for blockedSlots subcollection (providers/{providerId}/blockedSlots)
 */
/**
 * Un document Firestore → le modèle applicatif. LE point de passage de
 * toutes les lectures de ce dépôt.
 *
 * `recurrence.until` y est ramené à « AAAA-MM-JJ » : les premières
 * versions l'écrivaient en `Date` (relu en `Timestamp`, puis en `Date`), et
 * aucun écran n'a à connaître cet historique. Une règle illisible devient
 * `null` — la série garde ses occurrences, elle perd seulement la
 * possibilité d'être régénérée.
 */
function versModele(data: Record<string, unknown>): BlockedSlot {
  const modele = convertTimestamps<BlockedSlot>(data);
  if (modele.recurrence != null) {
    modele.recurrence = normaliserRecurrence(modele.recurrence);
  }
  return modele;
}

export class BlockedSlotRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a provider's blocked slots
   */
  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'blockedSlots');
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, blockedSlotId: string) {
    return doc(this.db, 'providers', providerId, 'blockedSlots', blockedSlotId);
  }

  /**
   * Create a new blocked slot
   */
  async create(
    providerId: string,
    data: Omit<BlockedSlot, 'id' | 'createdAt'>
  ): Promise<string> {
    const docData = removeUndefined({
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      createdAt: serverTimestamp(),
    } as Record<string, unknown>);

    const docRef = await addDoc(this.getCollectionRef(providerId), docData);
    return docRef.id;
  }

  /** Le document tel que Firestore l'attend : dates en Timestamp, création horodatée. */
  private versFirestore(data: Omit<BlockedSlot, 'id' | 'createdAt'>): Record<string, unknown> {
    return removeUndefined({
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      createdAt: serverTimestamp(),
    } as Record<string, unknown>);
  }

  /** Un identifiant neuf de cette collection — pour nommer une série avant d'écrire. */
  nouvelIdentifiant(providerId: string): string {
    return doc(this.getCollectionRef(providerId)).id;
  }

  /**
   * Crée plusieurs blocages d'un coup — les occurrences d'une série.
   *
   * Par lots atomiques de 400 (la limite Firestore est 500) : une série
   * d'un an tient dans un seul lot, et une panne au milieu ne laisse pas
   * une demi-série. Les identifiants sont tirés AVANT l'écriture pour être
   * rendus dans l'ordre des occurrences. Les `Date` imbriquées
   * (`recurrence.until`) deviennent des Timestamp par le SDK lui-même.
   */
  async createMany(
    providerId: string,
    docs: Array<Omit<BlockedSlot, 'id' | 'createdAt'>>,
  ): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const data of docs.slice(i, i + 400)) {
        const ref = doc(this.getCollectionRef(providerId));
        batch.set(ref, this.versFirestore(data));
        ids.push(ref.id);
      }
      await batch.commit();
    }
    return ids;
  }

  /**
   * Toutes les occurrences d'une série, par date de début. Égalité seule,
   * tri en mémoire : une série compte au plus quelques centaines de
   * documents, pas de quoi exiger un index composite.
   */
  async getBySeries(providerId: string, seriesId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(this.getCollectionRef(providerId), where('seriesId', '==', seriesId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...versModele(d.data()) }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }

  /**
   * Remplace des occurrences par d'autres — suppressions et créations dans
   * la MÊME écriture quand elles tiennent dans un lot Firestore (500
   * opérations). C'est le cas courant : une série compte au plus 371
   * occurrences, et « celle-ci et les suivantes » n'en réécrit qu'une part.
   *
   * Au-delà, on n'a plus d'atomicité possible : on CRÉE D'ABORD, on
   * supprime ensuite. Une panne laisse alors des doublons — visibles, et
   * que le pro peut retirer — plutôt qu'une série effacée sans
   * remplacement, qui, elle, rouvre silencieusement des créneaux.
   */
  async remplacerSerie(
    providerId: string,
    idsASupprimer: string[],
    docs: Array<Omit<BlockedSlot, 'id' | 'createdAt'>>,
  ): Promise<{ ids: string[]; atomique: boolean }> {
    if (idsASupprimer.length + docs.length <= 450) {
      const batch = writeBatch(this.db);
      for (const id of idsASupprimer) batch.delete(this.getDocRef(providerId, id));
      const ids: string[] = [];
      for (const data of docs) {
        const ref = doc(this.getCollectionRef(providerId));
        batch.set(ref, this.versFirestore(data));
        ids.push(ref.id);
      }
      await batch.commit();
      return { ids, atomique: true };
    }
    const ids = await this.createMany(providerId, docs);
    await this.deleteMany(providerId, idsASupprimer);
    return { ids, atomique: false };
  }

  /** Supprime des blocages par lots atomiques de 400. */
  async deleteMany(providerId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = writeBatch(this.db);
      for (const id of ids.slice(i, i + 400)) batch.delete(this.getDocRef(providerId, id));
      await batch.commit();
    }
  }

  /**
   * Get blocked slot by ID
   */
  async getById(providerId: string, blockedSlotId: string): Promise<WithId<BlockedSlot> | null> {
    const docRef = this.getDocRef(providerId, blockedSlotId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...versModele(docSnap.data()),
    };
  }

  /**
   * Get all blocked slots for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...versModele(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots by member
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('memberId', '==', memberId),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...versModele(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots by location
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('locationId', '==', locationId),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...versModele(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots in date range
   */
  async getInRange(
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      where('endDate', '>=', Timestamp.fromDate(startDate)),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...versModele(docSnap.data()),
    }));
  }

  /**
   * Real-time subscription to blocked slots in a date range. Returns
   * an unsubscribe function — call it on cleanup. The callback runs
   * every time the query result changes (add / edit / delete), so
   * the calendar updates without needing manual refetch or pull-to-
   * refresh.
   *
   * Same query shape as `getInRange` — keep them in sync if you tweak
   * the range semantics.
   */
  subscribeInRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
    onChange: (slots: WithId<BlockedSlot>[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    const q = query(
      this.getCollectionRef(providerId),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      where('endDate', '>=', Timestamp.fromDate(startDate)),
      orderBy('startDate', 'asc')
    );
    return onSnapshot(
      q,
      (snap) => {
        const slots = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...versModele(docSnap.data()),
        }));
        onChange(slots);
      },
      (err) => {
        console.error('[blockedSlotRepository] subscribeInRange error', err);
        onError?.(err);
      },
    );
  }

  /**
   * Get blocked slots for member in date range
   */
  async getByMemberInRange(
    providerId: string,
    memberId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('memberId', '==', memberId),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    // Filter by endDate in memory (Firestore limitation on multiple range filters)
    return querySnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...versModele(docSnap.data()),
      }))
      .filter((slot) => slot.endDate >= startDate);
  }

  /**
   * Get upcoming blocked slots
   */
  async getUpcoming(providerId: string): Promise<WithId<BlockedSlot>[]> {
    const now = new Date();
    const q = query(
      this.getCollectionRef(providerId),
      where('endDate', '>=', Timestamp.fromDate(now)),
      orderBy('endDate', 'asc'),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...versModele(docSnap.data()),
    }));
  }

  /**
   * Update blocked slot
   */
  async update(
    providerId: string,
    blockedSlotId: string,
    data: Partial<Omit<BlockedSlot, 'id' | 'createdAt'>>
  ): Promise<void> {
    const docRef = this.getDocRef(providerId, blockedSlotId);
    const updateData: Record<string, unknown> = { ...data };

    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = Timestamp.fromDate(data.endDate);
    }

    await updateDoc(docRef, removeUndefined(updateData));
  }

  /**
   * Delete blocked slot
   */
  async delete(providerId: string, blockedSlotId: string): Promise<void> {
    const docRef = this.getDocRef(providerId, blockedSlotId);
    await deleteDoc(docRef);
  }

  /**
   * Delete all blocked slots for a member
   */
  async deleteByMember(providerId: string, memberId: string): Promise<void> {
    const slots = await this.getByMember(providerId, memberId);
    const deletes = slots.map((slot) =>
      deleteDoc(this.getDocRef(providerId, slot.id))
    );
    await Promise.all(deletes);
  }

  /**
   * Delete past blocked slots (cleanup)
   */
  async deletePast(providerId: string): Promise<number> {
    const now = new Date();
    const q = query(
      this.getCollectionRef(providerId),
      where('endDate', '<', Timestamp.fromDate(now))
    );
    const querySnapshot = await getDocs(q);

    const deletes = querySnapshot.docs.map((docSnap) =>
      deleteDoc(docSnap.ref)
    );
    await Promise.all(deletes);

    return querySnapshot.size;
  }
}

// Singleton instance
export const blockedSlotRepository = new BlockedSlotRepository();
