'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, Select, Textarea, Switch, Loader, useToast } from '@/components/ui';
import { Smartphone, Save, AlertTriangle, Wrench, Plus, X, Tag } from 'lucide-react';

interface AppConfigForm {
  minSupportedVersion: string;
  latestVersion: string;
  releasedVersions: string[];
  forceUpdate: boolean;
  maintenance: boolean;
  message: string;
  iosStoreUrl: string;
  androidStoreUrl: string;
}

const EMPTY: AppConfigForm = {
  minSupportedVersion: '',
  latestVersion: '',
  releasedVersions: [],
  forceUpdate: false,
  maintenance: false,
  message: '',
  iosStoreUrl: '',
  androidStoreUrl: '',
};

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** Descending semver sort (newest first). */
function sortDesc(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
    const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      if ((pb[i] ?? 0) !== (pa[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
    }
    return 0;
  });
}

export default function AdminAppConfigPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<AppConfigForm>(EMPTY);
  const [currentAppVersion, setCurrentAppVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/app-config');
      const json = await res.json();
      setCurrentAppVersion(json.currentAppVersion ?? null);
      const cfg = json.config;
      if (cfg) {
        setForm({
          minSupportedVersion: cfg.minSupportedVersion ?? '',
          latestVersion: cfg.latestVersion ?? '',
          releasedVersions: sortDesc(
            Array.isArray(cfg.releasedVersions) ? cfg.releasedVersions : []
          ),
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

  const addVersion = (raw: string) => {
    const v = raw.trim();
    if (!SEMVER_RE.test(v)) {
      toast.error('Format de version invalide (x.y.z)');
      return;
    }
    if (form.releasedVersions.includes(v)) {
      toast.error('Cette version est déjà dans la liste');
      return;
    }
    set('releasedVersions', sortDesc([...form.releasedVersions, v]));
    setNewVersion('');
  };

  const removeVersion = (v: string) => {
    setForm((f) => ({
      ...f,
      releasedVersions: f.releasedVersions.filter((x) => x !== v),
      // Clear selections that point to a now-removed version.
      minSupportedVersion: f.minSupportedVersion === v ? '' : f.minSupportedVersion,
      latestVersion: f.latestVersion === v ? '' : f.latestVersion,
    }));
  };

  const save = async () => {
    if (!user) return;
    if (form.forceUpdate && !SEMVER_RE.test(form.minSupportedVersion)) {
      toast.error('Choisis une version minimale avant de forcer la mise à jour');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        // Default the threshold to 0.0.0 (blocks nobody) when left empty.
        minSupportedVersion: form.minSupportedVersion || '0.0.0',
      };
      const res = await fetch('/api/admin/app-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-uid': user.id },
        body: JSON.stringify(payload),
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

  const versionOptions = form.releasedVersions.map((v) => ({
    value: v,
    label: v === currentAppVersion ? `${v} (version actuelle)` : v,
  }));
  const noVersions = form.releasedVersions.length === 0;
  const canQuickAddCurrent =
    !!currentAppVersion && !form.releasedVersions.includes(currentAppVersion);

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

      {/* Versions publiées (référentiel) */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Versions publiées
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Le référentiel des versions réellement sorties. Les menus ci-dessous y piochent —
            on évite ainsi de saisir une version au hasard.
          </p>
        </div>

        {/* Chips */}
        {noVersions ? (
          <p className="text-sm text-gray-400 italic">Aucune version enregistrée pour le moment.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {form.releasedVersions.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-800 dark:text-gray-100"
              >
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                {v}
                {v === currentAppVersion && (
                  <span className="text-[10px] uppercase tracking-wide text-primary-600 dark:text-primary-400">
                    actuelle
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeVersion(v)}
                  className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white dark:hover:bg-gray-800"
                  aria-label={`Retirer ${v}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addVersion(newVersion);
                }
              }}
              placeholder="Ex. 1.5.0"
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => addVersion(newVersion)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Ajouter
          </Button>
        </div>
        {canQuickAddCurrent && (
          <button
            type="button"
            onClick={() => addVersion(currentAppVersion!)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            + Ajouter la version actuelle de l'app ({currentAppVersion})
          </button>
        )}
      </section>

      {/* Sélection des versions */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Versions de référence
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Select
              label="Version minimale requise"
              value={form.minSupportedVersion}
              onChange={(e) => set('minSupportedVersion', e.target.value)}
              placeholder={noVersions ? 'Ajoute d’abord une version' : 'Sélectionner…'}
              options={versionOptions}
              disabled={noVersions}
            />
            <p className="text-xs text-gray-400 mt-1">
              En dessous, l'app affiche le blocage « Mise à jour requise ».
            </p>
          </div>
          <div>
            <Select
              label="Dernière version publiée"
              value={form.latestVersion}
              onChange={(e) => set('latestVersion', e.target.value)}
              placeholder={noVersions ? 'Ajoute d’abord une version' : 'Aucune'}
              options={versionOptions}
              disabled={noVersions}
            />
            <p className="text-xs text-gray-400 mt-1">Informatif uniquement.</p>
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
