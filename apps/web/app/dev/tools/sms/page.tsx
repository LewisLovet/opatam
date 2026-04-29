'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Send,
  Loader2,
  Check,
  AlertCircle,
  KeyRound,
  Phone,
  Sparkles,
  Copy,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';

interface PreludeResult {
  ok: boolean;
  status: number;
  prelude: Record<string, unknown>;
}

interface SmsTestProvider {
  id: string;
  businessName: string;
  slug: string;
  phone: string | null;
  city: string | null;
}

const DEFAULT_TEMPLATE_ID = 'template_01kqa8v0eeecprn0x19m4nky7m';

// Templates without {{booking_link}} — Prelude rejects templates with links
// for accounts not under license. Keep the link out for the standard plan.
const VARIABLE_PRESETS: Record<string, Record<string, string>> = {
  reminder_j1: {
    customer_name: 'Marie',
    provider_name: 'Studio Beauté Élégance',
    remaining_time: 'demain à 15h30',
  },
  reminder_h2: {
    customer_name: 'Marie',
    provider_name: 'Studio Beauté Élégance',
    remaining_time: 'dans 2 heures',
  },
  reminder_h1: {
    customer_name: 'Marie',
    provider_name: 'Studio Beauté Élégance',
    remaining_time: 'dans 30 minutes',
  },
};

const DEFAULT_VARIABLES = JSON.stringify(VARIABLE_PRESETS.reminder_j1, null, 2);

export default function SmsTestPage() {
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [phone, setPhone] = useState('');
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [senderId, setSenderId] = useState('Opatam');
  const [locale, setLocale] = useState('fr');
  const [variablesText, setVariablesText] = useState(DEFAULT_VARIABLES);

  // Provider picker state
  const [providers, setProviders] = useState<SmsTestProvider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');

  // Result state
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PreludeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore API key + template ID + phone from sessionStorage so a page
  // refresh during testing doesn't wipe everything. Cleared on tab close.
  useEffect(() => {
    const savedKey = sessionStorage.getItem('opatam_dev_prelude_key');
    const savedTpl = sessionStorage.getItem('opatam_dev_prelude_tpl');
    const savedPhone = sessionStorage.getItem('opatam_dev_prelude_phone');
    if (savedKey) setApiKey(savedKey);
    if (savedTpl) setTemplateId(savedTpl);
    if (savedPhone) setPhone(savedPhone);
  }, []);

  // Load providers list once on mount
  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    fetch('/api/dev/sms/providers')
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setProvidersError(data.error || `HTTP ${res.status}`);
        } else {
          setProviders(data.providers || []);
        }
      })
      .catch((e) => {
        if (!cancelled) setProvidersError(e instanceof Error ? e.message : 'Network error');
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When a provider is selected, prefill phone + variables
  const handleProviderSelect = (id: string) => {
    setSelectedProviderId(id);
    if (!id) return;
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;
    if (provider.phone) setPhone(provider.phone);
    // Merge into existing variables — keep customer_name + remaining_time as-is.
    // Drop booking_link if the user had one (current template doesn't accept it).
    try {
      const current = JSON.parse(variablesText) as Record<string, string>;
      const { booking_link: _drop, ...rest } = current;
      void _drop;
      setVariablesText(
        JSON.stringify({ ...rest, provider_name: provider.businessName }, null, 2)
      );
    } catch {
      setVariablesText(
        JSON.stringify(
          {
            customer_name: 'Marie',
            provider_name: provider.businessName,
            remaining_time: 'demain à 15h30',
          },
          null,
          2
        )
      );
    }
  };

  useEffect(() => {
    if (apiKey) sessionStorage.setItem('opatam_dev_prelude_key', apiKey);
  }, [apiKey]);
  useEffect(() => {
    if (templateId) sessionStorage.setItem('opatam_dev_prelude_tpl', templateId);
  }, [templateId]);
  useEffect(() => {
    if (phone) sessionStorage.setItem('opatam_dev_prelude_phone', phone);
  }, [phone]);

  const variablesParsed = useMemo(() => {
    try {
      const v = JSON.parse(variablesText);
      if (typeof v !== 'object' || Array.isArray(v) || v === null) return null;
      return v as Record<string, string>;
    } catch {
      return null;
    }
  }, [variablesText]);

  const variablesInvalid = variablesText.trim() !== '' && variablesParsed === null;

  const canSend = apiKey && phone && templateId && variablesParsed && !sending;

  const loadPreset = (key: keyof typeof VARIABLE_PRESETS) => {
    setVariablesText(JSON.stringify(VARIABLE_PRESETS[key], null, 2));
  };

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/dev/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          to: phone,
          templateId,
          from: senderId || undefined,
          locale: locale || undefined,
          variables: variablesParsed,
        }),
      });
      const data = await res.json();
      if (!res.ok && !data.prelude) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setSending(false);
    }
  };

  // ── Render the SMS as it would appear on a phone (rough preview) ─────────
  const renderedSms = useMemo(() => {
    if (!variablesParsed) return null;
    // No template fetching — we just show the variables that would be substituted.
    // The actual template lives in Prelude's dashboard.
    return Object.entries(variablesParsed)
      .map(([k, v]) => `{{${k}}} → ${v}`)
      .join('\n');
  }, [variablesParsed]);

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400/80">Developer Tools</span>
          </div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-7 h-7 text-emerald-400" />
            SMS — Prelude
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Envoie un SMS de test via{' '}
            <a href="https://prelude.so" target="_blank" rel="noopener" className="text-emerald-400 hover:underline">
              Prelude Notify API
            </a>
            . Colle ta clé API Prelude, choisis un template (créé dans leur dashboard) et teste les variables.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Form ───────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* API key */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Clé API Prelude
              </label>
              <div className="flex gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
                  title={showKey ? 'Masquer' : 'Afficher'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Stockée en sessionStorage uniquement (effacée à la fermeture de l&apos;onglet).
              </p>
            </div>

            {/* Provider dropdown — prefills phone + variables */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Préremplir depuis un prestataire (optionnel)
              </label>
              <select
                value={selectedProviderId}
                onChange={(e) => handleProviderSelect(e.target.value)}
                disabled={providersLoading || providers.length === 0}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              >
                <option value="">
                  {providersLoading
                    ? 'Chargement…'
                    : providersError
                    ? `Erreur : ${providersError}`
                    : `— Aucun (${providers.length} prestataire${providers.length > 1 ? 's' : ''} disponibles) —`}
                </option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.businessName}
                    {p.city ? ` — ${p.city}` : ''}
                    {p.phone ? '' : ' (sans téléphone)'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Remplit automatiquement le numéro et{' '}
                <code className="text-slate-400">provider_name</code>.
              </p>
            </div>

            {/* Phone */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-300 mb-1.5">
                <Phone className="w-3.5 h-3.5" />
                Numéro destinataire (E.164)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33612345678"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Template ID */}
            <div>
              <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                Template ID (depuis le dashboard Prelude)
              </label>
              <input
                type="text"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                placeholder="template_01k8ap1btqf5r9fq2c8ax5fhc9"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white font-mono placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Sender ID + Locale */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                  Sender ID (max 11 chars)
                </label>
                <input
                  type="text"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value.slice(0, 11))}
                  placeholder="Opatam"
                  maxLength={11}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 block">
                  Locale
                </label>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="fr">fr</option>
                  <option value="en_US">en_US</option>
                  <option value="">(template default)</option>
                </select>
              </div>
            </div>

            {/* Variables */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Variables (JSON)
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => loadPreset('reminder_j1')}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Preset J-1
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('reminder_h2')}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Preset H-2
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset('reminder_h1')}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Preset H-1
                  </button>
                </div>
              </div>
              <textarea
                value={variablesText}
                onChange={(e) => setVariablesText(e.target.value)}
                rows={8}
                className={`w-full px-3 py-2 rounded-lg bg-slate-900 border text-xs text-white font-mono focus:outline-none ${
                  variablesInvalid
                    ? 'border-red-500 focus:border-red-400'
                    : 'border-slate-700 focus:border-emerald-500'
                }`}
              />
              {variablesInvalid && (
                <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  JSON invalide
                </p>
              )}
            </div>

            {/* Variables → preview substitutions */}
            {renderedSms && (
              <div>
                <p className="text-xs font-medium text-slate-300 mb-1.5">Substitutions</p>
                <pre className="px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400 font-mono whitespace-pre-wrap">
                  {renderedSms}
                </pre>
              </div>
            )}

            {/* Send button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-emerald-500 text-white font-semibold text-sm hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Envoyer le SMS de test
                </>
              )}
            </button>
          </div>

          {/* ── RIGHT: Result ───────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 min-h-[200px]">
              <p className="text-xs font-medium text-slate-300 mb-3">Réponse Prelude</p>

              {!result && !error && (
                <p className="text-sm text-slate-500 italic">
                  Les détails de l&apos;envoi (request_id, statut de livraison, coût)
                  apparaîtront ici après l&apos;envoi.
                </p>
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {result && (
                <>
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg mb-3 ${
                      result.ok
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}
                  >
                    {result.ok ? (
                      <Check className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium">
                      {result.ok ? 'SMS envoyé' : `Erreur HTTP ${result.status}`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                      Payload
                    </p>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(result.prelude, null, 2))}
                      className="text-[11px] text-slate-500 hover:text-white inline-flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copier
                    </button>
                  </div>
                  <pre className="px-3 py-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-96">
                    {JSON.stringify(result.prelude, null, 2)}
                  </pre>
                </>
              )}
            </div>

            {/* Quick reference */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Aide-mémoire
              </p>
              <ul className="text-[11px] text-slate-400 space-y-1.5">
                <li>
                  <strong className="text-slate-300">Templates Opatam :</strong>{' '}
                  <code className="bg-slate-800 px-1 py-0.5 rounded">booking_reminder</code>{' '}
                  (locale fr)
                </li>
                <li>
                  <strong className="text-slate-300">Variables attendues :</strong>{' '}
                  <code className="bg-slate-800 px-1 py-0.5 rounded">customer_name</code>,{' '}
                  <code className="bg-slate-800 px-1 py-0.5 rounded">provider_name</code>,{' '}
                  <code className="bg-slate-800 px-1 py-0.5 rounded">remaining_time</code>
                </li>
                <li>
                  <strong className="text-slate-300">Pas de lien autorisé :</strong> Prelude
                  rejette les templates contenant une URL pour les comptes hors licence.
                </li>
                <li>
                  <strong className="text-slate-300">CSV à importer :</strong>{' '}
                  <code className="bg-slate-800 px-1 py-0.5 rounded">templates/prelude-sms-templates.csv</code>
                </li>
                <li>
                  <strong className="text-slate-300">Encodage :</strong> les accents et emoji
                  forcent UCS-2 (limite 70 chars/segment au lieu de 160 en GSM-7).
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
