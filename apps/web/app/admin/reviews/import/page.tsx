'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminReviewService } from '@/services/admin/adminReviewService';
import { Button, Input, Loader, useToast } from '@/components/ui';
import { ArrowLeft, Search, Upload, Plus, Trash2, Star, CheckCircle2 } from 'lucide-react';
import { parseReviewCsv, type ParsedReviewRow } from './csvParser';
import { ConfirmModal } from '../../components/ConfirmModal';

interface ProviderResult {
  id: string;
  businessName: string;
  photoURL: string | null;
  rating: { average: number; count: number } | null;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

export default function ImportReviewsPage() {
  const { user } = useAuth();
  const toast = useToast();

  // Provider search
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [provider, setProvider] = useState<ProviderResult | null>(null);

  // Source
  const [source, setSource] = useState('planity');

  // Parsed items + per-row skip report (from CSV)
  const [rows, setRows] = useState<ParsedReviewRow[]>([]);
  const [skipped, setSkipped] = useState<{ line: number; reason: string }[]>([]);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry form
  const [mRating, setMRating] = useState(5);
  const [mDate, setMDate] = useState('');
  const [mComment, setMComment] = useState('');
  const [mService, setMService] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ created: number; skipped: number } | null>(null);

  // Bulk-delete (undo import) state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleBulkDelete = useCallback(async () => {
    if (!user?.id || !provider) return;
    setDeleting(true);
    try {
      const res = await adminReviewService.deleteImportedReviews(user.id, provider.id);
      toast.success(`${res.deleted} avis importé(s) supprimé(s). La note globale est recalculée automatiquement.`);
      setConfirmDelete(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  }, [user?.id, provider, toast]);

  const searchProviders = useCallback(async () => {
    if (!user?.id || query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/providers/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { 'x-admin-uid': user.id },
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  }, [user?.id, query, toast]);

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const report = parseReviewCsv(text);
      setMissingColumns(report.missingColumns);
      if (report.missingColumns.length > 0) {
        setRows([]);
        setSkipped([]);
        toast.error(`Colonnes manquantes : ${report.missingColumns.join(', ')}`);
        return;
      }
      // Append to anything already added manually.
      setRows((prev) => [...prev, ...report.rows]);
      setSkipped(report.skipped);
      setResultMsg(null);
      toast.success(`${report.rows.length} avis prêts, ${report.skipped.length} ignorés`);
    },
    [toast],
  );

  const addManual = useCallback(() => {
    if (!mDate) {
      toast.error('La date est requise');
      return;
    }
    const d = new Date(`${mDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      toast.error('Date invalide');
      return;
    }
    setRows((prev) => [
      ...prev,
      {
        rating: Math.min(5, Math.max(1, Math.round(mRating))),
        createdAt: d,
        comment: mComment.trim() || null,
        serviceLabel: mService.trim() || null,
        sourceRef: null,
      },
    ]);
    setMComment('');
    setMService('');
    setResultMsg(null);
  }, [mDate, mRating, mComment, mService, toast]);

  const removeRow = useCallback((idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Preview: resulting average/count after adding imported ratings.
  const preview = useMemo(() => {
    if (!provider) return null;
    const cur = provider.rating ?? { average: 0, count: 0 };
    const importedCount = rows.length;
    const importedSum = rows.reduce((s, r) => s + r.rating, 0);
    const newCount = cur.count + importedCount;
    const newAvg =
      newCount > 0 ? (cur.average * cur.count + importedSum) / newCount : 0;
    return {
      currentAvg: cur.average,
      currentCount: cur.count,
      newAvg: Math.round(newAvg * 10) / 10,
      newCount,
      importedCount,
    };
  }, [provider, rows]);

  const confirmImport = useCallback(async () => {
    if (!user?.id || !provider || rows.length === 0) return;
    setSubmitting(true);
    setResultMsg(null);
    try {
      const res = await adminReviewService.importReviews(user.id, {
        providerId: provider.id,
        source: source.trim() || 'planity',
        reviews: rows.map((r) => ({
          rating: r.rating,
          createdAt: r.createdAt.toISOString(),
          comment: r.comment,
          serviceLabel: r.serviceLabel,
          sourceRef: r.sourceRef,
        })),
      });
      setResultMsg({ created: res.created, skipped: res.skipped });
      toast.success(`${res.created} avis importés, ${res.skipped} ignorés (doublons)`);
      setRows([]);
      setSkipped([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'import");
    } finally {
      setSubmitting(false);
    }
  }, [user?.id, provider, rows, source, toast]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/reviews"
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Importer des avis</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Avis externes comptés dans la note globale, affichés avec un badge neutre « Avis importé ».
          </p>
        </div>
      </div>

      {/* Step 1 — Provider */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">1. Prestataire</h2>
        {provider ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {provider.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={provider.photoURL} alt="" className="w-9 h-9 object-cover" />
                ) : (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {provider.businessName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {provider.businessName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {provider.rating
                    ? `${provider.rating.average.toFixed(1)} / 5 · ${provider.rating.count} avis`
                    : 'Aucun avis'}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setProvider(null)}>
              Changer
            </Button>
          </div>
        ) : null}
        {provider && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              className="!text-red-600 !border-red-200 hover:!bg-red-50 dark:!text-red-400 dark:!border-red-900/40 dark:hover:!bg-red-900/20"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={() => setConfirmDelete(true)}
            >
              Supprimer tous les avis importés de ce prestataire
            </Button>
            <p className="mt-1.5 text-xs text-gray-400">
              Annule un import : supprime tous les avis importés du prestataire (toutes sources). La note globale est recalculée automatiquement.
            </p>
          </div>
        )}
        {!provider && (
          <>
            <div className="flex gap-2">
              <Input
                placeholder="Nom du salon…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchProviders()}
              />
              <Button onClick={searchProviders} loading={searching} leftIcon={<Search className="w-4 h-4" />}>
                Rechercher
              </Button>
            </div>
            {results.length > 0 && (
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-lg overflow-hidden">
                {results.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => {
                        setProvider(r);
                        setResults([]);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors flex items-center justify-between gap-3"
                    >
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {r.businessName}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {r.rating ? `${r.rating.average.toFixed(1)} / 5 · ${r.rating.count}` : '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Step 2 — Source */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">2. Source (interne)</h2>
        <Input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="planity"
          hint="Stockée en interne uniquement — jamais affichée publiquement."
        />
      </div>

      {/* Step 3 — Add reviews */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">3. Ajouter des avis</h2>

        {/* CSV upload */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">Import CSV</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Choisir un fichier CSV
          </Button>
          <p className="mt-2 text-xs text-gray-400">
            Format attendu : <code>Prenom;Mail;N°;Date;Note;Prestation;Commentaire</code> — Prénom et Mail sont ignorés.
          </p>
          {missingColumns.length > 0 && (
            <p className="mt-2 text-xs text-red-500">
              Colonnes manquantes : {missingColumns.join(', ')}
            </p>
          )}
          {skipped.length > 0 && (
            <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {skipped.length} ligne(s) ignorée(s) :
              <ul className="list-disc list-inside mt-1">
                {skipped.slice(0, 10).map((s) => (
                  <li key={s.line}>
                    Ligne {s.line} — {s.reason}
                  </li>
                ))}
                {skipped.length > 10 && <li>… et {skipped.length - 10} autres</li>}
              </ul>
            </div>
          )}
        </div>

        {/* Manual entry */}
        <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">Saisie manuelle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Note</label>
              <select
                value={mRating}
                onChange={(e) => setMRating(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} étoile{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            <Input type="date" label="Date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
            <Input
              label="Prestation (optionnel)"
              value={mService}
              onChange={(e) => setMService(e.target.value)}
              placeholder="Manucure…"
            />
            <Input
              label="Commentaire (optionnel)"
              value={mComment}
              onChange={(e) => setMComment(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={addManual}
          >
            Ajouter à la liste
          </Button>
        </div>
      </div>

      {/* Step 4 — Preview */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            4. Aperçu — {rows.length} avis prêts
          </h2>

          {preview && (
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/40 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Note actuelle</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {preview.currentAvg.toFixed(1)} / 5 · {preview.currentCount} avis
                </p>
              </div>
              <div className="rounded-lg bg-primary-50 dark:bg-primary-900/20 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Note après import</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {preview.newAvg.toFixed(1)} / 5 · {preview.newCount} avis
                </p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-lg max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700/60">
                <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Prestation</th>
                  <th className="px-3 py-2">Commentaire</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-gray-50 dark:border-gray-700/50">
                    <td className="px-3 py-2">
                      <StarRow rating={r.rating} />
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {r.createdAt.toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{r.serviceLabel || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {r.comment || '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeRow(i)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Retirer"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => setRows([])}>
              Tout effacer
            </Button>
            <Button onClick={confirmImport} loading={submitting} disabled={!provider}>
              {`Confirmer l'import (${rows.length})`}
            </Button>
          </div>
          {!provider && (
            <p className="mt-2 text-xs text-amber-500 text-right">Sélectionnez d'abord un prestataire.</p>
          )}
        </div>
      )}

      {/* Result */}
      {resultMsg && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            {resultMsg.created} avis importés · {resultMsg.skipped} ignorés (doublons). La note globale est recalculée
            automatiquement.
          </p>
        </div>
      )}

      {!user && (
        <div className="flex items-center justify-center h-24">
          <Loader size="lg" />
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleBulkDelete}
        loading={deleting}
        title="Supprimer les avis importés"
        description={
          provider
            ? `Tous les avis importés de « ${provider.businessName} » seront supprimés définitivement (toutes sources). Cette action est irréversible. La note globale sera recalculée automatiquement.`
            : ''
        }
        confirmLabel="Tout supprimer"
        confirmVariant="danger"
      />
    </div>
  );
}
