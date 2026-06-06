'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Textarea, Switch, Loader, useToast } from '@/components/ui';
import { Smartphone, Save, AlertTriangle, Wrench } from 'lucide-react';

interface AppConfigForm {
  minSupportedVersion: string;
  latestVersion: string;
  forceUpdate: boolean;
  maintenance: boolean;
  message: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
}

const EMPTY: AppConfigForm = {
  minSupportedVersion: '0.0.0',
  latestVersion: '',
  forceUpdate: false,
  maintenance: false,
  message: '',
  iosStoreUrl: '',
  androidStoreUrl: '',
};

export default function AdminAppConfigPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<AppConfigForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/app-config');
      const json = await res.json();
      const cfg = json.config;
      if (cfg) {
        setForm({
          minSupportedVersion: cfg.minSupportedVersion ?? '0.0.0',
          latestVersion: cfg.latestVersion ?? '',
          forceUpdate: !!cfg.forceUpdate,
          maintenance: !!cfg.maintenance,
          message: cfg.message ?? '',
          iosStoreUrl: cfg.iosStoreUrl ?? '',
          androidStoreUrl: cfg.androidStoreUrl ?? '',
        });
        if (cfg.updatedAt) {
          const ms = cfg.updatedAt._seconds
            ? cfg.updatedAt._seconds * 1000
            : Date.parse(cfg.updatedAt);
          if (!Number.isNaN(ms)) setUpdatedAt(new Date(ms).toLocaleString('fr-FR'));
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Impossible de charger la configuration');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof AppConfigForm>(key: K, value: AppConfigForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!user) return;
    if (!/^\d+\.\d+\.\d+$/.test(form.minSupportedVersion.trim())) {
      toast.error('Version minimale invalide (format x.y.z)');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/app-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-uid': user.id },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Erreur serveur');
      }
      toast.success('Configuration enregistrée');
      void load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Application mobile</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestion des versions, blocage de mise à jour et mode maintenance.
          </p>
        </div>
      </div>

      {/* Versions */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Versions
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Version minimale requise
            </label>
            <Input
              value={form.minSupportedVersion}
              onChange={(e) => set('minSupportedVersion', e.target.value)}
              placeholder="1.4.0"
            />
            <p className="text-xs text-gray-400 mt-1">
              En dessous, l'app affiche un blocage « Mise à jour requise ».
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Dernière version publiée
            </label>
            <Input
              value={form.latestVersion}
              onChange={(e) => set('latestVersion', e.target.value)}
              placeholder="1.4.0"
            />
            <p className="text-xs text-gray-400 mt-1">Informatif (proposition de mise à jour).</p>
          </div>
        </div>
      </section>

      {/* Blocages */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Blocages
        </h2>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Forcer la mise à jour</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bloque toutes les versions inférieures à la version minimale.
              </p>
            </div>
          </div>
          <Switch
            checked={form.forceUpdate}
            onChange={(e) => set('forceUpdate', e.target.checked)}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Wrench className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Mode maintenance</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bloque l'accès à l'app pour tous les utilisateurs.
              </p>
            </div>
          </div>
          <Switch
            checked={form.maintenance}
            onChange={(e) => set('maintenance', e.target.checked)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Message affiché (optionnel)
          </label>
          <Textarea
            value={form.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="Ex. Une nouvelle version est disponible avec des améliorations importantes."
            rows={3}
          />
        </div>
      </section>

      {/* Liens stores */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Liens des stores
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            App Store (iOS)
          </label>
          <Input
            value={form.iosStoreUrl}
            onChange={(e) => set('iosStoreUrl', e.target.value)}
            placeholder="https://apps.apple.com/app/..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Google Play (Android)
          </label>
          <Input
            value={form.androidStoreUrl}
            onChange={(e) => set('androidStoreUrl', e.target.value)}
            placeholder="https://play.google.com/store/apps/details?id=..."
          />
        </div>
      </section>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {updatedAt ? `Dernière modification : ${updatedAt}` : 'Jamais configuré'}
        </p>
        <Button onClick={save} loading={saving} leftIcon={<Save className="w-4 h-4" />}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
