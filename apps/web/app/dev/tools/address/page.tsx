'use client';

import { useState } from 'react';
import { AddressAutocomplete, type AddressSuggestion } from '@/components/ui';
import { MapPin, Navigation, Hash, Building2, Map, Copy, Check, RotateCcw } from 'lucide-react';

interface SelectedAddress {
  suggestion: AddressSuggestion;
  timestamp: Date;
}

export default function AddressTestPage() {
  const [query, setQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const [history, setHistory] = useState<SelectedAddress[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const handleSelect = (suggestion: AddressSuggestion) => {
    const entry = { suggestion, timestamp: new Date() };
    setSelectedAddress(entry);
    setHistory((prev) => [entry, ...prev].slice(0, 10));
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReset = () => {
    setQuery('');
    setSelectedAddress(null);
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400/80">Dev Tools</span>
          </div>
          <h1 className="text-3xl font-bold text-white">
            Autocompletion Adresse
          </h1>
          <p className="text-slate-400 mt-2">
            Test du composant AddressAutocomplete utilisant l&apos;API Adresse du gouvernement francais
            (api-adresse.data.gouv.fr)
          </p>
        </div>

        {/* Main test area */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Input */}
          <div className="space-y-6">
            {/* Autocomplete card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Recherche d&apos;adresse
                </h2>
                {selectedAddress && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
              </div>

              <AddressAutocomplete
                label="Adresse"
                value={query}
                onChange={setQuery}
                onSelect={handleSelect}
                placeholder="Ex: 12 rue de la Paix, Paris"
                hint="Tapez au moins 3 caracteres pour lancer la recherche"
              />
            </div>

            {/* API Info */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                Infos API
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Endpoint</span>
                  <code className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded">
                    api-adresse.data.gouv.fr/search
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Debounce</span>
                  <span className="text-white">300ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Min. caracteres</span>
                  <span className="text-white">3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max. resultats</span>
                  <span className="text-white">5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rate limit</span>
                  <span className="text-white">50 req/s/IP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cout</span>
                  <span className="text-emerald-400 font-medium">Gratuit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Result */}
          <div className="space-y-6">
            {/* Selected address details */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-4">
                Adresse selectionnee
              </h2>

              {selectedAddress ? (
                <div className="space-y-4">
                  {/* Full label */}
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-sm font-medium text-emerald-300">
                      {selectedAddress.suggestion.label}
                    </p>
                  </div>

                  {/* Fields */}
                  <div className="space-y-2.5">
                    <FieldRow
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      label="Nom de rue"
                      value={selectedAddress.suggestion.name}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label="N° de rue"
                      value={selectedAddress.suggestion.housenumber ?? '—'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      label="Rue"
                      value={selectedAddress.suggestion.street ?? '—'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label="Code postal"
                      value={selectedAddress.suggestion.postcode}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      label="Ville"
                      value={selectedAddress.suggestion.city}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Map className="w-3.5 h-3.5" />}
                      label="Contexte"
                      value={selectedAddress.suggestion.context}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Navigation className="w-3.5 h-3.5" />}
                      label="Coordonnees"
                      value={`${selectedAddress.suggestion.coordinates.latitude}, ${selectedAddress.suggestion.coordinates.longitude}`}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label="Score"
                      value={`${(selectedAddress.suggestion.score * 100).toFixed(1)}%`}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      label="Type"
                      value={selectedAddress.suggestion.type}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                  </div>

                  {/* Mapping preview */}
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Mapping → LocationFormData
                    </h3>
                    <pre className="text-xs bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-300">
{JSON.stringify({
  address: selectedAddress.suggestion.name,
  postalCode: selectedAddress.suggestion.postcode,
  city: selectedAddress.suggestion.city,
  geopoint: selectedAddress.suggestion.coordinates,
}, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <MapPin className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">Selectionnez une adresse pour voir le detail</p>
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                  Historique ({history.length})
                </h2>
                <div className="space-y-2">
                  {history.map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(entry.suggestion.label);
                        setSelectedAddress(entry);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors group"
                    >
                      <p className="text-slate-300 group-hover:text-white truncate">
                        {entry.suggestion.label}
                      </p>
                      <p className="text-xs text-slate-600">
                        {entry.timestamp.toLocaleTimeString('fr-FR')} — score: {(entry.suggestion.score * 100).toFixed(0)}%
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-component ---

function FieldRow({
  icon,
  label,
  value,
  onCopy,
  copied,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy: (text: string, field: string) => void;
  copied: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 group">
      <div className="flex items-center gap-2 text-slate-400 min-w-0">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-white truncate max-w-[200px]">{value}</span>
        {value !== '—' && (
          <button
            onClick={() => onCopy(value, label)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-700"
            title="Copier"
          >
            {copied === label ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-slate-400" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
