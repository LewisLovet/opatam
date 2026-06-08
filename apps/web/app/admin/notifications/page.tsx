'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { storage } from '@booking-app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Textarea, Select, Switch, Loader, useToast } from '@/components/ui';
import {
  Bell,
  BellOff,
  Plus,
  Pencil,
  Trash2,
  Send,
  Megaphone,
  BookOpen,
  Rocket,
  Gift,
  PlayCircle,
  Lightbulb,
  CheckCircle2,
  Search,
  X,
  Loader2,
  Upload,
  ImageIcon,
  type LucideIcon,
} from 'lucide-react';

interface NotifForm {
  title: string;
  body: string;
  modalBody: string;
  type: string;
  audience: string;
  targetUserId: string;
  targetLabel: string;
  iconName: string;
  imageUrl: string;
  ctaLabel: string;
  ctaArticleSlug: string;
  ctaThumbUrl: string;
  ctaIsVideo: boolean;
  isPublished: boolean;
  sendPush: boolean;
}

interface NotifRow extends NotifForm {
  id: string;
  pushedAt?: { _seconds: number } | string | null;
}

interface Tutorial {
  slug: string;
  title: string;
  thumbUrl?: string | null;
  isVideo?: boolean;
}

const EMPTY: NotifForm = {
  title: '',
  body: '',
  modalBody: '',
  type: 'announcement',
  audience: 'pros',
  targetUserId: '',
  targetLabel: '',
  iconName: 'megaphone',
  imageUrl: '',
  ctaLabel: '',
  ctaArticleSlug: '',
  ctaThumbUrl: '',
  ctaIsVideo: false,
  isPublished: false,
  sendPush: false,
};

const TYPE_OPTIONS = [
  { value: 'announcement', label: 'Annonce' },
  { value: 'feature', label: 'Nouvelle fonctionnalité' },
  { value: 'tutorial', label: 'Tutoriel' },
];

const AUDIENCE_OPTIONS = [
  { value: 'pros', label: 'Professionnels' },
  { value: 'clients', label: 'Clients' },
  { value: 'all', label: 'Tout le monde' },
  { value: 'admins', label: 'Administrateurs' },
  { value: 'specific', label: 'Un prestataire en particulier' },
];

// Icon picker — `value` is the Ionicons name stored & rendered on
// mobile; `Icon` is the lucide glyph shown here (concrete icons, no
// emojis). Keep the two visually consistent.
const ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'megaphone', label: 'Annonce', Icon: Megaphone },
  { value: 'rocket', label: 'Nouveauté', Icon: Rocket },
  { value: 'gift', label: 'Cadeau', Icon: Gift },
  { value: 'play-circle', label: 'Vidéo', Icon: PlayCircle },
  { value: 'book', label: 'Guide', Icon: BookOpen },
  { value: 'bulb', label: 'Astuce', Icon: Lightbulb },
  { value: 'checkmark-circle', label: 'Validé', Icon: CheckCircle2 },
  { value: 'notifications', label: 'Alerte', Icon: Bell },
];

interface ProviderResult {
  id: string;
  businessName: string;
  photoURL?: string | null;
}

/** Live preview mimicking how the notification renders in the mobile app
 *  (drawer row + detail). Updates as the admin types. */
function NotifPreview({ form }: { form: NotifForm }) {
  const Icon = ICON_OPTIONS.find((o) => o.value === form.iconName)?.Icon ?? Megaphone;
  const title = form.title.trim() || 'Titre de la notification';
  const body = form.body.trim() || 'Message court affiché dans la liste.';
  const detail = form.modalBody.trim() || body;
  const ctaLabel = form.ctaLabel.trim() || 'Voir le tutoriel';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">
        Aperçu (vue mobile)
      </p>

      {/* Drawer row */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-primary-600 dark:text-primary-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{title}</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{body}</p>
        </div>
      </div>

      {/* Detail card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 mt-3">
        <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <p className="font-extrabold text-gray-900 dark:text-white">{title}</p>
        {form.imageUrl.trim() ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={form.imageUrl.trim()}
            alt=""
            className="w-full h-32 object-cover rounded-lg mt-3"
          />
        ) : null}
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 whitespace-pre-line leading-relaxed">
          {detail}
        </p>
        {form.ctaArticleSlug ? (
          <div className="mt-4">
            {form.ctaThumbUrl ? (
              <div className="relative rounded-xl overflow-hidden mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.ctaThumbUrl} alt="" className="w-full h-36 object-cover" />
                {form.ctaIsVideo ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                    <div className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center">
                      <PlayCircle className="w-7 h-7 text-white" />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-center gap-2 bg-primary-600 text-white rounded-xl py-2.5 text-sm font-bold">
              <PlayCircle className="w-4 h-4" />
              {ctaLabel}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [rows, setRows] = useState<NotifRow[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NotifForm>(EMPTY);

  // Provider search (audience === 'specific')
  const [providerQuery, setProviderQuery] = useState('');
  const [providerResults, setProviderResults] = useState<ProviderResult[]>([]);
  const [searchingProviders, setSearchingProviders] = useState(false);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const searchProviders = useCallback(
    async (q: string) => {
      if (!user || !q.trim()) {
        setProviderResults([]);
        return;
      }
      setSearchingProviders(true);
      try {
        const res = await fetch(
          `/api/admin/providers/search?q=${encodeURIComponent(q.trim())}`,
          { headers: { 'x-admin-uid': user.id } },
        );
        const json = await res.json();
        // Map to { id: userId, businessName } — userId owns the push tokens.
        const results = (json.results ?? []).map((r: any) => ({
          id: r.userId,
          businessName: r.businessName,
          photoURL: r.photoURL,
        }));
        setProviderResults(results);
      } catch {
        setProviderResults([]);
      } finally {
        setSearchingProviders(false);
      }
    },
    [user],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notifications');
      const json = await res.json();
      setRows(Array.isArray(json.notifications) ? json.notifications : []);
      setTutorials(Array.isArray(json.tutorials) ? json.tutorials : []);
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger les notifications');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof NotifForm>(k: K, v: NotifForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez choisir une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (max 5 Mo)');
      return;
    }
    setUploadingImage(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `app-notifications/${Date.now()}-${rand}.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      set('imageUrl', url);
      toast.success('Image téléversée');
    } catch (e: any) {
      console.error(e);
      toast.error("Échec du téléversement de l'image");
    } finally {
      setUploadingImage(false);
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const startEdit = (row: NotifRow) => {
    setEditingId(row.id);
    // Backfill the tutorial thumbnail from the live tutorials list when
    // the stored notif predates the thumbnail feature, so the preview
    // (and a re-save) pick it up without re-selecting the tutorial.
    const linkedTuto = tutorials.find((t) => t.slug === (row.ctaArticleSlug ?? ''));
    setForm({
      title: row.title ?? '',
      body: row.body ?? '',
      modalBody: row.modalBody ?? '',
      type: row.type ?? 'announcement',
      audience: row.audience ?? 'pros',
      targetUserId: (row as any).targetUserId ?? '',
      targetLabel: (row as any).targetLabel ?? '',
      iconName: row.iconName ?? 'megaphone',
      imageUrl: row.imageUrl ?? '',
      ctaLabel: row.ctaLabel ?? '',
      ctaArticleSlug: row.ctaArticleSlug ?? '',
      ctaThumbUrl: (row as any).ctaThumbUrl || linkedTuto?.thumbUrl || '',
      ctaIsVideo: !!(row as any).ctaIsVideo || !!linkedTuto?.isVideo,
      isPublished: !!row.isPublished,
      sendPush: !!row.sendPush,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Titre et message requis');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/admin/notifications/${editingId}` : '/api/admin/notifications',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-uid': user.id },
          body: JSON.stringify(form),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Erreur serveur');
      }
      toast.success(editingId ? 'Notification mise à jour' : 'Notification créée');
      setShowForm(false);
      setEditingId(null);
      void load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!user) return;
    if (!confirm('Supprimer cette notification ?')) return;
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-uid': user.id },
      });
      if (!res.ok) throw new Error('Échec');
      toast.success('Supprimée');
      if (editingId === id) setShowForm(false);
      void load();
    } catch {
      toast.error('Impossible de supprimer');
    }
  };

  const tutorialOptions = [
    { value: '', label: '— Aucun tutoriel lié —' },
    ...tutorials.map((t) => ({ value: t.slug, label: t.title })),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <Bell className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Annonces &amp; nouveautés affichées dans le centre de notifications de l'app.
            </p>
          </div>
        </div>
        {!showForm && (
          <Button onClick={startCreate} leftIcon={<Plus className="w-4 h-4" />}>
            Nouvelle
          </Button>
        )}
      </div>

      {/* Editor */}
      {showForm && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {editingId ? 'Modifier la notification' : 'Nouvelle notification'}
          </h2>

          <NotifPreview form={form} />

          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              options={TYPE_OPTIONS}
            />
            <Select
              label="Audience"
              value={form.audience}
              onChange={(e) => {
                const v = e.target.value;
                setForm((f) => ({
                  ...f,
                  audience: v,
                  ...(v !== 'specific' ? { targetUserId: '', targetLabel: '' } : {}),
                }));
                if (v !== 'specific') {
                  setProviderQuery('');
                  setProviderResults([]);
                }
              }}
              options={AUDIENCE_OPTIONS}
            />
          </div>

          {/* Specific provider picker */}
          {form.audience === 'specific' && (
            <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
              {form.targetUserId ? (
                <div className="flex items-center justify-between gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {form.targetLabel || form.targetUserId}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, targetUserId: '', targetLabel: '' }))}
                    className="text-gray-400 hover:text-red-500"
                    aria-label="Retirer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={providerQuery}
                      onChange={(e) => {
                        setProviderQuery(e.target.value);
                        void searchProviders(e.target.value);
                      }}
                      placeholder="Rechercher un prestataire…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    {searchingProviders && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                  </div>
                  {providerResults.length > 0 && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-56 overflow-y-auto">
                      {providerResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              targetUserId: p.id,
                              targetLabel: p.businessName,
                            }));
                            setProviderResults([]);
                            setProviderQuery('');
                          }}
                          className="w-full text-left px-2 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                        >
                          {p.businessName}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Titre
            </label>
            <Input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ex. Nouveau : panier multi-prestations"
              maxLength={80}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Message court (aperçu dans la liste)
            </label>
            <Input
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder="Ex. Réservez plusieurs prestations à la suite."
              maxLength={140}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Détail (modale, optionnel)
            </label>
            <Textarea
              value={form.modalBody}
              onChange={(e) => set('modalBody', e.target.value)}
              placeholder="Texte complet affiché quand l'utilisateur ouvre la notification."
              rows={4}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Icône
            </label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map(({ value, label, Icon }) => {
                const selected = form.iconName === value;
                return (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    onClick={() => set('iconName', value)}
                    className={`flex flex-col items-center justify-center gap-1 w-[72px] h-[64px] rounded-xl border transition-colors ${
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[11px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Image (optionnel)
            </label>
            {form.imageUrl ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.imageUrl}
                  alt=""
                  className="w-full h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <button
                  type="button"
                  onClick={() => set('imageUrl', '')}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                  aria-label="Retirer l'image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/10 transition-colors"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                    <span className="text-sm">Téléversement…</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6" />
                    <span className="text-sm font-medium">Téléverser une image</span>
                    <span className="text-xs text-gray-400">PNG, JPG — max 5 Mo</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImageUpload(f);
                e.target.value = '';
              }}
            />
            {/* URL fallback */}
            <div className="relative mt-2">
              <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                placeholder="… ou coller une URL d'image"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <BookOpen className="w-4 h-4 text-primary-500" />
              Bouton d'action (optionnel)
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Libellé du bouton
                </label>
                <Input
                  value={form.ctaLabel}
                  onChange={(e) => set('ctaLabel', e.target.value)}
                  placeholder="Ex. Voir le tutoriel"
                  maxLength={40}
                />
              </div>
              <Select
                label="Tutoriel lié"
                value={form.ctaArticleSlug}
                onChange={(e) => {
                  const slug = e.target.value;
                  const tuto = tutorials.find((t) => t.slug === slug);
                  setForm((f) => ({
                    ...f,
                    ctaArticleSlug: slug,
                    ctaThumbUrl: tuto?.thumbUrl ?? '',
                    ctaIsVideo: !!tuto?.isVideo,
                  }));
                }}
                options={tutorialOptions}
              />
            </div>
            <p className="text-xs text-gray-400">
              Le bouton ouvre le tutoriel choisi dans l'app (Tutoriels &amp; guides).
            </p>
          </div>

          {/* Toggles */}
          <div className="flex items-start justify-between gap-4 pt-1">
            <div className="flex items-start gap-3">
              <Send className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Envoyer un push</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Notification système à la publication (une seule fois).
                </p>
              </div>
            </div>
            <Switch checked={form.sendPush} onChange={(e) => set('sendPush', e.target.checked)} />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Megaphone className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Publiée</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Visible dans le centre de notifications de l'app.
                </p>
              </div>
            </div>
            <Switch
              checked={form.isPublished}
              onChange={(e) => set('isPublished', e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Annuler
            </Button>
            <Button onClick={save} loading={saving}>
              {editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </section>
      )}

      {/* List */}
      <section className="space-y-3">
        {rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BellOff className="w-10 h-10 mx-auto mb-3 opacity-40" />
            Aucune notification pour le moment.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {row.title}
                  </p>
                  {row.isPublished ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Publiée
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      Brouillon
                    </span>
                  )}
                  {row.sendPush && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {row.pushedAt ? 'Push envoyé' : 'Push prévu'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {row.body}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(row)}
                  className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label="Modifier"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(row.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700"
                  aria-label="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
