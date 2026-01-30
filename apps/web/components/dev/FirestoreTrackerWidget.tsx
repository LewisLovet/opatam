'use client';

import { useState, useEffect, useCallback } from 'react';
import { firestoreTracker, type TrackerSummary } from '@booking-app/firebase';
import {
  Flame,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Power,
  Trash2,
  BookOpen,
  PenLine,
  X,
} from 'lucide-react';

/**
 * Widget flottant pour afficher les stats Firestore en temps reel
 * Visible uniquement en developpement
 */
export function FirestoreTrackerWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [showCollections, setShowCollections] = useState(false);

  useEffect(() => {
    const unsubscribe = firestoreTracker.subscribe((newSummary) => {
      setSummary(newSummary);
    });
    return unsubscribe;
  }, []);

  const toggleTracking = useCallback(() => {
    if (firestoreTracker.isEnabled()) {
      firestoreTracker.disable();
    } else {
      firestoreTracker.enable();
    }
  }, []);

  const resetCounters = useCallback(() => {
    firestoreTracker.reset();
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  const isEnabled = summary?.enabled ?? false;

  // Version minimisee
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all"
        title="Firestore Tracker"
      >
        <Flame className="w-5 h-5 text-orange-500" />
        {isEnabled && summary && (
          <span className="text-sm font-mono">
            R:{summary.totalDocumentsRead} W:{summary.totalWrites}
          </span>
        )}
      </button>
    );
  }

  // Version etendue
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-gray-900 text-white rounded-lg shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <span className="font-semibold">Firestore Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTracking}
            className={`p-1.5 rounded transition-colors ${
              isEnabled
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-gray-600 hover:bg-gray-500'
            }`}
            title={isEnabled ? 'Desactiver' : 'Activer'}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-gray-700 rounded transition-colors"
            title="Minimiser"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {!isEnabled ? (
          <p className="text-gray-400 text-sm text-center py-4">
            Tracking desactive. Cliquez sur le bouton power pour commencer.
          </p>
        ) : summary ? (
          <>
            {/* Stats principales */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-900/50 rounded p-2 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {summary.totalDocumentsRead}
                </div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  Reads
                </div>
              </div>
              <div className="bg-green-900/50 rounded p-2 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {summary.totalWrites}
                </div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <PenLine className="w-3 h-3" />
                  Writes
                </div>
              </div>
              <div className="bg-red-900/50 rounded p-2 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {summary.totalDeletes}
                </div>
                <div className="text-xs text-gray-400 flex items-center justify-center gap-1">
                  <X className="w-3 h-3" />
                  Deletes
                </div>
              </div>
            </div>

            {/* Cout estime */}
            <div className="bg-yellow-900/30 rounded p-2 text-center">
              <div className="text-sm text-yellow-400">
                Cout estime:{' '}
                <span className="font-mono">
                  ${summary.estimatedCost.total.toFixed(6)}
                </span>
              </div>
            </div>

            {/* Derniere operation */}
            {summary.lastOperation && (
              <div className="text-xs text-gray-400 bg-gray-800 rounded p-2">
                <span className="text-gray-500">Derniere:</span>{' '}
                <span
                  className={
                    summary.lastOperation.type === 'read'
                      ? 'text-blue-400'
                      : summary.lastOperation.type === 'write'
                        ? 'text-green-400'
                        : 'text-red-400'
                  }
                >
                  {summary.lastOperation.type.toUpperCase()}
                </span>{' '}
                <span className="font-mono">{summary.lastOperation.collection}</span>
                {summary.lastOperation.count > 1 && (
                  <span className="text-gray-500">
                    {' '}
                    ({summary.lastOperation.count} docs)
                  </span>
                )}
              </div>
            )}

            {/* Toggle details par collection */}
            <button
              onClick={() => setShowCollections(!showCollections)}
              className="w-full text-left text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
            >
              {showCollections ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Details par collection
            </button>

            {/* Details par collection */}
            {showCollections && Object.keys(summary.byCollection).length > 0 && (
              <div className="space-y-1">
                {Object.entries(summary.byCollection).map(([collection, stats]) => (
                  <div
                    key={collection}
                    className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1"
                  >
                    <span
                      className="font-mono text-gray-300 truncate max-w-[150px]"
                      title={collection}
                    >
                      {collection}
                    </span>
                    <div className="flex gap-2 text-gray-400">
                      {stats.documentsRead > 0 && (
                        <span className="text-blue-400">R:{stats.documentsRead}</span>
                      )}
                      {stats.writes > 0 && (
                        <span className="text-green-400">W:{stats.writes}</span>
                      )}
                      {stats.deletes > 0 && (
                        <span className="text-red-400">D:{stats.deletes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contextes */}
            {summary.contexts.length > 0 && (
              <>
                <div className="text-xs text-gray-500 mt-2">Contextes:</div>
                <div className="space-y-1">
                  {summary.contexts.slice(-5).map((ctx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1"
                    >
                      <span className="text-gray-300 truncate max-w-[150px]">
                        {ctx.name}
                      </span>
                      <span className="text-gray-500">{ctx.duration}ms</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">Aucune donnee</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <button
          onClick={resetCounters}
          className="w-full py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-3 h-3" />
          Reset
        </button>
      </div>
    </div>
  );
}
