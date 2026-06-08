'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Textarea, Select, Switch, Loader, useToast } from '@/components/ui';
import { Bell, BellOff, Plus, Pencil, Trash2, Send, Megaphone, BookOpen } from 'lucide-react';

interface NotifForm {
  title: string;
  body: string;
  modalBody: string;
  type: string;
  audience: string;
  iconName: string;
  imageUrl: string;
  ctaLabel: string;
  ctaArticleSlug: string;
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
}

const EMPTY: NotifForm = {
  title: '',
  body: '',
  modalBody: '',
  type: 'announcement',
  audience: 'pros',
  iconName: 'megaphone',
  imageUrl: '',
  ctaLabel: '',
  ctaArticleSlug: '',
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
];

// Ionicons names (rendered on mobile). No "sparkles" per design rule.
const ICON_OPTIONS = [
  { value: 'megaphone', label: '📣 Mégaphone (annonce)' },
  { value: 'rocket', label: '🚀 Fusée (nouveauté)' },
  { value: 'gift', label: '🎁 Cadeau' },
  { value: 'star', label: '⭐ Étoile' },
  { value: 'play-circle', label: '▶️ Lecture (vidéo)' },
  { value: 'book', label: '📖 Livre (guide)' },
  { value: 'bulb', label: '💡 Ampoule (astuce)' },
  { value: 'checkmark-circle', label: '✅ Validé' },
];

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

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const startEdit = (row: NotifRow) => {
    setEditingId(row.id);
    setForm({
      title: row.title ?? '',
      body: row.body ?? '',
      modalBody: row.modalBody ?? '',
      type: row.type ?? 'announcement',
      audience: row.audience ?? 'pros',
      iconName: row.iconName ?? 'megaphone',
      imageUrl: row.imageUrl ?? '',
      ctaLabel: row.ctaLabel ?? '',
      ctaArticleSlug: row.ctaArticleSlug ?? '',
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
              onChange={(e) => set('audience', e.target.value)}
              options={AUDIENCE_OPTIONS}
            />
          </div>

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

          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Icône"
              value={form.iconName}
              onChange={(e) => set('iconName', e.target.value)}
              options={ICON_OPTIONS}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Image (URL, optionnel)
              </label>
              <Input
                value={form.imageUrl}
                onChange={(e) => set('imageUrl', e.target.value)}
                placeholder="https://…"
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
                onChange={(e) => set('ctaArticleSlug', e.target.value)}
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
