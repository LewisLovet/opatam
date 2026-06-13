'use client';

/**
 * Admin · Marketing
 *
 * Hub for marketing actions. First feature: email providers asking them to
 * rate the mobile app on the stores (selected providers, or all of them).
 * More marketing tools will be added here over time.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input, useToast } from '@/components/ui';
import { Search, Star, X, Send, Users, Megaphone, History } from 'lucide-react';
import { ActionCodeModal } from '../components/ActionCodeModal';

interface ProviderResult {
  id: string;
  businessName: string;
  email: string | null;
}

interface SendLog {
  id: string;
  sentAt?: { _seconds: number } | string | null;
  sentByName?: string | null;
  mode: 'selected' | 'all';
  sent: number;
  failed: number;
  total: number;
  recipientNames?: string[] | null;
}

type Mode = 'selected' | 'all';

function formatLogDate(v: SendLog['sentAt']): string {
  if (!v) return '';
  const ms = typeof v === 'string' ? Date.parse(v) : (v._seconds ?? 0) * 1000;
  if (!ms) return '';
  return new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MarketingPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>('selected');

  // Provider search + multi-select
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [selected, setSelected] = useState<ProviderResult[]>([]);

  const [sending, setSending] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);

  const [history, setHistory] = useState<SendLog[]>([]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/admin/app-review-email', { headers: { 'x-admin-uid': user.id } });
      const data = await res.json();
      if (res.ok) setHistory(data.logs || []);
    } catch {
      /* silent */
    }
  }, [user?.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const searchProviders = useCallback(async () => {
    if (!user?.id || query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/providers/search?q=${encodeURIComponent(query.trim())}`, {
        headers: { 'x-admin-uid': user.id },
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      toast.error('Erreur lors de la recherche');
    } finally {
      setSearching(false);
    }
  }, [user?.id, query, toast]);

  const addProvider = (p: ProviderResult) => {
    if (!p.email) {
      toast.error(`${p.businessName} n'a pas d'email`);
      return;
    }
    setSelected((prev) => (prev.some((s) => s.id === p.id) ? prev : [...prev, p]));
    setResults([]);
    setQuery('');
  };

  const removeProvider = (id: string) => setSelected((prev) => prev.filter((s) => s.id !== id));

  const send = useCallback(
    async (actionCode?: string) => {
      if (!user?.id) return;
      setSending(true);
      try {
        const payload =
          mode === 'all'
            ? { mode: 'all', actionCode }
            : {
                mode: 'selected',
                recipients: selected.map((s) => ({ email: s.email, name: s.businessName })),
              };
        const res = await fetch('/api/admin/app-review-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-uid': user.id },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error || "Échec de l'envoi");
          return;
        }
        toast.success(
          `Email envoyé à ${data.sent} prestataire${data.sent > 1 ? 's' : ''}` +
            (data.failed > 0 ? ` · ${data.failed} échec(s)` : ''),
        );
        setShowCodeModal(false);
        if (mode === 'selected') setSelected([]);
        void loadHistory();
      } catch {
        toast.error("Erreur lors de l'envoi");
      } finally {
        setSending(false);
      }
    },
    [user?.id, mode, selected, toast, loadHistory],
  );

  const canSend = mode === 'all' || selected.length > 0;

  const handleSendClick = () => {
    if (!canSend) return;
    if (mode === 'all') {
      setShowCodeModal(true); // mass send → confirm with admin code
    } else {
      void send();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
          <Megaphone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actions de croissance — emails, demandes d&apos;avis, etc.
          </p>
        </div>
      </header>

      {/* Feature: ask for an app rating by email */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <Star className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Demander un avis sur l&apos;application
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Envoie un email invitant les prestataires à noter l&apos;app sur les stores.
            </p>
          </div>
        </div>

        {/* Recipient mode */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('selected')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
              mode === 'selected'
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Prestataires sélectionnés
          </button>
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors inline-flex items-center justify-center gap-2 ${
              mode === 'all'
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Tous les prestataires
          </button>
        </div>

        {mode === 'selected' ? (
          <div className="space-y-3">
            {/* Search */}
            <div className="flex gap-2">
              <Input
                placeholder="Rechercher un prestataire…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchProviders()}
              />
              <Button
                onClick={searchProviders}
                loading={searching}
                leftIcon={<Search className="w-4 h-4" />}
              >
                Chercher
              </Button>
            </div>

            {results.length > 0 && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 overflow-hidden">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addProvider(r)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">
                        {r.businessName}
                      </span>
                      <span className="block text-xs text-gray-400 truncate">
                        {r.email || 'Pas d’email'}
                      </span>
                    </span>
                    <span className="text-xs text-primary-600 dark:text-primary-400 font-semibold flex-shrink-0">
                      Ajouter
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    {s.businessName}
                    <button
                      type="button"
                      onClick={() => removeProvider(s.id)}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Retirer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            L&apos;email partira à <strong>tous les prestataires</strong> ayant une adresse valide.
            Confirmation par code admin requise.
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          {mode === 'selected' && (
            <span className="text-sm text-gray-400 mr-auto">
              {selected.length} destinataire{selected.length > 1 ? 's' : ''}
            </span>
          )}
          <Button
            onClick={handleSendClick}
            disabled={!canSend || sending}
            loading={sending && mode === 'selected'}
            leftIcon={<Send className="w-4 h-4" />}
          >
            {mode === 'all' ? 'Envoyer à tous' : "Envoyer la demande d'avis"}
          </Button>
        </div>
      </section>

      {/* Send history */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Historique des envois</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune demande d&apos;avis envoyée pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {history.map((log) => (
              <li key={log.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {log.mode === 'all' ? 'Tous les prestataires' : `${log.total} prestataire${log.total > 1 ? 's' : ''} sélectionné${log.total > 1 ? 's' : ''}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatLogDate(log.sentAt)}
                    {log.sentByName ? ` · par ${log.sentByName}` : ''}
                  </p>
                  {log.mode === 'selected' && log.recipientNames && log.recipientNames.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {log.recipientNames.slice(0, 6).join(', ')}
                      {log.recipientNames.length > 6 ? `, +${log.recipientNames.length - 6}` : ''}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {log.sent} envoyé{log.sent > 1 ? 's' : ''}
                  {log.failed > 0 && (
                    <span className="text-red-500"> · {log.failed} échec{log.failed > 1 ? 's' : ''}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ActionCodeModal
        open={showCodeModal}
        title="Envoyer à tous les prestataires"
        intro="Email de demande d'avis envoyé à l'ensemble des prestataires."
        recap={[
          { label: 'Action', value: 'Demande d’avis sur l’app' },
          { label: 'Destinataires', value: 'Tous les prestataires', warn: true },
        ]}
        confirmLabel="Envoyer"
        loading={sending}
        onConfirm={(code) => send(code)}
        onClose={() => setShowCodeModal(false)}
      />
    </div>
  );
}
