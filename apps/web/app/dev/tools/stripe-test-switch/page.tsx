'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Save,
  Download,
  RefreshCw,
  Search,
  X,
  Mail,
  LifeBuoy,
} from 'lucide-react';

interface ProviderRow {
  id: string;
  businessName: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeConnectAccountId: string | null;
}

interface ProviderDetail extends ProviderRow {
  stripeConnectStatus: string | null;
  depositsAddonActive: boolean;
  plan: string | null;
  subscriptionStatus: string | null;
}

interface Preset {
  customer: string;
  subscription: string;
  savedAt: string;
}

interface Validation {
  customer: { found: boolean; env: 'live' | 'test' | null; error: string | null };
  subscription: { found: boolean; env: 'live' | 'test' | null; error: string | null };
}

interface BrowseSubscription {
  id: string;
  status: string;
  label: string;
}

interface BrowseCustomer {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: number;
  subscriptions: BrowseSubscription[];
}

const presetKey = (providerId: string, slot: 'live' | 'test') =>
  `opatam_dev_stripe_preset_${providerId}_${slot}`;

export default function StripeTestSwitchPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [providerId, setProviderId] = useState<string>('');
  const [detail, setDetail] = useState<ProviderDetail | null>(null);

  const [customerInput, setCustomerInput] = useState('');
  const [subscriptionInput, setSubscriptionInput] = useState('');

  const [livePreset, setLivePreset] = useState<Preset | null>(null);
  const [testPreset, setTestPreset] = useState<Preset | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Browse Stripe state
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseEnv, setBrowseEnv] = useState<'test' | 'live'>('test');
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseCustomers, setBrowseCustomers] = useState<BrowseCustomer[]>([]);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // Initial: load providers list
  useEffect(() => {
    setLoading(true);
    fetch('/api/dev/stripe-test-switch')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setProviders(data.providers || []);
        if (!providerId && data.providers?.length) {
          setProviderId(data.providers[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load detail + presets when provider changes
  const loadDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setValidation(null);
    try {
      const res = await fetch(`/api/dev/stripe-test-switch?providerId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDetail(data);
      setCustomerInput(data.stripeCustomerId || '');
      setSubscriptionInput(data.stripeSubscriptionId || '');

      // Restore presets from localStorage
      const live = localStorage.getItem(presetKey(id, 'live'));
      const test = localStorage.getItem(presetKey(id, 'test'));
      setLivePreset(live ? JSON.parse(live) : null);
      setTestPreset(test ? JSON.parse(test) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (providerId) loadDetail(providerId);
  }, [providerId, loadDetail]);

  // ── Apply current inputs to Firestore ─────────────────────────────────
  const applyToFirestore = async (validate = false) => {
    setSaving(true);
    setError(null);
    setFlash(null);
    setValidation(null);
    try {
      const res = await fetch('/api/dev/stripe-test-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          stripeCustomerId: customerInput.trim() || null,
          stripeSubscriptionId: subscriptionInput.trim() || null,
          validate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.validation) setValidation(data.validation);
      setFlash('Firestore mis à jour ✓');
      await loadDetail(providerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // ── Save current inputs as a preset ───────────────────────────────────
  const savePreset = (slot: 'live' | 'test') => {
    if (!providerId) return;
    const preset: Preset = {
      customer: customerInput.trim(),
      subscription: subscriptionInput.trim(),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(presetKey(providerId, slot), JSON.stringify(preset));
    if (slot === 'live') setLivePreset(preset);
    else setTestPreset(preset);
    setFlash(`Preset ${slot.toUpperCase()} enregistré`);
  };

  // ── Load a preset into the inputs ─────────────────────────────────────
  const loadPreset = (slot: 'live' | 'test') => {
    const p = slot === 'live' ? livePreset : testPreset;
    if (!p) return;
    setCustomerInput(p.customer);
    setSubscriptionInput(p.subscription);
    setFlash(`Preset ${slot.toUpperCase()} chargé — clique "Appliquer" pour écrire en DB`);
  };

  // ── One-click validate against Stripe ─────────────────────────────────
  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    setValidation(null);
    try {
      const res = await fetch('/api/dev/stripe-test-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          // Send the current values WITHOUT changing them — `validate: true` only
          // triggers Stripe lookups, then the server still applies the same
          // values which is a no-op if they match what's already in Firestore.
          stripeCustomerId: customerInput.trim() || null,
          stripeSubscriptionId: subscriptionInput.trim() || null,
          validate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.validation) setValidation(data.validation);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setValidating(false);
    }
  };

  // Auto-clear the flash banner after 3s
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  // ── Browse Stripe (test or live) ──────────────────────────────────────
  const openBrowse = async (env: 'test' | 'live') => {
    setBrowseOpen(true);
    setBrowseEnv(env);
    setBrowseLoading(true);
    setBrowseError(null);
    setBrowseCustomers([]);
    try {
      const res = await fetch(`/api/dev/stripe-test-switch/browse?env=${env}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBrowseCustomers(data.customers || []);
    } catch (e) {
      setBrowseError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBrowseLoading(false);
    }
  };

  const pickFromBrowse = (customerId: string, subscriptionId: string) => {
    setCustomerInput(customerId);
    setSubscriptionInput(subscriptionId);
    setBrowseOpen(false);
    setFlash('IDs chargés — clique "Appliquer à Firestore" pour écrire');
  };

  // ── Recovery: lookup customer by user email ───────────────────────────
  const recoverFromEmail = async (env: 'live' | 'test') => {
    if (!providerId) return;
    setBrowseOpen(true);
    setBrowseEnv(env);
    setBrowseLoading(true);
    setBrowseError(null);
    setBrowseCustomers([]);
    try {
      const res = await fetch(
        `/api/dev/stripe-test-switch/recover-from-email?providerId=${encodeURIComponent(
          providerId
        )}&env=${env}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setBrowseCustomers(data.customers || []);
      if (data.customers?.length === 0) {
        setBrowseError(
          `Aucun client Stripe trouvé en mode ${env} pour l'email ${data.email}. Essayez l'autre mode.`
        );
      }
    } catch (e) {
      setBrowseError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setBrowseLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400/80">Developer Tools</span>
          </div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ArrowRightLeft className="w-7 h-7 text-emerald-400" />
            Stripe Test Switch
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Bascule les IDs Stripe (customer + subscription) entre live et test sans
            toucher Firestore manuellement. Les presets sont sauvés en localStorage.
          </p>
        </div>

        {/* Provider picker */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 mb-6">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-2">
            <Building2 className="w-3.5 h-3.5" />
            Prestataire
          </label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.businessName} ({p.id.slice(0, 8)}…)
              </option>
            ))}
          </select>
        </div>

        {/* Flash + error banners */}
        {flash && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            {flash}
          </div>
        )}
        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Current state */}
        {detail && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">État actuel Firestore</h3>
              <button
                type="button"
                onClick={() => loadDetail(providerId)}
                className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Recharger
              </button>
            </div>
            <dl className="text-xs space-y-1.5 font-mono">
              <DetailRow label="Customer" value={detail.stripeCustomerId} />
              <DetailRow label="Subscription" value={detail.stripeSubscriptionId} />
              <DetailRow label="Connect" value={detail.stripeConnectAccountId} />
              <DetailRow label="Plan" value={detail.plan} />
              <DetailRow label="Sub status" value={detail.subscriptionStatus} />
              <DetailRow label="Connect status" value={detail.stripeConnectStatus} />
              <DetailRow
                label="Add-on Acomptes"
                value={detail.depositsAddonActive ? 'active' : 'inactive'}
              />
            </dl>
          </div>
        )}

        {/* Presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PresetCard
            title="LIVE"
            color="amber"
            preset={livePreset}
            onSave={() => savePreset('live')}
            onLoad={() => loadPreset('live')}
          />
          <PresetCard
            title="TEST"
            color="sky"
            preset={testPreset}
            onSave={() => savePreset('test')}
            onLoad={() => loadPreset('test')}
          />
        </div>

        {/* Manual edit */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-white">Édition manuelle</h3>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => recoverFromEmail('live')}
                disabled={!providerId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                title="Trouve les IDs live de ce prestataire en cherchant Stripe par son email"
              >
                <LifeBuoy className="w-3.5 h-3.5" />
                Récupérer depuis email (live)
              </button>
              <button
                type="button"
                onClick={() => openBrowse('test')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-medium hover:bg-sky-500/20 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Parcourir test
              </button>
              <button
                type="button"
                onClick={() => openBrowse('live')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Parcourir live
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">
              stripeCustomerId
            </label>
            <input
              type="text"
              value={customerInput}
              onChange={(e) => setCustomerInput(e.target.value)}
              placeholder="cus_..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
            {validation?.customer && (
              <ValidationBadge v={validation.customer} label="customer" />
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1.5 block">
              stripeSubscriptionId
            </label>
            <input
              type="text"
              value={subscriptionInput}
              onChange={(e) => setSubscriptionInput(e.target.value)}
              placeholder="sub_..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
            {validation?.subscription && (
              <ValidationBadge v={validation.subscription} label="subscription" />
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating || saving || !providerId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm disabled:opacity-50"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Vérifier dans Stripe
            </button>
            <button
              type="button"
              onClick={() => applyToFirestore(true)}
              disabled={saving || validating || !providerId}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Appliquer à Firestore
            </button>
          </div>
        </div>
      </div>

      {/* ── Browse Stripe modal ─────────────────────────────────────────── */}
      {browseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setBrowseOpen(false)}
          />
          <div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  Stripe ·{' '}
                  <span
                    className={
                      browseEnv === 'test' ? 'text-sky-400' : 'text-amber-400'
                    }
                  >
                    {browseEnv === 'test' ? 'TEST mode' : 'LIVE mode'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Clique un abonnement pour pré-remplir le formulaire
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBrowseOpen(false)}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {browseLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}

              {browseError && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{browseError}</p>
                </div>
              )}

              {!browseLoading && !browseError && browseCustomers.length === 0 && (
                <p className="text-sm text-slate-500 italic text-center py-12">
                  Aucun client trouvé en mode {browseEnv}.
                </p>
              )}

              {browseCustomers.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 p-3"
                >
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-sm font-medium text-white">
                      {c.name || c.email || c.id}
                    </span>
                    {c.email && c.name && (
                      <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {c.email}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-500 mb-2">{c.id}</p>

                  {c.subscriptions.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">
                      Aucun abonnement
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {c.subscriptions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => pickFromBrowse(c.id, s.id)}
                          className="w-full text-left px-2.5 py-2 rounded-md bg-slate-800/60 hover:bg-emerald-500/20 hover:border-emerald-500/40 border border-transparent transition-colors group"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-300 group-hover:text-emerald-200 truncate">
                                {s.label}
                              </p>
                              <p className="text-[10px] font-mono text-slate-500 truncate">
                                {s.id}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${
                                s.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : s.status === 'trialing'
                                  ? 'bg-sky-500/10 text-sky-400'
                                  : 'bg-slate-700 text-slate-400'
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-slate-500 w-32 shrink-0">{label}</dt>
      <dd className={value ? 'text-slate-200 break-all' : 'text-slate-600 italic'}>
        {value ?? '(null)'}
      </dd>
    </div>
  );
}

function PresetCard({
  title,
  color,
  preset,
  onSave,
  onLoad,
}: {
  title: string;
  color: 'amber' | 'sky';
  preset: Preset | null;
  onSave: () => void;
  onLoad: () => void;
}) {
  const colors = {
    amber: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', text: 'text-amber-300' },
    sky: { border: 'border-sky-500/30', bg: 'bg-sky-500/5', text: 'text-sky-300' },
  };
  const c = colors[color];

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-bold tracking-wider ${c.text}`}>{title}</span>
        {preset && (
          <span className="text-[10px] text-slate-500">
            {new Date(preset.savedAt).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {preset ? (
        <div className="text-[11px] font-mono text-slate-400 space-y-0.5 mb-3">
          <div>
            <span className="text-slate-600">cus:</span>{' '}
            {preset.customer ? <span className="text-slate-300">{preset.customer.slice(0, 24)}…</span> : <span className="italic">(vide)</span>}
          </div>
          <div>
            <span className="text-slate-600">sub:</span>{' '}
            {preset.subscription ? <span className="text-slate-300">{preset.subscription.slice(0, 24)}…</span> : <span className="italic">(vide)</span>}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 italic mb-3">
          Aucun preset enregistré.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSave}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200"
        >
          <Save className="w-3 h-3" />
          Sauver actuel ici
        </button>
        <button
          type="button"
          onClick={onLoad}
          disabled={!preset}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] ${c.text} bg-slate-900 hover:bg-slate-800 disabled:opacity-30`}
        >
          <Download className="w-3 h-3" />
          Charger
        </button>
      </div>
    </div>
  );
}

function ValidationBadge({
  v,
  label,
}: {
  v: { found: boolean; env: 'live' | 'test' | null; error: string | null };
  label: string;
}) {
  if (v.found) {
    return (
      <p className="mt-1.5 text-[11px] inline-flex items-center gap-1 text-emerald-400">
        <Check className="w-3 h-3" />
        {label} trouvé en mode <strong className="font-bold">{v.env}</strong>
      </p>
    );
  }
  return (
    <p className="mt-1.5 text-[11px] inline-flex items-center gap-1 text-amber-400">
      <AlertCircle className="w-3 h-3" />
      {label} introuvable côté Stripe
      {v.error && v.error !== 'empty' && <span className="text-slate-500"> · {v.error.slice(0, 40)}</span>}
    </p>
  );
}
