'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Sparkles,
  Youtube,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui';
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
  type ArticleStatus,
} from '@booking-app/shared';
import {
  adminArticleService,
  type ArticleDetail,
} from '@/services/admin/adminArticleService';
import { MarkdownEditor } from './MarkdownEditor';

interface Props {
  initial?: ArticleDetail;
}

interface FormState {
  slug: string;
  title: string;
  excerpt: string;
  coverImageURL: string;
  body: string;
  category: ArticleCategory;
  isFeatured: boolean;
  videoUrl: string;
  videoCoverURL: string;
  status: ArticleStatus;
  seoTitle: string;
  seoDescription: string;
  ogImageURL: string;
}

const EMPTY: FormState = {
  slug: '',
  title: '',
  excerpt: '',
  coverImageURL: '',
  body: '',
  category: 'conseils',
  isFeatured: false,
  videoUrl: '',
  videoCoverURL: '',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  ogImageURL: '',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function ArticleEditor({ initial }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const isEditing = !!initial;

  const [form, setForm] = useState<FormState>(() => {
    if (!initial) return EMPTY;
    return {
      slug: initial.slug,
      title: initial.title,
      excerpt: initial.excerpt,
      coverImageURL: initial.coverImageURL ?? '',
      body: initial.body,
      category: initial.category,
      isFeatured: initial.isFeatured,
      videoUrl: initial.videoUrl ?? '',
      videoCoverURL: initial.videoCoverURL ?? '',
      status: initial.status,
      seoTitle: initial.seoTitle ?? '',
      seoDescription: initial.seoDescription ?? '',
      ogImageURL: initial.ogImageURL ?? '',
    };
  });

  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => {
    const nullify = (v: string) => (v.trim() === '' ? null : v.trim());
    return {
      slug: form.slug.trim(),
      title: form.title.trim(),
      excerpt: form.excerpt.trim(), // empty → API auto-generates from body
      coverImageURL: nullify(form.coverImageURL),
      body: form.body,
      category: form.category,
      isFeatured: form.isFeatured,
      videoUrl: nullify(form.videoUrl),
      videoCoverURL: nullify(form.videoCoverURL),
      status: form.status,
      seoTitle: nullify(form.seoTitle),
      seoDescription: nullify(form.seoDescription),
      ogImageURL: nullify(form.ogImageURL),
    };
  }, [form]);

  // Auto-slug from title (until user manually edits the slug field)
  useEffect(() => {
    if (slugTouched || isEditing) return;
    const auto = slugify(form.title);
    setForm((f) => ({ ...f, slug: auto }));
  }, [form.title, slugTouched, isEditing]);

  const handleSave = async (overrideStatus?: ArticleStatus) => {
    if (!user?.id) return;
    setSaving(true);
    setError(null);
    try {
      const finalPayload = overrideStatus
        ? { ...payload, status: overrideStatus }
        : payload;
      if (overrideStatus) {
        // Reflect the new status in the form too so the UI updates
        setForm((f) => ({ ...f, status: overrideStatus }));
      }
      if (isEditing && initial) {
        await adminArticleService.update(user.id, initial.id, finalPayload);
        toast.success(
          finalPayload.status === 'published' && initial.status !== 'published'
            ? 'Article publié'
            : 'Article enregistré'
        );
      } else {
        const { id } = await adminArticleService.create(user.id, finalPayload);
        toast.success(
          finalPayload.status === 'published'
            ? 'Article créé et publié'
            : 'Brouillon créé'
        );
        router.replace(`/admin/articles/${id}`);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id || !initial) return;
    if (!confirm(`Supprimer définitivement l'article « ${form.title} » ?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await adminArticleService.delete(user.id, initial.id);
      router.push('/admin/articles');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
      setDeleting(false);
    }
  };

  const previewHref =
    isEditing && form.status === 'published' ? `/blog/${form.slug}` : null;
  const isPublished = form.status === 'published';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isEditing ? 'Modifier l’article' : 'Nouvel article'}
            </h1>
            <StatusBadge status={form.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isEditing && initial?.updatedAt
              ? `Dernière mise à jour : ${new Date(initial.updatedAt).toLocaleString('fr-FR')}`
              : 'Saisissez le titre puis rédigez votre contenu.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {previewHref && (
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Eye className="w-4 h-4" />
              Voir publié
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave('draft')}
            disabled={saving || deleting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Brouillon
          </button>
          <button
            type="button"
            onClick={() => handleSave('published')}
            disabled={saving || deleting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isPublished ? 'Mettre à jour' : 'Publier'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* ── Main column (full width) ────────────────────────────── */}
      <div className="space-y-5">
        {/* Title */}
        <div>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Le titre de votre article"
            className="w-full px-4 py-3 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-700 focus:border-primary-500 focus:outline-none placeholder-gray-300 dark:placeholder-gray-600"
          />
        </div>

        {/* Cover */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            Image de couverture <span className="text-gray-400 font-normal">(optionnelle)</span>
          </label>
          <input
            type="url"
            value={form.coverImageURL}
            onChange={(e) => setForm({ ...form, coverImageURL: e.target.value })}
            placeholder="https://… (URL d'une image hébergée)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {form.coverImageURL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.coverImageURL}
              alt=""
              className="mt-2 w-full max-h-64 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
            />
          )}
        </div>

        {/* Body — the star of the form */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
            Contenu
          </label>
          <MarkdownEditor
            value={form.body}
            onChange={(next) => setForm({ ...form, body: next })}
            placeholder="Commencez à écrire votre article…&#10;&#10;Sélectionnez du texte et utilisez les boutons ci-dessus pour le mettre en forme."
            rows={20}
          />
        </div>

        {/* Compact bottom bar: Category + Featured + Video */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Catégorie
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ARTICLE_CATEGORY_LABELS) as ArticleCategory[]).map((c) => {
                const active = form.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, category: c })}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300'
                    }`}
                  >
                    {ARTICLE_CATEGORY_LABELS[c]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 w-full hover:border-primary-300 transition-colors">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900 dark:text-white block">
                  À la une
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Afficher cet article sur la page d&apos;accueil
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* ── Advanced (collapsed) ──────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-colors"
          >
            <span>Avancé · vidéo, SEO, slug, résumé</span>
            {advancedOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {advancedOpen && (
            <div className="px-4 pb-5 pt-1 space-y-5 border-t border-gray-100 dark:border-gray-700">
              {/* Video */}
              <Section
                title="Vidéo YouTube"
                icon={<Youtube className="w-4 h-4 text-red-500" />}
                hint="Optionnel. La vidéo s'affichera dans l'article avec un lecteur custom (sans la chrome YouTube tant qu'on a pas cliqué)."
              >
                <Field label="URL YouTube">
                  <input
                    type="url"
                    value={form.videoUrl}
                    onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="Vignette personnalisée"
                  hint="Image affichée avant lecture. Sinon on utilise la miniature YouTube par défaut."
                >
                  <input
                    type="url"
                    value={form.videoCoverURL}
                    onChange={(e) => setForm({ ...form, videoCoverURL: e.target.value })}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </Field>
              </Section>

              {/* Excerpt + slug */}
              <Section
                title="Adresse et résumé"
                hint="L'URL et le résumé sont auto-générés. Modifie-les seulement si tu veux les contrôler."
              >
                <Field label="URL de l'article" hint={`/blog/${form.slug || 'votre-slug'}`}>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm({ ...form, slug: slugify(e.target.value) });
                    }}
                    placeholder="auto-genere-depuis-le-titre"
                    className={`${inputClass} font-mono`}
                  />
                </Field>
                <Field
                  label="Résumé"
                  hint={`${form.excerpt.length}/200 — laissé vide, on génère depuis le début du contenu.`}
                >
                  <textarea
                    value={form.excerpt}
                    onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                    rows={2}
                    maxLength={200}
                    placeholder="Auto-généré depuis le contenu si laissé vide"
                    className={inputClass}
                  />
                </Field>
              </Section>

              {/* SEO */}
              <Section
                title="SEO"
                hint="Modifie ces champs uniquement si tu veux contrôler ce qui apparaît dans Google et sur les réseaux sociaux. Sinon on utilise titre, résumé et image de couverture."
              >
                <Field label="Titre Google" hint={`${form.seoTitle.length}/70`}>
                  <input
                    type="text"
                    value={form.seoTitle}
                    onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                    maxLength={70}
                    placeholder="Auto-rempli depuis le titre"
                    className={inputClass}
                  />
                </Field>
                <Field label="Description Google" hint={`${form.seoDescription.length}/160`}>
                  <textarea
                    value={form.seoDescription}
                    onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                    rows={2}
                    maxLength={160}
                    placeholder="Auto-remplie depuis le résumé"
                    className={inputClass}
                  />
                </Field>
                <Field label="Image de partage social">
                  <input
                    type="url"
                    value={form.ogImageURL}
                    onChange={(e) => setForm({ ...form, ogImageURL: e.target.value })}
                    placeholder="Auto-remplie depuis l'image de couverture"
                    className={inputClass}
                  />
                </Field>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Section({
  title,
  icon,
  hint,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
          {icon}
          {title}
        </h4>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: ArticleStatus }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Publié
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Brouillon
    </span>
  );
}
