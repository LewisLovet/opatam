'use client';

/**
 * /admin/galleries/[slug] — editor for a vertical-landing gallery.
 *
 * Two ways to add an image:
 *   1. Upload a file → goes to Firebase Storage under
 *      `landing/galleries/{slug}/{uuid}.jpg`, the download URL is
 *      stored in the Firestore item.
 *   2. Paste a URL → stored as-is. Useful for re-using a provider
 *      portfolio shot that already lives in Storage, or hotlinking
 *      from an external CDN.
 *
 * Items are reorderable (move up / move down) and have an alt text
 * field that drives accessibility AND SEO. Save writes the entire
 * ordered list back to `landingGalleries/{slug}` in one operation —
 * see LandingGalleryRepository.upsert.
 *
 * Public consumer: apps/web/app/[slug]/page.tsx server-fetches this
 * doc on render. Empty doc → placeholders shown.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Crop,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Pencil,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  landingGalleryRepository,
  storage,
  storagePaths,
} from '@booking-app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ImageCropModal } from '@/components/ui/ImageCropModal';
import type { LandingGallery, LandingGalleryItem } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers / SSR
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * What the crop modal is currently doing — either creating a new
 * gallery item, or replacing the source of an existing one. The
 * onCropComplete handler reads this to decide which list mutation
 * to apply after the upload finishes.
 */
type CropIntent =
  | { kind: 'new'; alt: string }
  | { kind: 'replace'; itemId: string };

export default function AdminGalleryEditor({ params }: PageProps) {
  const { firebaseUser } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);
  const [items, setItems] = useState<LandingGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [altDraft, setAltDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Crop modal state — wired to <ImageCropModal>. We feed it a blob
  // URL (for file uploads) or a remote URL (for URL adds / recrops);
  // the modal handles CORS-safe conversion internally.
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropIntent, setCropIntent] = useState<CropIntent | null>(null);
  // Object URLs we create from File pickers need to be revoked when
  // the modal closes, otherwise they leak across uploads.
  const cropBlobUrlRef = useRef<string | null>(null);

  // Batch-upload queue. When the user picks multiple files at once,
  // we crop them one by one — sequential rather than parallel so the
  // user can frame each one deliberately. The next file is opened
  // automatically when the previous modal closes.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Resolve params (Next.js 15 makes `params` a Promise in client
  // components — we unwrap it to a stable string).
  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  // Load the gallery doc when slug becomes available.
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    landingGalleryRepository
      .getBySlug(slug)
      .then((doc: WithId<LandingGallery> | null) => {
        setItems(doc?.items ?? []);
      })
      .catch((err: unknown) => {
        console.error('[admin/galleries] load failed', err);
        setError('Impossible de charger la galerie.');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  /** Build a fresh LandingGalleryItem from an uploaded src + alt. */
  const buildNewItem = useCallback(
    (src: string, alt: string, lastOrder: number): LandingGalleryItem => ({
      id: generateId(),
      src: src.trim(),
      alt: alt.trim() || 'Photo nail art',
      order: lastOrder + 10,
      uploadedAt: new Date(),
      uploadedBy: firebaseUser?.uid ?? undefined,
    }),
    [firebaseUser?.uid],
  );

  /** Push the cropped blob to Firebase Storage and return the
   *  download URL. Centralised so both the "new item" and "recrop"
   *  paths use the same upload logic. */
  const uploadCroppedBlob = useCallback(
    async (blob: Blob): Promise<string> => {
      if (!slug) throw new Error('Slug not ready');
      const path = `${storagePaths.landingGallery(slug)}/${generateId()}.jpg`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      return getDownloadURL(storageRef);
    },
    [slug],
  );

  /** Close the crop modal and free any blob URL we created. */
  const closeCropModal = useCallback(() => {
    if (cropBlobUrlRef.current) {
      URL.revokeObjectURL(cropBlobUrlRef.current);
      cropBlobUrlRef.current = null;
    }
    setCropSource(null);
    setCropIntent(null);
  }, []);

  /** Queue one or more files for the crop-then-upload pipeline. The
   *  first file opens the crop modal immediately (via the effect
   *  below); the rest sit in `pendingFiles` and the next is picked
   *  up automatically when the modal closes. Non-image entries are
   *  filtered out silently with a soft warning. */
  const queueFilesForCrop = useCallback((files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    const skipped = files.length - images.length;
    if (skipped > 0) {
      setError(
        `${skipped} fichier(s) ignoré(s) — seules les images sont acceptées.`,
      );
    } else {
      setError(null);
    }
    if (images.length === 0) return;
    setPendingFiles((prev) => [...prev, ...images]);
    // Reset the input so picking the same files twice in a row
    // still triggers the change event.
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // Effect: when there are pending files AND no crop modal is open,
  // pop the next file and open the modal for it. This is what
  // creates the "one file → crop → upload → next file → crop → …"
  // sequential UX for batch uploads.
  useEffect(() => {
    if (cropSource) return;
    if (pendingFiles.length === 0) return;
    const [next, ...rest] = pendingFiles;
    setPendingFiles(rest);
    const url = URL.createObjectURL(next);
    cropBlobUrlRef.current = url;
    setCropIntent({ kind: 'new', alt: altDraft });
    setCropSource(url);
    // `altDraft` is intentionally captured — each batch file gets
    // the same alt text. The user can refine per-item alts after
    // uploads land in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropSource, pendingFiles]);

  /** Open the crop modal for a pasted URL. */
  const openCropForUrl = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      setCropIntent({ kind: 'new', alt: altDraft });
      setCropSource(trimmed);
    },
    [altDraft],
  );

  /** Open the crop modal to recrop an existing item. */
  const openCropForItem = useCallback((item: LandingGalleryItem) => {
    setCropIntent({ kind: 'replace', itemId: item.id });
    setCropSource(item.src);
  }, []);

  /** Push a given list of items to Firestore. The "save" button
   *  passes the current items state; the auto-save (after upload)
   *  passes the freshly-computed array so we don't race against
   *  React's setState batching. */
  const persistItems = useCallback(
    async (itemsToSave: LandingGalleryItem[]) => {
      if (!slug) return;
      setSaving(true);
      setError(null);
      try {
        await landingGalleryRepository.upsert(slug, itemsToSave);
        setSavedAt(new Date());
      } catch (err) {
        console.error('[admin/galleries] save failed', err);
        setError('La sauvegarde a échoué. Réessayez ?');
      } finally {
        setSaving(false);
      }
    },
    [slug],
  );

  /** Cropped blob → upload → apply intent → auto-save. We compute
   *  the next items array locally (rather than relying on React's
   *  async setState) so we can pass it to persistItems immediately. */
  const handleCropComplete = useCallback(
    async (blob: Blob) => {
      if (!cropIntent) return;
      setUploading(true);
      setError(null);
      try {
        const url = await uploadCroppedBlob(blob);
        const lastOrder = items[items.length - 1]?.order ?? -10;
        const nextItems =
          cropIntent.kind === 'new'
            ? [...items, buildNewItem(url, cropIntent.alt, lastOrder)]
            : items.map((item) =>
                item.id === cropIntent.itemId ? { ...item, src: url } : item,
              );
        setItems(nextItems);
        setUrlDraft('');
        setAltDraft('');
        // Auto-save — uploads are the most "expensive" operations
        // (blob already in Storage, would be a wasted file if we
        // didn't persist the link). Edits / reorders / deletes
        // still require a manual click on "Sauvegarder".
        await persistItems(nextItems);
      } catch (err) {
        console.error('[admin/galleries] upload failed', err);
        setError("L'upload a échoué. Réessayez ?");
      } finally {
        setUploading(false);
        closeCropModal();
      }
    },
    [cropIntent, uploadCroppedBlob, items, buildNewItem, persistItems, closeCropModal],
  );

  const moveItem = useCallback((idx: number, direction: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const swapIdx = idx + direction;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateAlt = useCallback((id: string, alt: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, alt } : item)),
    );
  }, []);

  const save = useCallback(() => persistItems(items), [persistItems, items]);

  const savedLabel = useMemo(() => {
    if (!savedAt) return null;
    return savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }, [savedAt]);

  if (loading || !slug) {
    return (
      <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        Chargement…
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/admin/galleries"
          className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Toutes les galeries
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Galerie — {slug}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {items.length} {items.length === 1 ? 'image' : 'images'} ·{' '}
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
              >
                Voir la landing
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sauvegarde…
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Sauvegarder
              </>
            )}
          </button>
        </div>
        {savedLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sauvegardé à {savedLabel}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      {/* Add new item */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
          Ajouter une image
        </h2>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Depuis votre ordinateur
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) queueFilesForCrop(files);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi en cours…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Choisir des images
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              JPEG ou PNG, idéalement carré (~800 × 800), &lt; 500 Ko. Sélection
              multiple supportée — les images sont cadrées une par une.
              {pendingFiles.length > 0 && (
                <>
                  {' '}
                  <span className="font-medium text-primary-700 dark:text-primary-300">
                    {pendingFiles.length} restante{pendingFiles.length > 1 ? 's' : ''} dans la file.
                  </span>
                </>
              )}
            </p>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Depuis une URL
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="https://…"
                  className="w-full pl-9 pr-3 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => openCropForUrl(urlDraft)}
                disabled={!urlDraft.trim()}
                className="px-4 py-3 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                Ajouter
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Firebase Storage, CDN externe, n&apos;importe quelle URL HTTPS.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Description (alt text) — appliqué à la prochaine image ajoutée
          </label>
          <input
            type="text"
            value={altDraft}
            onChange={(e) => setAltDraft(e.target.value)}
            placeholder="Ex : Manucure russe minimaliste sur fond crème"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-12 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Aucune image pour l&apos;instant. La landing affiche des placeholders
            tant que cette galerie est vide.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li
              key={item.id}
              className="flex items-center gap-4 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {/* Thumbnail */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.src}
                alt={item.alt}
                className="w-20 h-20 rounded-lg object-cover bg-gray-200 dark:bg-gray-700 flex-shrink-0"
              />

              {/* Edit fields — alt-text input is the primary edit
                  affordance per item. Visible border + label make it
                  obvious that it's a real input (the previous borderless
                  pattern read as static text). */}
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Pencil className="w-3 h-3" />
                  Description (alt text)
                </label>
                <input
                  type="text"
                  value={item.alt}
                  onChange={(e) => updateAlt(item.id, e.target.value)}
                  placeholder="Ex : Manucure russe minimaliste sur fond crème"
                  className="w-full px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-900/30 focus:outline-none bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
                />
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500 truncate">
                  {item.src}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openCropForItem(item)}
                  aria-label="Recadrer"
                  title="Recadrer cette image"
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                >
                  <Crop className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Monter"
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-400"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  aria-label="Descendre"
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 text-gray-600 dark:text-gray-400"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label="Supprimer"
                  className="p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Crop modal — opens for new uploads, URL adds, and recrop on
          existing items. Aspect 1:1 because the gallery tile is
          square; the modal handles cross-origin URLs internally via
          the proxy / blob conversion. */}
      <ImageCropModal
        isOpen={!!cropSource}
        onClose={closeCropModal}
        imageUrl={cropSource ?? ''}
        aspect={1}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
