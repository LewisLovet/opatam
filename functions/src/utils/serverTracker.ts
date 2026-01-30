/**
 * Server-side Firestore Tracker
 *
 * Compteur simple pour les operations Firestore cote Cloud Functions.
 * Affiche un resume dans les logs a la fin de chaque execution.
 */

type OperationType = 'read' | 'write' | 'delete';

interface Operation {
  type: OperationType;
  collection: string;
  count: number;
}

class ServerFirestoreTracker {
  private operations: Operation[] = [];
  private contextName: string | null = null;
  private startTime: number = 0;

  /**
   * Demarre un contexte de tracking (nom de la fonction)
   */
  startContext(name: string): void {
    this.reset();
    this.contextName = name;
    this.startTime = Date.now();
  }

  /**
   * Enregistre une lecture
   */
  trackRead(collection: string, count: number = 1): void {
    this.operations.push({ type: 'read', collection, count });
  }

  /**
   * Enregistre une ecriture
   */
  trackWrite(collection: string, count: number = 1): void {
    this.operations.push({ type: 'write', collection, count });
  }

  /**
   * Enregistre une suppression
   */
  trackDelete(collection: string, count: number = 1): void {
    this.operations.push({ type: 'delete', collection, count });
  }

  /**
   * Termine le contexte et affiche le resume
   */
  endContext(): void {
    const duration = Date.now() - this.startTime;
    const summary = this.getSummary();

    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log(`║  FIRESTORE TRACKER: ${this.contextName || 'unknown'}`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Duration: ${duration}ms`);
    console.log(`║  Total Operations: ${summary.totalOperations}`);
    console.log(`║  ├─ Reads: ${summary.totalReads} (${summary.totalDocumentsRead} docs)`);
    console.log(`║  ├─ Writes: ${summary.totalWrites}`);
    console.log(`║  └─ Deletes: ${summary.totalDeletes}`);
    console.log('║');
    console.log(`║  Estimated Cost: $${summary.estimatedCost.toFixed(6)}`);

    if (Object.keys(summary.byCollection).length > 0) {
      console.log('║');
      console.log('║  By Collection:');
      for (const [coll, stats] of Object.entries(summary.byCollection)) {
        const parts = [];
        if (stats.reads > 0) parts.push(`R:${stats.reads}`);
        if (stats.writes > 0) parts.push(`W:${stats.writes}`);
        if (stats.deletes > 0) parts.push(`D:${stats.deletes}`);
        console.log(`║    ${coll}: ${parts.join(' ')}`);
      }
    }

    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');

    this.reset();
  }

  /**
   * Retourne le resume des operations
   */
  private getSummary() {
    const byCollection: Record<string, { reads: number; writes: number; deletes: number }> = {};

    let totalReads = 0;
    let totalWrites = 0;
    let totalDeletes = 0;
    let totalDocumentsRead = 0;

    for (const op of this.operations) {
      if (!byCollection[op.collection]) {
        byCollection[op.collection] = { reads: 0, writes: 0, deletes: 0 };
      }

      switch (op.type) {
        case 'read':
          byCollection[op.collection].reads += op.count;
          totalReads++;
          totalDocumentsRead += op.count;
          break;
        case 'write':
          byCollection[op.collection].writes += op.count;
          totalWrites += op.count;
          break;
        case 'delete':
          byCollection[op.collection].deletes += op.count;
          totalDeletes += op.count;
          break;
      }
    }

    // Estimation des couts (USD)
    const readCost = (totalDocumentsRead / 100000) * 0.06;
    const writeCost = (totalWrites / 100000) * 0.18;
    const deleteCost = (totalDeletes / 100000) * 0.02;

    return {
      totalReads,
      totalWrites,
      totalDeletes,
      totalDocumentsRead,
      totalOperations: totalReads + totalWrites + totalDeletes,
      byCollection,
      estimatedCost: readCost + writeCost + deleteCost,
    };
  }

  /**
   * Reinitialise le tracker
   */
  private reset(): void {
    this.operations = [];
    this.contextName = null;
    this.startTime = 0;
  }
}

export const serverTracker = new ServerFirestoreTracker();
