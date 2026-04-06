'use client';

import { useState, useRef, useEffect } from 'react';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from '@booking-app/firebase';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function FunctionsTestPage() {
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  // Prod functions (notifications) — always call prod Firebase
  const prodFunctions = getFunctions(app, 'europe-west1');
  // Emulator functions (scheduling) — only if emulator is running
  const emulatorFunctions = useRef<ReturnType<typeof getFunctions> | null>(null);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost';
    if (isLocalhost) {
      const emu = getFunctions(app);
      connectFunctionsEmulator(emu, 'localhost', 5001);
      emulatorFunctions.current = emu;
    }
  }, []);

  const callFunction = async (name: string, data: Record<string, any>, useEmulator = false) => {
    setLoading(name);
    setError(null);
    setResult(null);

    try {
      const functions = useEmulator && emulatorFunctions.current ? emulatorFunctions.current : prodFunctions;
      const fn = httpsCallable(functions, name);
      const response = await fn(data);
      setResult({ function: name, ...response.data as any });
    } catch (err: any) {
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(null);
    }
  };

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Cloud Functions</h1>
          <p className="text-slate-400 mt-1">
            Testez les fonctions Firebase Cloud Functions.
            {isLocalhost && (
              <span className="ml-2 text-amber-400 text-xs font-medium">
                Emulateur connecte (localhost:5001)
              </span>
            )}
          </p>
        </div>

        {/* Provider ID input */}
        <Card variant="bordered" className="mb-6 bg-slate-900/50 border-slate-800">
          <CardBody>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Input
                  label="Provider ID"
                  placeholder="Collez l'ID du provider a tester"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  hint="Requis pour tester les notifications"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const functions = getFunctions(app);
                    const fn = httpsCallable(functions, 'testFunction');
                    const response = await fn();
                    const data = response.data as any;
                    if (data?.data?.providers?.[0]?.id) {
                      setProviderId(data.data.providers[0].id);
                    }
                  } catch {
                    setError('Impossible de charger les providers (emulateur requis)');
                  }
                }}
              >
                Auto-detect
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="notifications">
          <TabsList className="mb-4">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          </TabsList>

          {/* ── Notifications Tab ── */}
          <TabsContent value="notifications">
            <div className="space-y-4">
              {/* Subscription reminders */}
              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Abonnement" description="Teste les notifications d'expiration et de page non publiee" />
                <CardBody>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { type: 'j-7', label: 'Expiration J-7', desc: 'Dans 7 jours' },
                      { type: 'j-1', label: 'Expiration J-1', desc: 'Demain' },
                      { type: 'expired', label: 'Page depubliee', desc: 'Expire' },
                      { type: 'unpublished', label: 'Page non publiee', desc: 'Rappel' },
                    ].map(({ type, label, desc }) => (
                      <Button
                        key={type}
                        variant="outline"
                        size="sm"
                        disabled={!providerId || loading === `sub-${type}`}
                        loading={loading === `sub-${type}`}
                        onClick={() => callFunction('testSubscriptionReminders', { providerId, reminderType: type })}
                      >
                        <div className="text-left">
                          <div className="font-medium">{label}</div>
                          <div className="text-xs text-slate-400">{desc}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* Review notification */}
              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Avis clients" description="Simule la reception d'un nouvel avis (push + email)" />
                <CardBody>
                  <div className="flex gap-2">
                    {[
                      { rating: 1, comment: 'Pas terrible.' },
                      { rating: 3, comment: 'Correct, peut mieux faire.' },
                      { rating: 5, comment: 'Super prestation, je recommande !' },
                    ].map(({ rating, comment }) => (
                      <Button
                        key={rating}
                        variant="outline"
                        size="sm"
                        disabled={!providerId || loading === `review-${rating}`}
                        loading={loading === `review-${rating}`}
                        onClick={() => callFunction('testReviewNotification', {
                          providerId,
                          rating,
                          clientName: 'Client Test',
                          comment,
                        })}
                      >
                        <span className="text-lg">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
                      </Button>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* Push notification (emulator only) */}
              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Push simple" description="Envoie une push de test (emulateur requis)" />
                <CardBody>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!providerId || loading === 'push'}
                    loading={loading === 'push'}
                    onClick={() => callFunction('testPushNotification', {
                      userId: providerId,
                      type: 'simple',
                    }, true)}
                  >
                    Envoyer une push de test
                  </Button>
                </CardBody>
              </Card>
            </div>
          </TabsContent>

          {/* ── Emails Tab ── */}
          <TabsContent value="emails">
            <div className="space-y-4">
              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Templates email" description="Les emails sont envoyes en meme temps que les push via les boutons Notifications" />
                <CardBody>
                  <p className="text-sm text-slate-400 mb-4">
                    Cliquez sur les boutons dans l'onglet Notifications pour recevoir les emails.
                    Chaque bouton envoie a la fois la push ET l'email.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-slate-300">Expiration J-7 / J-1</span>
                      <span className="text-slate-500">— Bandeau jaune "Il reste X jours"</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-slate-300">Page depubliee</span>
                      <span className="text-slate-500">— Bandeau rouge "Votre abonnement a expire"</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-slate-300">Page non publiee</span>
                      <span className="text-slate-500">— Incitation a publier</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="text-slate-300">Nouvel avis</span>
                      <span className="text-slate-500">— Etoiles + commentaire du client</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          </TabsContent>

          {/* ── Scheduling Tab ── */}
          <TabsContent value="scheduling">
            <div className="space-y-4">
              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Recalcul creneaux" description="Recalcule le nextAvailableSlot pour un provider" />
                <CardBody>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!providerId || loading === 'recalculate'}
                    loading={loading === 'recalculate'}
                    onClick={() => callFunction('recalculateNextSlot', { providerId }, true)}
                  >
                    Recalculer les creneaux
                  </Button>
                </CardBody>
              </Card>

              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Agenda quotidien" description="Envoie le resume d'agenda quotidien au provider" />
                <CardBody>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!providerId || loading === 'agenda'}
                    loading={loading === 'agenda'}
                    onClick={() => callFunction('testDailyAgendaSummary', { providerId }, true)}
                  >
                    Envoyer le resume agenda
                  </Button>
                </CardBody>
              </Card>

              <Card variant="bordered" className="bg-slate-900/50 border-slate-800">
                <CardHeader title="Aggregation page views" description="Recalcule les statistiques de vues" />
                <CardBody>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!providerId || loading === 'aggregate'}
                    loading={loading === 'aggregate'}
                    onClick={() => callFunction('testAggregatePageViews', { providerId }, true)}
                  >
                    Agreger les vues
                  </Button>
                </CardBody>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Result panel */}
        {(result || error) && (
          <Card variant="bordered" className="mt-6 bg-slate-900/50 border-slate-800">
            <CardHeader
              title={error ? 'Erreur' : 'Resultat'}
              action={
                <Button variant="ghost" size="sm" onClick={() => { setResult(null); setError(null); }}>
                  Fermer
                </Button>
              }
            />
            <CardBody>
              {error ? (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-sm text-red-400 font-mono">{error}</p>
                </div>
              ) : (
                <pre className="text-xs text-slate-300 bg-slate-950 p-4 rounded-lg overflow-x-auto max-h-80 overflow-y-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              )}
            </CardBody>
          </Card>
        )}

        {/* Info */}
        <div className="mt-6 text-xs text-slate-500 text-center">
          Les fonctions de test (Notifications) sont disponibles en prod (admin only).
          Les fonctions Scheduling necessitent l'emulateur Firebase.
        </div>
      </div>
    </div>
  );
}
