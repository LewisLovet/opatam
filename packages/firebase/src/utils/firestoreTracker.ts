/**
 * Firestore Operations Tracker
 *
 * Utilitaire pour compter les lectures/ecritures Firestore.
 * Utilisable cote client (web/mobile) et serveur (Cloud Functions).
 *
 * Usage:
 *   import { firestoreTracker } from '@booking-app/firebase';
 *
 *   firestoreTracker.enable();
 *   firestoreTracker.startContext('loadProviderPage');
 *   // ... operations Firestore ...
 *   firestoreTracker.endContext();
 */

type OperationType = 'read' | 'write' | 'delete';

interface Operation {
  type: OperationType;
  collection: string;
  documentId?: string;
  timestamp: Date;
  context?: string;
  count: number;
}

interface CollectionStats {
  reads: number;
  writes: number;
  deletes: number;
  documentsRead: number;
}

interface ContextStats {
  name: string;
  startTime: Date;
  endTime?: Date;
  operations: Operation[];
}

interface TrackerSummary {
  enabled: boolean;
  totalReads: number;
  totalWrites: number;
  totalDeletes: number;
  totalDocumentsRead: number;
  totalOperations: number;
  byCollection: Record<string, CollectionStats>;
  contexts: Array<{
    name: string;
    duration: number;
    reads: number;
    writes: number;
    deletes: number;
  }>;
  estimatedCost: {
    reads: number;
    writes: number;
    deletes: number;
    total: number;
  };
  lastOperation?: Operation;
}

type TrackerListener = (summary: TrackerSummary) => void;

class FirestoreTracker {
  private enabled = false;
  private operations: Operation[] = [];
  private currentContext: string | null = null;
  private contexts: ContextStats[] = [];
  private activeContext: ContextStats | null = null;
  private listeners = new Set<TrackerListener>();

  /**
   * Active le tracking
   */
  enable(): void {
    this.enabled = true;
    this.notifyListeners();
  }

  /**
   * Desactive le tracking
   */
  disable(): void {
    this.enabled = false;
    this.notifyListeners();
  }

  /**
   * Verifie si le tracking est active
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * S'abonne aux mises a jour du tracker
   */
  subscribe(listener: TrackerListener): () => void {
    this.listeners.add(listener);
    listener(this.getSummary());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const summary = this.getSummary();
    this.listeners.forEach((listener) => listener(summary));
  }

  /**
   * Demarre un contexte de tracking (ex: nom d'une fonction)
   */
  startContext(name: string): void {
    if (!this.enabled) return;

    this.currentContext = name;
    this.activeContext = {
      name,
      startTime: new Date(),
      operations: [],
    };
  }

  /**
   * Termine le contexte actuel
   */
  endContext(): ContextStats | null {
    if (!this.enabled || !this.activeContext) return null;

    this.activeContext.endTime = new Date();
    this.contexts.push(this.activeContext);

    const completed = this.activeContext;
    this.activeContext = null;
    this.currentContext = null;

    this.notifyListeners();
    return completed;
  }

  /**
   * Enregistre une lecture (getDoc)
   */
  trackRead(collection: string, documentId?: string): void {
    if (!this.enabled) return;
    this.trackOperation('read', collection, documentId, 1);
  }

  /**
   * Enregistre une lecture multiple (getDocs)
   */
  trackReadMultiple(collection: string, documentCount: number): void {
    if (!this.enabled) return;
    this.trackOperation('read', collection, undefined, documentCount);
  }

  /**
   * Enregistre une ecriture (setDoc, addDoc, updateDoc)
   */
  trackWrite(collection: string, documentId?: string): void {
    if (!this.enabled) return;
    this.trackOperation('write', collection, documentId, 1);
  }

  /**
   * Enregistre une suppression (deleteDoc)
   */
  trackDelete(collection: string, documentId?: string): void {
    if (!this.enabled) return;
    this.trackOperation('delete', collection, documentId, 1);
  }

  private trackOperation(
    type: OperationType,
    collection: string,
    documentId: string | undefined,
    count: number
  ): void {
    const operation: Operation = {
      type,
      collection: this.normalizeCollectionName(collection),
      documentId,
      timestamp: new Date(),
      context: this.currentContext || undefined,
      count,
    };

    this.operations.push(operation);

    if (this.activeContext) {
      this.activeContext.operations.push(operation);
    }

    this.notifyListeners();
  }

  /**
   * Normalise le nom de collection (remplace les IDs par *)
   */
  private normalizeCollectionName(path: string): string {
    return path.replace(/\/[a-zA-Z0-9_-]{15,}/g, '/*');
  }

  /**
   * Retourne les statistiques par collection
   */
  getStatsByCollection(): Record<string, CollectionStats> {
    const stats: Record<string, CollectionStats> = {};

    for (const op of this.operations) {
      if (!stats[op.collection]) {
        stats[op.collection] = { reads: 0, writes: 0, deletes: 0, documentsRead: 0 };
      }

      switch (op.type) {
        case 'read':
          stats[op.collection].reads++;
          stats[op.collection].documentsRead += op.count;
          break;
        case 'write':
          stats[op.collection].writes++;
          break;
        case 'delete':
          stats[op.collection].deletes++;
          break;
      }
    }

    return stats;
  }

  /**
   * Retourne le resume global
   */
  getSummary(): TrackerSummary {
    const byCollection = this.getStatsByCollection();

    let totalReads = 0;
    let totalWrites = 0;
    let totalDeletes = 0;
    let totalDocumentsRead = 0;

    for (const stats of Object.values(byCollection)) {
      totalReads += stats.reads;
      totalWrites += stats.writes;
      totalDeletes += stats.deletes;
      totalDocumentsRead += stats.documentsRead;
    }

    const contexts = this.contexts.map((ctx) => {
      let reads = 0,
        writes = 0,
        deletes = 0;
      for (const op of ctx.operations) {
        if (op.type === 'read') reads += op.count;
        else if (op.type === 'write') writes++;
        else if (op.type === 'delete') deletes++;
      }
      return {
        name: ctx.name,
        duration: ctx.endTime ? ctx.endTime.getTime() - ctx.startTime.getTime() : 0,
        reads,
        writes,
        deletes,
      };
    });

    // Estimation des couts Firestore (USD)
    // Reads: $0.06 per 100,000
    // Writes: $0.18 per 100,000
    // Deletes: $0.02 per 100,000
    const readCost = (totalDocumentsRead / 100000) * 0.06;
    const writeCost = (totalWrites / 100000) * 0.18;
    const deleteCost = (totalDeletes / 100000) * 0.02;

    return {
      enabled: this.enabled,
      totalReads,
      totalWrites,
      totalDeletes,
      totalDocumentsRead,
      totalOperations: totalReads + totalWrites + totalDeletes,
      byCollection,
      contexts,
      estimatedCost: {
        reads: readCost,
        writes: writeCost,
        deletes: deleteCost,
        total: readCost + writeCost + deleteCost,
      },
      lastOperation: this.operations[this.operations.length - 1],
    };
  }

  /**
   * Affiche le resume dans la console
   */
  printSummary(): void {
    const summary = this.getSummary();

    console.log('\n========== FIRESTORE TRACKER ==========');
    console.log(`Operations: ${summary.totalOperations}`);
    console.log(`  Reads: ${summary.totalReads} (${summary.totalDocumentsRead} docs)`);
    console.log(`  Writes: ${summary.totalWrites}`);
    console.log(`  Deletes: ${summary.totalDeletes}`);
    console.log(`Estimated Cost: $${summary.estimatedCost.total.toFixed(6)}`);
    console.log('========================================\n');
  }

  /**
   * Reinitialise tous les compteurs
   */
  reset(): void {
    this.operations = [];
    this.contexts = [];
    this.activeContext = null;
    this.currentContext = null;
    this.notifyListeners();
  }

  /**
   * Retourne les operations brutes
   */
  getOperations(): Operation[] {
    return [...this.operations];
  }
}

// Singleton instance
export const firestoreTracker = new FirestoreTracker();

// Types exportes
export type {
  Operation,
  CollectionStats,
  ContextStats,
  OperationType,
  TrackerSummary,
  TrackerListener,
};
