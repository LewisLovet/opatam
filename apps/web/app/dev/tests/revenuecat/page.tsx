'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import {
  ArrowLeft,
  Smartphone,
  Webhook,
  Terminal,
  Check,
  X,
  Send,
  RefreshCw,
  Apple,
  Play,
  Radio,
  Trash2,
} from 'lucide-react';
import {
  db,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from '@booking-app/firebase';

// ---------------------------------------------------------------------------
// RevenueCat Webhook Test Page
// ---------------------------------------------------------------------------
// Two panels:
// 1. LIVE MONITOR — Real-time Firestore listener on _webhookLogs collection
//    Shows ALL events received by the webhook (from RevenueCat or simulator)
// 2. SIMULATOR — Send fake webhook events for local testing
// ---------------------------------------------------------------------------

interface WebhookLog {
  id: string;
  source: string;
  eventType: string;
  productId: string;
  store: string;
  environment: string;
  providerId: string | null;
  appUserId: string;
  status: 'received' | 'processed' | 'error';
  error: string | null;
  payload: Record<string, any>;
  createdAt: any;
}

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const EVENT_TYPES = [
  { value: 'INITIAL_PURCHASE', label: 'INITIAL_PURCHASE — Premier achat' },
  { value: 'RENEWAL', label: 'RENEWAL — Renouvellement' },
  { value: 'CANCELLATION', label: 'CANCELLATION — Annulation' },
  { value: 'UNCANCELLATION', label: 'UNCANCELLATION — Reprise' },
  { value: 'EXPIRATION', label: 'EXPIRATION — Expiration' },
  { value: 'BILLING_ISSUE_DETECTED', label: 'BILLING_ISSUE — Problème paiement' },
  { value: 'BILLING_ISSUE_RESOLVED', label: 'BILLING_RESOLVED — Paiement résolu' },
  { value: 'PRODUCT_CHANGE', label: 'PRODUCT_CHANGE — Changement de plan' },
] as const;

const PRODUCTS = [
  { value: 'opatam_solo_monthly', label: 'Solo Mensuel (17,99€/mois)' },
  { value: 'opatam_solo_yearly', label: 'Solo Annuel (179,99€/an)' },
  { value: 'opatam_team_monthly', label: 'Team Mensuel (29,99€/mois)' },
  { value: 'opatam_team_yearly', label: 'Team Annuel (239,99€/an)' },
] as const;

const STORES = [
  { value: 'APP_STORE', label: 'Apple App Store' },
  { value: 'PLAY_STORE', label: 'Google Play Store' },
] as const;

function buildWebhookPayload(params: {
  eventType: string;
  providerId: string;
  productId: string;
  store: string;
  periodType: string;
  newProductId?: string;
}) {
  const now = Date.now();
  // Expiration: 1 month from now for monthly, 1 year for yearly
  const isYearly = params.productId.includes('yearly');
  const expirationMs = now + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000;

  // For EXPIRATION events, set expiration in the past
  const actualExpirationMs = params.eventType === 'EXPIRATION'
    ? now - 60 * 1000 // 1 minute ago
    : expirationMs;

  // For CANCELLATION, expiration can be in the future (access until period end)
  const cancellationExpirationMs = params.eventType === 'CANCELLATION'
    ? expirationMs // Still has access
    : actualExpirationMs;

  return {
    api_version: '1.0',
    event: {
      type: params.eventType,
      app_user_id: params.providerId,
      aliases: [params.providerId],
      product_id: params.productId,
      entitlement_ids: params.productId.includes('solo') ? ['solo_access'] : ['team_access'],
      period_type: params.periodType as 'TRIAL' | 'INTRO' | 'NORMAL',
      purchased_at_ms: now,
      expiration_at_ms: params.eventType === 'CANCELLATION' ? cancellationExpirationMs : actualExpirationMs,
      store: params.store,
      environment: 'SANDBOX' as const,
      is_family_share: false,
      country_code: 'FR',
      currency: 'EUR',
      price_in_purchased_currency: params.productId.includes('solo')
        ? (isYearly ? 179.99 : 17.99)
        : (isYearly ? 239.99 : 29.99),
      subscriber_attributes: {
        providerId: { value: params.providerId, updated_at_ms: now },
      },
      transaction_id: `rc_test_${now}`,
      original_transaction_id: `rc_test_orig_${params.providerId}`,
      ...(params.eventType === 'PRODUCT_CHANGE' && params.newProductId
        ? { new_product_id: params.newProductId }
        : {}),
    },
  };
}

export default function RevenueCatTestPage() {
  const [providerId, setProviderId] = useState('');
  const [eventType, setEventType] = useState('INITIAL_PURCHASE');
  const [productId, setProductId] = useState('opatam_solo_monthly');
  const [store, setStore] = useState('APP_STORE');
  const [periodType, setPeriodType] = useState('NORMAL');
  const [newProductId, setNewProductId] = useState('opatam_team_monthly');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [lastPayload, setLastPayload] = useState<string>('');

  // Real-time webhook logs from Firestore
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isListening, setIsListening] = useState(true);

  useEffect(() => {
    if (!isListening) return;

    const q = query(
      collection(db, '_webhookLogs'),
      orderBy('createdAt', 'desc'),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs: WebhookLog[] = [];
      snapshot.forEach((doc) => {
        newLogs.push({ id: doc.id, ...doc.data() } as WebhookLog);
      });
      setWebhookLogs(newLogs);
    });

    return () => unsubscribe();
  }, [isListening]);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('fr-FR');
    setLogs((prev) => [{ time, message, type }, ...prev]);
  }, []);

  const sendWebhook = useCallback(async () => {
    if (!providerId.trim()) {
      addLog('Erreur: Provider ID requis', 'error');
      return;
    }

    setIsSending(true);
    const payload = buildWebhookPayload({
      eventType,
      providerId: providerId.trim(),
      productId,
      store,
      periodType,
      newProductId: eventType === 'PRODUCT_CHANGE' ? newProductId : undefined,
    });

    setLastPayload(JSON.stringify(payload, null, 2));
    addLog(`Envoi: ${eventType} pour ${providerId} (${productId}, ${store})`, 'info');

    try {
      const res = await fetch('/api/revenuecat/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        addLog(`Succès (${res.status}): ${JSON.stringify(data)}`, 'success');
      } else {
        addLog(`Erreur (${res.status}): ${JSON.stringify(data)}`, 'error');
      }
    } catch (error) {
      addLog(`Erreur réseau: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setIsSending(false);
    }
  }, [providerId, eventType, productId, store, periodType, newProductId, addLog]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dev/tests" className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-purple-400" />
            RevenueCat Webhook Tests
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Simuler des événements RevenueCat pour tester le webhook localement
          </p>
        </div>
      </div>

      {/* Live Monitor — Real-time events from Firestore */}
      <div className="rounded-xl border border-slate-800/50 bg-slate-900">
        <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isListening ? 'text-red-400 animate-pulse' : 'text-slate-500'}`} />
            Événements reçus en temps réel
            {webhookLogs.length > 0 && (
              <Badge variant="default">{webhookLogs.length}</Badge>
            )}
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsListening(!isListening)}
              className={`text-xs px-2 py-1 rounded ${isListening ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'} hover:opacity-80 transition-opacity`}
            >
              {isListening ? 'Pause' : 'Reprendre'}
            </button>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {webhookLogs.length === 0 ? (
            <div className="p-8 text-center">
              <Radio className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                En attente d&apos;événements...
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Les événements RevenueCat et les simulations apparaîtront ici en temps réel.
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800/50 text-slate-500">
                  <th className="text-left px-4 py-2 font-medium">Heure</th>
                  <th className="text-left px-4 py-2 font-medium">Événement</th>
                  <th className="text-left px-4 py-2 font-medium">Produit</th>
                  <th className="text-left px-4 py-2 font-medium">Store</th>
                  <th className="text-left px-4 py-2 font-medium">Provider</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {webhookLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-800/30 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 font-mono">
                      {log.createdAt?.toDate?.()
                        ? log.createdAt.toDate().toLocaleTimeString('fr-FR')
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-semibold ${
                        log.eventType === 'INITIAL_PURCHASE' ? 'text-emerald-400' :
                        log.eventType === 'RENEWAL' ? 'text-blue-400' :
                        log.eventType === 'CANCELLATION' ? 'text-amber-400' :
                        log.eventType === 'EXPIRATION' ? 'text-red-400' :
                        log.eventType === 'BILLING_ISSUE_DETECTED' ? 'text-red-400' :
                        'text-slate-300'
                      }`}>
                        {log.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 font-mono">
                      {log.productId || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {log.store === 'APP_STORE' ? (
                        <span className="flex items-center gap-1 text-slate-300">
                          <Apple className="w-3 h-3" /> Apple
                        </span>
                      ) : log.store === 'PLAY_STORE' ? (
                        <span className="flex items-center gap-1 text-green-400">
                          <Play className="w-3 h-3" /> Google
                        </span>
                      ) : (
                        <span className="text-slate-500">{log.store}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 font-mono">
                      {log.providerId
                        ? `${log.providerId.substring(0, 8)}...`
                        : <span className="text-red-400">null</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          log.status === 'processed' ? 'success' :
                          log.status === 'error' ? 'error' :
                          'default'
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">
                      {log.error || (log.payload?.price ? `${log.payload.price}${log.payload.currency}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Provider ID */}
          <div className="rounded-xl border border-slate-800/50 bg-slate-900 p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              Configuration
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Provider ID (Firebase UID)
                </label>
                <Input
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="ex: abc123def456"
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Type d&apos;événement
                </label>
                <Select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  options={EVENT_TYPES.map((e) => ({ value: e.value, label: e.label }))}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Produit
                </label>
                <Select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  options={PRODUCTS.map((p) => ({ value: p.value, label: p.label }))}
                />
              </div>

              {eventType === 'PRODUCT_CHANGE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Nouveau produit (changement de plan)
                  </label>
                  <Select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    options={PRODUCTS.map((p) => ({ value: p.value, label: p.label }))}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Store
                  </label>
                  <Select
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    options={STORES.map((s) => ({ value: s.value, label: s.label }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Période
                  </label>
                  <Select
                    value={periodType}
                    onChange={(e) => setPeriodType(e.target.value)}
                    options={[
                      { value: 'NORMAL', label: 'Normal' },
                      { value: 'TRIAL', label: 'Trial' },
                      { value: 'INTRO', label: 'Intro' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={sendWebhook}
                disabled={isSending || !providerId.trim()}
                className="w-full"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {isSending ? 'Envoi en cours...' : 'Envoyer le webhook'}
              </Button>
            </div>
          </div>

          {/* Quick scenarios */}
          <div className="rounded-xl border border-slate-800/50 bg-slate-900 p-6">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-400" />
              Scénarios rapides
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Remplissez le Provider ID ci-dessus, puis cliquez sur un scénario.
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  setEventType('INITIAL_PURCHASE');
                  setProductId('opatam_solo_monthly');
                  setStore('APP_STORE');
                  setPeriodType('NORMAL');
                  setTimeout(sendWebhook, 100);
                }}
                disabled={!providerId.trim() || isSending}
                className="text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Apple className="w-4 h-4 text-slate-400" />
                Achat Solo via Apple
              </button>
              <button
                onClick={() => {
                  setEventType('INITIAL_PURCHASE');
                  setProductId('opatam_team_monthly');
                  setStore('PLAY_STORE');
                  setPeriodType('NORMAL');
                  setTimeout(sendWebhook, 100);
                }}
                disabled={!providerId.trim() || isSending}
                className="text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Play className="w-4 h-4 text-green-400" />
                Achat Team via Google Play
              </button>
              <button
                onClick={() => {
                  setEventType('CANCELLATION');
                  setStore('APP_STORE');
                  setPeriodType('NORMAL');
                  setTimeout(sendWebhook, 100);
                }}
                disabled={!providerId.trim() || isSending}
                className="text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <X className="w-4 h-4 text-red-400" />
                Annulation
              </button>
              <button
                onClick={() => {
                  setEventType('EXPIRATION');
                  setStore('APP_STORE');
                  setPeriodType('NORMAL');
                  setTimeout(sendWebhook, 100);
                }}
                disabled={!providerId.trim() || isSending}
                className="text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <X className="w-4 h-4 text-orange-400" />
                Expiration (dépublie le profil)
              </button>
              <button
                onClick={() => {
                  setEventType('RENEWAL');
                  setStore('APP_STORE');
                  setPeriodType('NORMAL');
                  setTimeout(sendWebhook, 100);
                }}
                disabled={!providerId.trim() || isSending}
                className="text-left px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 text-emerald-400" />
                Renouvellement
              </button>
            </div>
          </div>
        </div>

        {/* Right: Logs & Payload */}
        <div className="space-y-4">
          {/* Logs */}
          <div className="rounded-xl border border-slate-800/50 bg-slate-900">
            <div className="px-6 py-4 border-b border-slate-800/50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-green-400" />
                Logs ({logs.length})
              </h3>
              <button
                onClick={clearLogs}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Effacer
              </button>
            </div>
            <div className="p-4 max-h-[300px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Aucun log. Envoyez un webhook pour commencer.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-2 text-xs font-mono">
                      <span className="text-slate-600 shrink-0">{log.time}</span>
                      <span
                        className={
                          log.type === 'success'
                            ? 'text-emerald-400'
                            : log.type === 'error'
                              ? 'text-red-400'
                              : 'text-slate-300'
                        }
                      >
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Last Payload */}
          <div className="rounded-xl border border-slate-800/50 bg-slate-900">
            <div className="px-6 py-4 border-b border-slate-800/50">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Webhook className="w-4 h-4 text-amber-400" />
                Dernier payload envoyé
              </h3>
            </div>
            <div className="p-4">
              {lastPayload ? (
                <pre className="text-xs font-mono text-slate-300 overflow-x-auto max-h-[400px] overflow-y-auto whitespace-pre-wrap">
                  {lastPayload}
                </pre>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  Envoyez un webhook pour voir le payload.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
