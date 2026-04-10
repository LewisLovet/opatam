'use client';

import { useState } from 'react';
import {
  GoogleAddressAutocomplete,
  type GoogleAddressSuggestion,
} from '@/components/ui/GoogleAddressAutocomplete';
import {
  MapPin,
  Navigation,
  Hash,
  Building2,
  Map,
  Globe,
  Copy,
  Check,
  RotateCcw,
  Flag,
  Layers,
  ChevronDown,
} from 'lucide-react';

// Supported EU countries
const EU_COUNTRIES = [
  { code: 'fr', label: 'France', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'be', label: 'Belgique', flag: '\u{1F1E7}\u{1F1EA}' },
  { code: 'lu', label: 'Luxembourg', flag: '\u{1F1F1}\u{1F1FA}' },
  { code: 'ch', label: 'Suisse', flag: '\u{1F1E8}\u{1F1ED}' },
  { code: 'de', label: 'Allemagne', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'es', label: 'Espagne', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'it', label: 'Italie', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'nl', label: 'Pays-Bas', flag: '\u{1F1F3}\u{1F1F1}' },
  { code: 'pt', label: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}' },
];

interface SelectedAddress {
  suggestion: GoogleAddressSuggestion;
  timestamp: Date;
}

export default function GoogleAddressTestPage() {
  const [query, setQuery] = useState('');
  const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
  const [history, setHistory] = useState<SelectedAddress[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState('fr');
  // Legacy multi-select for raw testing
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [testMode, setTestMode] = useState<'production' | 'raw'>('production');

  const handleSelect = (suggestion: GoogleAddressSuggestion) => {
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

  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-blue-400/80">Dev Tools</span>
          </div>
          <h1 className="text-3xl font-bold text-white">
            Google Places Autocomplete
          </h1>
          <p className="text-slate-400 mt-2">
            Test du composant GoogleAddressAutocomplete utilisant l&apos;API Google Places (New) avec session tokens.
            Supporte l&apos;autocompletion multi-pays EU.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setTestMode('production')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              testMode === 'production'
                ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white'
            }`}
          >
            Flow Production
          </button>
          <button
            onClick={() => setTestMode('raw')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              testMode === 'raw'
                ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white'
            }`}
          >
            Test multi-pays
          </button>
        </div>

        {/* Raw multi-country filter (test mode only) */}
        {testMode === 'raw' && (
          <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
                  Filtre multi-pays (test)
                </h2>
              </div>
              <button
                onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
              >
                {selectedCountries.length === 0 ? 'Tous les pays' : `${selectedCountries.length} pays`}
                <ChevronDown className={`w-3 h-3 transition-transform ${countryDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {EU_COUNTRIES.map((country) => {
                const isSelected = selectedCountries.includes(country.code);
                return (
                  <button
                    key={country.code}
                    onClick={() => toggleCountry(country.code)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                      ${isSelected
                        ? 'bg-blue-500/20 border border-blue-500/40 text-blue-300'
                        : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                      }
                    `}
                  >
                    <span>{country.flag}</span>
                    <span>{country.label}</span>
                    <span className="text-xs opacity-60 uppercase">{country.code}</span>
                  </button>
                );
              })}
            </div>

            {selectedCountries.length > 0 && (
              <button
                onClick={() => setSelectedCountries([])}
                className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Reinitialiser le filtre
              </button>
            )}
          </div>
        )}

        {/* Main test area */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Input */}
          <div className="space-y-6">
            {/* Production flow: Country select + Autocomplete */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400">
                  {testMode === 'production' ? 'Flow production' : 'Recherche d\'adresse'}
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

              {/* Country selector (production mode) */}
              {testMode === 'production' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Pays
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {EU_COUNTRIES.map((country) => (
                      <button
                        key={country.code}
                        onClick={() => {
                          setSelectedCountry(country.code);
                          setQuery('');
                          setSelectedAddress(null);
                        }}
                        className={`
                          flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                          ${selectedCountry === country.code
                            ? 'bg-blue-500/20 border-2 border-blue-500/60 text-blue-300'
                            : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'
                          }
                        `}
                      >
                        <span className="text-base">{country.flag}</span>
                        <span className="truncate">{country.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <GoogleAddressAutocomplete
                label="Adresse"
                value={query}
                onChange={setQuery}
                onSelect={handleSelect}
                countries={
                  testMode === 'production'
                    ? [selectedCountry]
                    : selectedCountries.length > 0 ? selectedCountries : undefined
                }
                placeholder={
                  testMode === 'production'
                    ? `Rechercher une adresse en ${EU_COUNTRIES.find((c) => c.code === selectedCountry)?.label ?? '...'}`
                    : 'Ex: 12 rue de la Paix, Paris'
                }
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
                  <span className="text-slate-400">Provider</span>
                  <code className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded">
                    Google Places (New)
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Autocomplete</span>
                  <code className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded">
                    places:autocomplete
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Place Details</span>
                  <code className="text-blue-400 text-xs bg-blue-500/10 px-2 py-0.5 rounded">
                    places/{'{'} placeId {'}'}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Session Tokens</span>
                  <span className="text-emerald-400 font-medium">Actif</span>
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
                  <span className="text-slate-400">Free tier</span>
                  <span className="text-emerald-400 font-medium">10k/mois</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pays filtre</span>
                  <span className="text-white">
                    {testMode === 'production'
                      ? selectedCountry.toUpperCase()
                      : selectedCountries.length === 0
                        ? 'Aucun (tous)'
                        : selectedCountries.map((c) => c.toUpperCase()).join(', ')}
                  </span>
                </div>
              </div>
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
                        setQuery(entry.suggestion.formattedAddress);
                        setSelectedAddress(entry);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        {entry.suggestion.countryCode && (
                          <span className="text-xs bg-slate-800 px-1.5 py-0.5 rounded font-mono text-slate-400">
                            {entry.suggestion.countryCode}
                          </span>
                        )}
                        <p className="text-slate-300 group-hover:text-white truncate">
                          {entry.suggestion.formattedAddress}
                        </p>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {entry.timestamp.toLocaleTimeString('fr-FR')}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Result */}
          <div className="space-y-6">
            {/* Selected address details */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 mb-4">
                Adresse selectionnee
              </h2>

              {selectedAddress ? (
                <div className="space-y-4">
                  {/* Full formatted address */}
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-300">
                      {selectedAddress.suggestion.formattedAddress}
                    </p>
                  </div>

                  {/* Structured fields */}
                  <div className="space-y-2.5">
                    <FieldRow
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label="N de rue"
                      value={selectedAddress.suggestion.streetNumber ?? '\u2014'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      label="Rue"
                      value={selectedAddress.suggestion.route ?? '\u2014'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label="Code postal"
                      value={selectedAddress.suggestion.postalCode ?? '\u2014'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      label="Ville"
                      value={selectedAddress.suggestion.locality ?? '\u2014'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Map className="w-3.5 h-3.5" />}
                      label="Region (admin1)"
                      value={selectedAddress.suggestion.adminArea1 ?? '\u2014'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Layers className="w-3.5 h-3.5" />}
                      label="Province (admin2)"
                      value={selectedAddress.suggestion.adminArea2 ?? '\u2014'}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Globe className="w-3.5 h-3.5" />}
                      label="Pays"
                      value={
                        selectedAddress.suggestion.country
                          ? `${selectedAddress.suggestion.country} (${selectedAddress.suggestion.countryCode})`
                          : '\u2014'
                      }
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<Navigation className="w-3.5 h-3.5" />}
                      label="Coordonnees"
                      value={
                        selectedAddress.suggestion.coordinates
                          ? `${selectedAddress.suggestion.coordinates.latitude.toFixed(6)}, ${selectedAddress.suggestion.coordinates.longitude.toFixed(6)}`
                          : '\u2014'
                      }
                      onCopy={handleCopy}
                      copied={copied}
                    />
                    <FieldRow
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      label="Place ID"
                      value={selectedAddress.suggestion.placeId}
                      onCopy={handleCopy}
                      copied={copied}
                    />
                  </div>

                  {/* Mapping preview */}
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Mapping &rarr; LocationFormData
                    </h3>
                    <pre className="text-xs bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-300">
{JSON.stringify(
  {
    address: selectedAddress.suggestion.formattedAddress,
    streetNumber: selectedAddress.suggestion.streetNumber,
    streetName: selectedAddress.suggestion.route,
    postalCode: selectedAddress.suggestion.postalCode,
    city: selectedAddress.suggestion.locality,
    countryCode: selectedAddress.suggestion.countryCode,
    region: selectedAddress.suggestion.adminArea1,
    geopoint: selectedAddress.suggestion.coordinates,
  },
  null,
  2
)}
                    </pre>
                  </div>

                  {/* Raw components */}
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Raw Address Components (Google)
                    </h3>
                    <pre className="text-xs bg-slate-950 p-3 rounded-lg overflow-x-auto text-slate-300 max-h-80 overflow-y-auto">
{JSON.stringify(selectedAddress.suggestion.rawComponents, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                  <Globe className="w-8 h-8 mb-3 opacity-30" />
                  <p className="text-sm">Selectionnez une adresse pour voir le detail</p>
                </div>
              )}
            </div>
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
        <span className="text-sm text-white truncate max-w-[250px]" title={value}>{value}</span>
        {value !== '\u2014' && (
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
