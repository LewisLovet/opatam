'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminAffiliateService, adminProviderService } from '@/services/admin';
import type { ProviderSearchResult } from '@/services/admin/adminProviderService';
import { Loader } from '@/components/ui';
import {
  Handshake,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Users,
  Euro,
  TrendingUp,
  X,
  Search,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface AffiliateItem {
  id: string;
  name: string;
  email: string;
  code: string;
  commission: number;
  discount: number | null;
  discountDuration: string | null;
  stripeAccountStatus: string;
  stripeCouponId: string | null;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    trialReferrals: number;
    totalRevenue: number;
    totalCommission: number;
  };
  isActive: boolean;
  createdAt: string | null;
}

const DURATION_LABELS: Record<string, string> = {
  once: '1er mois',
  repeating_3: '3 mois',
  repeating_12: '1 an',
  forever: 'Permanent',
};

export default function AdminAffiliatesPage() {
  const { user } = useAuth();
  const [affiliates, setAffiliates] = useState<AffiliateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editingAffiliate, setEditingAffiliate] = useState<AffiliateItem | null>(null);
  const [editCommission, setEditCommission] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDiscountDuration, setEditDiscountDuration] = useState('once');
  const [updating, setUpdating] = useState(false);

  // Form
  const [form, setForm] = useState({
    name: '',
    email: '',
    code: '',
    commission: '20',
    discount: '',
    discountDuration: 'once',
  });

  // Provider autocomplete state (used in create modal)
  const [providerQuery, setProviderQuery] = useState('');
  const [providerResults, setProviderResults] = useState<ProviderSearchResult[]>([]);
  const [providerSearching, setProviderSearching] = useState(false);
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderSearchResult | null>(null);
  const providerSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadAffiliates = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await adminAffiliateService.getAffiliates(user.id);
      setAffiliates(data.affiliates || []);
    } catch (err) {
      console.error('Error loading affiliates:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  /**
   * Reset the create-affiliate modal form and its autocomplete state.
   * Called when opening/closing the modal or after a successful create.
   */
  const resetCreateForm = () => {
    setForm({ name: '', email: '', code: '', commission: '20', discount: '', discountDuration: 'once' });
    setProviderQuery('');
    setProviderResults([]);
    setSelectedProvider(null);
    setProviderDropdownOpen(false);
  };

  /**
   * Debounced provider search — kicks off 250 ms after the user stops typing,
   * and only if the query has at least 2 characters. Results are 10 providers
   * max, joined with their owner user for the email field.
   */
  const handleProviderSearch = (value: string) => {
    setProviderQuery(value);
    setSelectedProvider(null);
    setProviderDropdownOpen(value.trim().length >= 2);

    if (providerSearchTimeoutRef.current) {
      clearTimeout(providerSearchTimeoutRef.current);
    }
    if (!user?.id || value.trim().length < 2) {
      setProviderResults([]);
      return;
    }

    providerSearchTimeoutRef.current = setTimeout(async () => {
      setProviderSearching(true);
      try {
        const results = await adminProviderService.searchForAffiliate(user.id, value);
        setProviderResults(results);
      } catch (err) {
        console.error('Provider search error:', err);
        setProviderResults([]);
      } finally {
        setProviderSearching(false);
      }
    }, 250);
  };

  /** Prefill the form from the selected provider and collapse the dropdown. */
  const handleSelectProvider = (provider: ProviderSearchResult) => {
    setSelectedProvider(provider);
    setProviderQuery(provider.businessName);
    setProviderDropdownOpen(false);
    setForm((prev) => ({
      ...prev,
      name: provider.businessName || provider.displayName || prev.name,
      email: provider.email || prev.email,
    }));
  };

  const handleCreate = async () => {
    if (!user?.id || !form.name || !form.email || !form.code) return;
    setCreating(true);
    setError(null);
    try {
      const result = await adminAffiliateService.createAffiliate(user.id, {
        name: form.name,
        email: form.email,
        code: form.code.toUpperCase(),
        commission: Number(form.commission),
        discount: form.discount ? Number(form.discount) : null,
        discountDuration: form.discount ? form.discountDuration : null,
      });
      setShowCreate(false);
      resetCreateForm();
      await loadAffiliates();

      // Open onboarding link in new tab
      if (result.onboardingUrl) {
        window.open(result.onboardingUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (affiliateId: string, name: string) => {
    if (!user?.id) return;
    if (!confirm(`Supprimer l'affilié "${name}" ? Son compte Connect et son coupon seront supprimés.`)) return;
    try {
      await adminAffiliateService.deleteAffiliate(user.id, affiliateId);
      await loadAffiliates();
    } catch (err) {
      console.error('Error deleting affiliate:', err);
    }
  };

  const handleUpdate = async () => {
    if (!user?.id || !editingAffiliate) return;
    setUpdating(true);
    setError(null);
    try {
      await adminAffiliateService.updateAffiliate(user.id, editingAffiliate.id, {
        commission: Number(editCommission),
        discount: editDiscount ? Number(editDiscount) : null,
        discountDuration: editDiscount ? editDiscountDuration : null,
      });
      setEditingAffiliate(null);
      await loadAffiliates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const copyLink = (code: string) => {
    navigator.clipboard.writeText(`https://opatam.com/register?ref=${code}`);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Handshake className="w-6 h-6" />
            Affiliés
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {affiliates.length} affilié{affiliates.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Créer un affilié
        </button>
      </div>

      {/* Stats */}
      {affiliates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Affiliés actifs</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {affiliates.filter((a) => a.isActive).length}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Total filleuls</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {affiliates.reduce((s, a) => s + a.stats.totalReferrals, 0)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Revenus générés</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {(affiliates.reduce((s, a) => s + a.stats.totalRevenue, 0) / 100).toFixed(2)} €
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Commissions versées</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">
              {(affiliates.reduce((s, a) => s + a.stats.totalCommission, 0) / 100).toFixed(2)} €
            </p>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setShowCreate(false); resetCreateForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nouvel affilié</h3>
              <button onClick={() => { setShowCreate(false); resetCreateForm(); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Provider autocomplete — pre-fill from an existing provider */}
              <div className="relative">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Rechercher un prestataire existant
                  <span className="text-gray-400 font-normal ml-1.5">(optionnel)</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    value={providerQuery}
                    onChange={(e) => handleProviderSearch(e.target.value)}
                    onFocus={() => providerQuery.trim().length >= 2 && setProviderDropdownOpen(true)}
                    placeholder="Nom du prestataire..."
                    className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  {providerSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                  )}
                  {!providerSearching && (selectedProvider || providerQuery) && (
                    <button
                      type="button"
                      onClick={() => { setProviderQuery(''); setSelectedProvider(null); setProviderResults([]); setProviderDropdownOpen(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Effacer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown results */}
                {providerDropdownOpen && providerQuery.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg">
                    {!providerSearching && providerResults.length === 0 && (
                      <p className="px-3 py-3 text-xs text-gray-400 text-center">
                        Aucun prestataire trouvé
                      </p>
                    )}
                    {providerResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProvider(p)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-b-0"
                      >
                        {p.photoURL ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.photoURL} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {p.businessName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {p.email ?? 'Pas d\'email'}
                          </p>
                        </div>
                        {p.alreadyAffiliate && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex-shrink-0">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Déjà affilié
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedProvider?.alreadyAffiliate && (
                  <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    Ce prestataire est déjà affilié. Créer un nouvel affilié remplacera son lien.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Nom</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Marie Dupont"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="marie@example.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Code promo</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="MARIE"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Commission (%)</label>
                  <input
                    type="number"
                    value={form.commission}
                    onChange={(e) => setForm({ ...form, commission: e.target.value })}
                    min="1"
                    max="50"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Discount section */}
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Réduction pour les filleuls (optionnel)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Réduction (%)</label>
                    <input
                      type="number"
                      value={form.discount}
                      onChange={(e) => setForm({ ...form, discount: e.target.value })}
                      placeholder="0"
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Durée</label>
                    <select
                      value={form.discountDuration}
                      onChange={(e) => setForm({ ...form, discountDuration: e.target.value })}
                      disabled={!form.discount}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="once">1er mois</option>
                      <option value="repeating_3">3 premiers mois</option>
                      <option value="repeating_12">1ère année</option>
                      <option value="forever">Permanent</option>
                    </select>
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                onClick={handleCreate}
                disabled={creating || !form.name || !form.email || !form.code}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                {creating ? 'Création en cours...' : 'Créer l\'affilié'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Affiliates List */}
      {affiliates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700">
          <Handshake className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">Aucun affilié pour le moment</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer le premier affilié
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Affilié</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Commission</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Réduction</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Filleuls</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gains</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{a.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{a.email}</p>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 rounded">
                        {a.code}
                      </span>
                      <button
                        onClick={() => copyLink(a.code)}
                        className="p-1 text-gray-400 hover:text-primary-600 transition-colors"
                        title="Copier le lien"
                      >
                        {copiedCode === a.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {a.commission}%
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {a.discount ? (
                      <span className="text-emerald-600 font-medium">-{a.discount}% · {DURATION_LABELS[a.discountDuration || 'once']}</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white font-medium">{a.stats.totalReferrals}</span>
                      {a.stats.trialReferrals > 0 && (
                        <span className="text-xs text-amber-500 ml-1">({a.stats.trialReferrals} en essai)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm font-semibold text-emerald-600">
                      {(a.stats.totalCommission / 100).toFixed(2)} €
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      a.stripeAccountStatus === 'active'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : a.stripeAccountStatus === 'pending'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {a.stripeAccountStatus === 'active' ? 'Actif' : a.stripeAccountStatus === 'pending' ? 'En attente' : 'Restreint'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingAffiliate(a);
                          setEditCommission(String(a.commission));
                          setEditDiscount(a.discount ? String(a.discount) : '');
                          setEditDiscountDuration(a.discountDuration || 'once');
                        }}
                        className="p-1.5 text-gray-400 hover:text-primary-500 transition-colors"
                        title="Modifier la commission"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
                      </button>
                    <button
                      onClick={() => handleDelete(a.id, a.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Edit Commission Modal */}
      {editingAffiliate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setEditingAffiliate(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Modifier l'affilié</h3>
            <p className="text-sm text-gray-500 mb-4">{editingAffiliate.name} ({editingAffiliate.code})</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Commission (%)</label>
                <input
                  type="number"
                  value={editCommission}
                  onChange={(e) => setEditCommission(e.target.value)}
                  min="1"
                  max="50"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Réduction filleuls (%)</label>
                  <input
                    type="number"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Durée</label>
                  <select
                    value={editDiscountDuration}
                    onChange={(e) => setEditDiscountDuration(e.target.value)}
                    disabled={!editDiscount}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                  >
                    <option value="once">1er mois</option>
                    <option value="repeating_3">3 mois</option>
                    <option value="repeating_12">1 an</option>
                    <option value="forever">Permanent</option>
                  </select>
                </div>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAffiliate(null)}
                  className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updating || !editCommission}
                  className="flex-1 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-40"
                >
                  {updating ? 'Mise à jour...' : 'Enregistrer'}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">Un email sera envoyé à l'affilié pour l'informer du changement.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
