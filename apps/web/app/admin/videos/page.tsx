'use client';

/**
 * /admin/videos — les vidéos de prestataires mises en avant sur l'accueil.
 *
 * Une entrée = une vidéo + le salon qu'elle met en avant. La carte publique
 * renvoie vers `/p/{slug}` : ces vidéos montrent le travail réel fait avec
 * Opatam ET envoient du trafic aux prestataires.
 *
 * Ce que fait cet écran :
 *   - chercher un prestataire (autocomplétion) — nom, sous-titre, photo et
 *     slug sont recopiés dans l'entrée, donc une seule lecture à l'affichage ;
 *   - DEUX façons d'ajouter une vidéo :
 *       · un fichier envoyé dans Storage (`landing/videos/home`), dont
 *         L'AFFICHE est extraite automatiquement (première image) — c'est
 *         elle qui est chargée sur l'accueil, jamais la vidéo ;
 *       · un lien YouTube : rien à héberger, l'affiche vient de YouTube et
 *         la vidéo reste sur la chaîne du prestataire. C'est le cas le plus
 *         courant, les salons publient déjà là-bas ;
 *   - citation facultative (avec = témoignage, sans = vitrine) ;
 *   - ordre d'affichage, publication différée, suppression.
 *
 * Une sauvegarde réécrit toute la liste ordonnée dans
 * `landingVideos/home` — voir LandingVideoRepository.upsert.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Save,
  Link2,
  Search,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminHeaders } from '@/services/admin/adminFetch';
import {
  landingVideoRepository,
  storage,
  storagePaths,
  uploadFileWithProgress,
} from '@booking-app/firebase';
import { ref, getDownloadURL } from 'firebase/storage';
import { extractYouTubeId, getCategoryLabel } from '@booking-app/shared';
import { meilleureAfficheYoutube } from '@/lib/youtubePoster';
import type { LandingVideoItem } from '@booking-app/shared';
import { Button, Input, Switch, Textarea } from '@/components/ui';

/** Emplacement alimenté par cet écran. Un second viendrait ici. */
const SLOT = 'home';
const MAX_VIDEO_MB = 60;

interface ProviderHit {
  id: string;
  businessName: string;
  slug: string | null;
  category: string | null;
  city: string | null;
  photoURL: string | null;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sousTitre(category: string | null, city: string | null): string {
  return [category ? getCategoryLabel(category) : null, city].filter(Boolean).join(' · ');
}

/**
 * Première image de la vidéo, en JPEG — l'affiche de la carte.
 *
 * Faite dans le navigateur, sur le fichier local, AVANT l'envoi : aucun
 * traitement serveur, et l'admin n'a pas de capture d'écran à préparer.
 * Rend `null` si le navigateur refuse de décoder (l'admin fournit alors
 * son affiche à la main).
 */
function extraireAffiche(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let fini = false;
    const terminer = (blob: Blob | null) => {
      if (fini) return;
      fini = true;
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadeddata = () => {
      // Pas l'image zéro : souvent noire le temps que l'exposition se fasse.
      video.currentTime = Math.min(0.4, (video.duration || 2) / 4);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width) return terminer(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => terminer(b), 'image/jpeg', 0.85);
      } catch {
        terminer(null);
      }
    };
    video.onerror = () => terminer(null);
    // Filet : un fichier exotique peut ne jamais déclencher d'événement.
    setTimeout(() => terminer(null), 10_000);
  });
}

export default function AdminLandingVideosPage() {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<LandingVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Formulaire d'ajout ──
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<ProviderHit[]>([]);
  const [cible, setCible] = useState<ProviderHit | null>(null);
  const [citation, setCitation] = useState('');
  const [lien, setLien] = useState('');
  const [progression, setProgression] = useState<number | null>(null);
  const fichierRef = useRef<HTMLInputElement | null>(null);
  const afficheRef = useRef<HTMLInputElement | null>(null);
  const [afficheCible, setAfficheCible] = useState<string | null>(null);

  useEffect(() => {
    landingVideoRepository
      .getBySlug(SLOT, { publishedOnly: false })
      .then((doc) => setItems(doc?.items ?? []))
      .catch((e) => {
        console.error('[admin/videos] chargement', e);
        setError('Impossible de charger les vidéos.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Autocomplétion prestataire — même route que les autres écrans admin.
  useEffect(() => {
    const q = recherche.trim();
    if (q.length < 2) {
      setResultats([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/providers/search?q=${encodeURIComponent(q)}`, {
          headers: await adminHeaders(),
        });
        const data = await res.json();
        setResultats(Array.isArray(data.results) ? data.results : []);
      } catch {
        setResultats([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [recherche]);

  const televerser = useCallback(
    async (file: File, extension: string, contentType: string): Promise<string> => {
      const chemin = `${storagePaths.landingVideos(SLOT)}/${newId()}.${extension}`;
      const tache = uploadFileWithProgress(chemin, file, { contentType });
      await new Promise<void>((resolve, reject) => {
        tache.on(
          'state_changed',
          (snap) => setProgression(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve(),
        );
      });
      return getDownloadURL(ref(storage, chemin));
    },
    [],
  );

  /**
   * Écrit la liste en base. Prend la liste en paramètre plutôt que de lire
   * l'état : l'ajout enregistre DANS LA FOULÉE, sans attendre le prochain
   * rendu — sinon il fallait cliquer « Ajouter » puis « Enregistrer », et
   * une vidéo ajoutée puis oubliée disparaissait au rechargement.
   */
  const enregistrer = useCallback(async (liste?: LandingVideoItem[]) => {
    setSaving(true);
    setError(null);
    try {
      await landingVideoRepository.upsert(SLOT, liste ?? items);
      setSavedAt(new Date());
    } catch (e) {
      console.error('[admin/videos] sauvegarde', e);
      setError('Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }, [items]);

  /**
   * Ce que les deux façons d'ajouter ont en commun : le prestataire recopié,
   * la citation, la place en fin de liste et le brouillon par défaut.
   */
  const ajouterEntree = useCallback(
    (base: Pick<LandingVideoItem, 'kind' | 'src' | 'poster' | 'youtubeId'>) => {
      if (!cible) return;
      setItems((prev) => {
        const suivante = [
          ...prev,
          {
            ...base,
            id: newId(),
            providerId: cible.id,
            providerSlug: cible.slug ?? '',
            businessName: cible.businessName,
            subtitle: sousTitre(cible.category, cible.city) || null,
            photoURL: cible.photoURL,
            quote: citation.trim() || null,
            order: prev.length * 10,
            published: false,
            addedAt: new Date(),
            addedBy: firebaseUser?.uid ?? undefined,
          },
        ];
        // Enregistré tout de suite : une vidéo ajoutée est une vidéo gardée.
        void enregistrer(suivante);
        return suivante;
      });
      setCitation('');
      setLien('');
      setCible(null);
      setRecherche('');
    },
    [cible, citation, enregistrer, firebaseUser?.uid],
  );

  /**
   * Lien YouTube — le chemin le plus court : rien n'est envoyé, l'affiche est
   * celle que YouTube génère, dans la plus grande taille qui existe pour
   * cette vidéo (voir lib/youtubePoster : la haute définition manque
   * souvent, et son absence ne se voit pas à un simple `onError`).
   */
  const ajouterLien = useCallback(async () => {
    if (!cible) {
      setError('Choisissez d’abord le prestataire mis en avant.');
      return;
    }
    const id = extractYouTubeId(lien.trim());
    if (!id) {
      setError('Lien YouTube non reconnu. Collez l’adresse de la vidéo (watch, youtu.be, Short…).');
      return;
    }
    setError(null);
    const poster = await meilleureAfficheYoutube(id);
    ajouterEntree({
      kind: 'youtube',
      youtubeId: id,
      src: `https://www.youtube.com/watch?v=${id}`,
      poster,
    });
  }, [ajouterEntree, cible, lien]);

  /** Envoi de la vidéo choisie + affiche extraite, puis ajout à la liste. */
  const ajouterVideo = useCallback(
    async (file: File) => {
      if (!cible) {
        setError('Choisissez d’abord le prestataire mis en avant.');
        return;
      }
      if (!file.type.startsWith('video/')) {
        setError('Ce fichier n’est pas une vidéo.');
        return;
      }
      if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(`Vidéo trop lourde (${Math.round(file.size / 1024 / 1024)} Mo, max ${MAX_VIDEO_MB} Mo).`);
        return;
      }
      setError(null);
      setProgression(0);
      try {
        // L'affiche d'abord : si le navigateur n'y arrive pas, on le sait
        // avant d'avoir envoyé 40 Mo pour rien.
        const affiche = await extraireAffiche(file);
        const src = await televerser(file, file.name.split('.').pop() || 'mp4', file.type);
        let poster = '';
        if (affiche) {
          poster = await televerser(
            new File([affiche], 'poster.jpg', { type: 'image/jpeg' }),
            'jpg',
            'image/jpeg',
          );
        }
        ajouterEntree({ kind: 'file', src, poster, youtubeId: null });
        if (!affiche) {
          setError('Affiche non extraite (format non lu par le navigateur) — ajoutez-la à la main sur la ligne.');
        }
      } catch (e) {
        console.error('[admin/videos] envoi', e);
        setError('Envoi impossible. Réessayez.');
      } finally {
        setProgression(null);
        if (fichierRef.current) fichierRef.current.value = '';
      }
    },
    [ajouterEntree, cible, televerser],
  );

  /** Affiche fournie à la main pour une entrée donnée. */
  const remplacerAffiche = useCallback(
    async (file: File) => {
      if (!afficheCible) return;
      if (!file.type.startsWith('image/')) {
        setError('L’affiche doit être une image.');
        return;
      }
      setProgression(0);
      try {
        const url = await televerser(file, 'jpg', file.type);
        setItems((prev) => prev.map((it) => (it.id === afficheCible ? { ...it, poster: url } : it)));
        setError(null);
      } catch {
        setError('Envoi de l’affiche impossible.');
      } finally {
        setProgression(null);
        setAfficheCible(null);
        if (afficheRef.current) afficheRef.current.value = '';
      }
    },
    [afficheCible, televerser],
  );

  const deplacer = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const cibleIdx = index + delta;
      if (cibleIdx < 0 || cibleIdx >= next.length) return prev;
      [next[index], next[cibleIdx]] = [next[cibleIdx], next[index]];
      return next;
    });
  };

  /** Renom, photo ou ville ont changé côté salon : on resynchronise. */
  const rafraichir = useCallback(async (item: LandingVideoItem) => {
    try {
      const res = await fetch(
        `/api/admin/providers/search?q=${encodeURIComponent(item.businessName.slice(0, 20))}`,
        { headers: await adminHeaders() },
      );
      const data = await res.json();
      const hit: ProviderHit | undefined = (data.results ?? []).find(
        (r: ProviderHit) => r.id === item.providerId,
      );
      if (!hit) {
        setError(`${item.businessName} : prestataire introuvable (renommé ou supprimé ?).`);
        return;
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                businessName: hit.businessName,
                providerSlug: hit.slug ?? it.providerSlug,
                subtitle: sousTitre(hit.category, hit.city) || null,
                photoURL: hit.photoURL,
              }
            : it,
        ),
      );
      setError(null);
    } catch {
      setError('Rafraîchissement impossible.');
    }
  }, []);

  const publiees = items.filter((i) => i.published).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vidéos de l&apos;accueil</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Les vidéos de prestataires mises en avant sur la page d&apos;accueil. Chaque carte
            renvoie vers la page publique du salon.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Enregistré
            </span>
          )}
          <Button onClick={() => void enregistrer()} disabled={saving || loading} variant="secondary" leftIcon={<Save className="w-4 h-4" />}>
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </p>
      )}

      {/* ── Ajouter une vidéo ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Ajouter une vidéo</h2>

        <div className="grid lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              1. Prestataire mis en avant
            </label>
            {cible ? (
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {cible.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cible.photoURL} alt="" className="w-9 h-9 object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-gray-500">
                      {cible.businessName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {cible.businessName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {sousTitre(cible.category, cible.city) || '—'}
                    {!cible.slug && ' · ⚠︎ pas de page publique'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCible(null)}
                  className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  Changer
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Nom du salon…"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white"
                  />
                </div>
                {resultats.length > 0 && (
                  <div className="mt-2 rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-50 dark:divide-gray-800/60 max-h-56 overflow-y-auto">
                    {resultats.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setCible(r);
                          setResultats([]);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        {r.businessName}
                        <span className="text-xs text-gray-400"> · {sousTitre(r.category, r.city) || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              2. Citation (facultative)
            </label>
            <Textarea
              value={citation}
              onChange={(e) => setCitation(e.target.value)}
              rows={2}
              placeholder="Avec une citation, la carte se lit comme un témoignage. Sans, comme une vitrine."
            />
          </div>
        </div>

        {/* 3. La vidéo — un lien YouTube, ou un fichier. Le lien d'abord :
            c'est le cas courant, les salons publient déjà sur leur chaîne. */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            3. La vidéo
          </label>

          {/* Un vrai formulaire : coller un lien puis appuyer sur Entrée est
              le geste naturel, et seul `onSubmit` le garantit. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ajouterLien();
            }}
            className="flex items-end gap-3 flex-wrap"
          >
            <div className="flex-1 min-w-[260px]">
              <div className="relative">
                <Youtube className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={lien}
                  onChange={(e) => setLien(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=… ou youtu.be/…"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={!cible || !lien.trim() || saving}
              leftIcon={<Link2 className="w-4 h-4" />}
            >
              {saving ? 'Enregistrement…' : 'Ajouter et enregistrer'}
            </Button>
          </form>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Adresse normale, courte ou Short : l&apos;affiche est celle de YouTube, et la vidéo
            reste sur la chaîne du prestataire.
          </p>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
            <span className="text-[11px] uppercase tracking-wider text-gray-400">ou</span>
            <span className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              ref={fichierRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void ajouterVideo(f);
              }}
            />
            <Button
              variant="secondary"
              disabled={!cible || progression !== null}
              onClick={() => fichierRef.current?.click()}
              leftIcon={progression !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {progression !== null ? `Envoi ${progression} %` : 'Envoyer un fichier et enregistrer'}
            </Button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Format vertical conseillé (9:16), {MAX_VIDEO_MB} Mo max. L&apos;affiche est extraite
              automatiquement de la première image.
            </span>
          </div>
        </div>
      </section>

      {/* Champ caché, partagé par toutes les lignes, pour remplacer une affiche */}
      <input
        ref={afficheRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void remplacerAffiche(f);
        }}
      />

      {/* ── La sélection ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Sélection {items.length > 0 && `· ${publiees}/${items.length} publiée(s)`}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Seules les vidéos publiées apparaissent sur l&apos;accueil, dans cet ordre.
            Un ajout est enregistré tout de suite ; l&apos;ordre, la citation et la
            publication demandent « Enregistrer les modifications ».
          </p>
        </div>

        {loading ? (
          <div className="p-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-sm text-gray-400 text-center">
            Aucune vidéo pour l&apos;instant — ajoutez la première ci-dessus.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item, i) => (
              <li key={item.id} className="p-4 flex gap-4 items-start">
                {/* Affiche, au format de la carte publique */}
                <div
                  className={`rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 ${
                    item.kind === 'youtube' ? 'w-32 h-[72px]' : 'w-[72px] h-32'
                  }`}
                >
                  {item.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.poster} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white">{item.businessName}</span>
                    {item.kind === 'youtube' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/25 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-300">
                        <Youtube className="w-3 h-3" /> YouTube
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        <Film className="w-3 h-3" /> Fichier
                      </span>
                    )}
                    {item.subtitle && <span className="text-xs text-gray-500">{item.subtitle}</span>}
                    {item.providerSlug ? (
                      <Link
                        href={`/p/${item.providerSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        /p/{item.providerSlug} <ExternalLink className="w-3 h-3" />
                      </Link>
                    ) : (
                      <span className="text-xs text-amber-600">⚠︎ pas de page publique</span>
                    )}
                  </div>

                  <Input
                    value={item.quote ?? ''}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, quote: e.target.value || null } : it)),
                      )
                    }
                    placeholder="Citation (facultative)"
                  />

                  <div className="flex items-center gap-4 flex-wrap text-xs">
                    <label className="inline-flex items-center gap-2">
                      <Switch
                        checked={item.published}
                        onChange={(e) =>
                          setItems((prev) =>
                            prev.map((it) =>
                              it.id === item.id ? { ...it, published: e.target.checked } : it,
                            ),
                          )
                        }
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {item.published ? 'Publiée' : 'Brouillon'}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAfficheCible(item.id);
                        afficheRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    >
                      <ImageIcon className="w-3.5 h-3.5" /> Changer l&apos;affiche
                    </button>
                    <a
                      href={item.src}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    >
                      {item.kind === 'youtube' ? (
                        <Youtube className="w-3.5 h-3.5" />
                      ) : (
                        <Film className="w-3.5 h-3.5" />
                      )}{' '}
                      Voir la vidéo
                    </a>
                    <button
                      type="button"
                      onClick={() => void rafraichir(item)}
                      className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                      title="Remettre à jour le nom, la ville et la photo depuis la fiche du salon"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Rafraîchir la fiche
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => deplacer(i, -1)}
                    disabled={i === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30"
                    aria-label="Monter"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] text-gray-400 tabular-nums">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => deplacer(i, 1)}
                    disabled={i === items.length - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30"
                    aria-label="Descendre"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((it) => it.id !== item.id))}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600"
                    aria-label="Retirer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
