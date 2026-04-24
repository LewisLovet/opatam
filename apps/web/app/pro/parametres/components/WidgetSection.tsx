'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Code,
  Copy,
  Check,
  Palette,
  Square,
  Laptop,
  MousePointerClick,
  Sparkles,
  ExternalLink,
  QrCode,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type WidgetMode = 'inline' | 'popup' | 'floating';
type FloatingPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface WidgetConfig {
  mode: WidgetMode;
  primary: string; // hex with #
  radius: number;
  buttonLabel: string;
  position: FloatingPosition;
}

const DEFAULT_CONFIG: WidgetConfig = {
  mode: 'inline',
  primary: '#2563eb',
  radius: 12,
  buttonLabel: 'Prendre rendez-vous',
  position: 'bottom-right',
};

const MODE_OPTIONS: { id: WidgetMode; label: string; description: string; icon: typeof Laptop }[] = [
  {
    id: 'inline',
    label: 'Intégré',
    description: 'Le widget apparaît dans la page, entre votre contenu.',
    icon: Laptop,
  },
  {
    id: 'popup',
    label: 'Popup',
    description: 'Un bouton sur votre site ouvre une fenêtre de réservation.',
    icon: MousePointerClick,
  },
  {
    id: 'floating',
    label: 'Flottant',
    description: 'Un bouton toujours visible dans un coin de votre site.',
    icon: Sparkles,
  },
];

export function WidgetSection() {
  const { provider } = useAuth();
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG);
  const [copied, setCopied] = useState(false);
  const [snippetTab, setSnippetTab] = useState<WidgetMode>('inline');

  // Keep snippet tab in sync with selected mode (user can still click around to compare)
  useEffect(() => {
    setSnippetTab(config.mode);
  }, [config.mode]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://opatam.com';
  const slug = provider?.slug || '';

  // Preview URL (live-updates with config changes)
  const previewUrl = useMemo(() => {
    if (!slug) return '';
    const params = new URLSearchParams();
    params.set('primary', config.primary.replace(/^#/, ''));
    params.set('radius', String(config.radius));
    return `${origin}/p/${slug}/embed?${params.toString()}`;
  }, [slug, origin, config.primary, config.radius]);

  // Generated snippet based on current tab + config
  const snippet = useMemo(() => {
    if (!slug) return '';
    const color = config.primary.replace(/^#/, '');
    const dataAttrs = [
      `  data-primary="#${color}"`,
      `  data-radius="${config.radius}"`,
    ].join('\n');

    if (snippetTab === 'inline') {
      return `<div data-opatam-embed="${slug}"\n${dataAttrs}></div>\n<script src="${origin}/embed.js" async></script>`;
    }
    if (snippetTab === 'popup') {
      return `<button data-opatam-popup="${slug}"\n${dataAttrs}>\n  ${config.buttonLabel}\n</button>\n<script src="${origin}/embed.js" async></script>`;
    }
    return `<script src="${origin}/embed.js" async\n  data-opatam-floating="${slug}"\n${dataAttrs}\n  data-label="${config.buttonLabel}"\n  data-position="${config.position}"></script>`;
  }, [slug, origin, snippetTab, config]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = snippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Test the popup/floating experience in-place using the real embed.js
  const scriptLoadedRef = useRef(false);
  const handleTestPopup = () => {
    const open = () => {
      const w = window as unknown as { Opatam?: { open: (s: string, o: unknown) => void } };
      if (w.Opatam?.open) {
        w.Opatam.open(slug, {
          primary: config.primary,
          radius: config.radius,
        });
      }
    };

    if (scriptLoadedRef.current) {
      open();
      return;
    }

    const script = document.createElement('script');
    script.src = `${origin}/embed.js`;
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
      open();
    };
    document.body.appendChild(script);
  };

  // Loading / unpublished guards
  if (!provider) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Chargement...
      </div>
    );
  }

  if (!provider.isPublished) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 p-4 bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 rounded-xl">
          <AlertCircle className="w-6 h-6 text-warning-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning-700 dark:text-warning-400">
              Page non active
            </p>
            <p className="text-sm text-warning-600/80 dark:text-warning-400/70 mt-1">
              Activez votre page publique depuis l&apos;onglet{' '}
              <Link href="/pro/profil" className="underline font-medium">Profil</Link>{' '}
              pour pouvoir intégrer le widget sur votre site.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Code className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          Widget de réservation
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Intégrez Opatam sur votre propre site en 2 lignes de code. Vos clients réservent
          sans quitter votre site.
        </p>
      </div>

      {/* Grid: settings (left) + preview (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT COLUMN: settings ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Mode selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mode d&apos;affichage
            </label>
            <div className="space-y-2">
              {MODE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = config.mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, mode: opt.id }))}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      isActive
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isActive
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          isActive
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-gray-400" />
              Apparence
            </h4>

            {/* Primary color */}
            <div>
              <label
                htmlFor="widget-color"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
              >
                Couleur principale
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="widget-color"
                  type="color"
                  value={config.primary}
                  onChange={(e) => setConfig((c) => ({ ...c, primary: e.target.value }))}
                  className="w-12 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer bg-white dark:bg-gray-800 p-1"
                />
                <input
                  type="text"
                  value={config.primary}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setConfig((c) => ({ ...c, primary: v.startsWith('#') || v === '' ? v : `#${v}` }));
                  }}
                  placeholder="#2563eb"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Border radius */}
            <div>
              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Square className="w-3.5 h-3.5" />
                  Arrondi des coins
                </span>
                <span className="text-gray-500 font-mono">{config.radius}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={24}
                step={1}
                value={config.radius}
                onChange={(e) => setConfig((c) => ({ ...c, radius: parseInt(e.target.value, 10) }))}
                className="w-full accent-primary-600"
              />
            </div>
          </div>

          {/* Mode-specific options */}
          {(config.mode === 'popup' || config.mode === 'floating') && (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Bouton
              </h4>

              <div>
                <label
                  htmlFor="widget-label"
                  className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Texte du bouton
                </label>
                <input
                  id="widget-label"
                  type="text"
                  value={config.buttonLabel}
                  onChange={(e) => setConfig((c) => ({ ...c, buttonLabel: e.target.value }))}
                  placeholder="Prendre rendez-vous"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                />
              </div>

              {config.mode === 'floating' && (
                <div>
                  <label
                    htmlFor="widget-position"
                    className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                  >
                    Position sur la page
                  </label>
                  <select
                    id="widget-position"
                    value={config.position}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, position: e.target.value as FloatingPosition }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="bottom-right">En bas à droite</option>
                    <option value="bottom-left">En bas à gauche</option>
                    <option value="top-right">En haut à droite</option>
                    <option value="top-left">En haut à gauche</option>
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={handleTestPopup}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90 rounded-lg text-sm font-medium transition-opacity"
              >
                <MousePointerClick className="w-4 h-4" />
                Tester le bouton ici
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: preview ─────────────────────────────── */}
        <div className="lg:col-span-3">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Aperçu en direct
          </label>

          {/* Mock browser frame */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900">
            {/* Fake address bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-xs text-gray-400 dark:text-gray-500 font-mono truncate text-center">
                votre-site.com
              </div>
            </div>

            {/* Iframe preview — always shows the inline embed (the core widget) */}
            <div className="p-4 bg-white dark:bg-gray-900">
              {previewUrl ? (
                <iframe
                  key={previewUrl}
                  src={previewUrl}
                  title="Aperçu du widget"
                  className="w-full h-[600px] border-0 rounded-lg"
                  style={{ borderRadius: `${config.radius}px` }}
                />
              ) : (
                <div className="h-[600px] flex items-center justify-center text-gray-400 text-sm">
                  Chargement de l&apos;aperçu...
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            L&apos;aperçu montre le widget tel qu&apos;il apparaîtra sur votre site, avec vos réglages
            appliqués en temps réel.
          </p>
        </div>
      </div>

      {/* ── Snippet + copy ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Votre code à copier
          </h4>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {(['inline', 'popup', 'floating'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSnippetTab(m)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  snippetTab === m
                    ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {m === 'inline' && 'Intégré'}
                {m === 'popup' && 'Popup'}
                {m === 'floating' && 'Flottant'}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <pre className="p-4 pr-12 rounded-xl bg-gray-900 text-gray-100 text-xs font-mono overflow-x-auto leading-relaxed">
            <code>{snippet}</code>
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-3 right-3 p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            title="Copier"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Copiez ce code et collez-le dans votre site (WordPress, Wix, Squarespace, site custom…).
          Le widget apparaîtra immédiatement avec vos réglages.
        </p>
      </div>

      {/* Tips */}
      <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-400 mb-2 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          Conseils d&apos;intégration
        </h4>
        <ul className="text-sm text-primary-600/80 dark:text-primary-400/70 space-y-1.5 list-disc list-inside">
          <li>
            Mode <strong>Intégré</strong> : idéal pour une page dédiée &quot;Réserver&quot; sur votre site.
          </li>
          <li>
            Mode <strong>Popup</strong> : parfait pour ajouter un bouton de réservation sur votre page
            d&apos;accueil.
          </li>
          <li>
            Mode <strong>Flottant</strong> : le bouton reste visible sur toutes les pages pour
            maximiser les conversions.
          </li>
          <li>
            Pensez à faire correspondre la couleur principale avec la charte graphique de votre site.
          </li>
        </ul>
      </div>

      {/* Related links */}
      <div className="flex flex-wrap gap-3 pt-2">
        <Link
          href={`/p/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Voir ma page publique
        </Link>
        <Link
          href="/pro/parametres?tab=partage"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <QrCode className="w-4 h-4" />
          QR code & partage
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
