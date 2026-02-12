'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Send,
  Eye,
  Check,
  AlertCircle,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  Bell,
  PartyPopper,
  Crown,
  Loader2,
  Info,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Email type definitions
// ---------------------------------------------------------------------------

interface EmailType {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeColor: string;
  subject: string;
  description: string;
}

const EMAIL_TYPES: EmailType[] = [
  {
    id: 'confirmation',
    label: 'Confirmation',
    icon: CalendarCheck,
    color: 'text-emerald-400',
    activeColor: 'from-emerald-500/20 to-emerald-500/5',
    subject: 'Confirmation de votre rendez-vous - Coupe Homme',
    description: 'Envoyé lorsqu\'un client confirme une réservation.',
  },
  {
    id: 'cancellation',
    label: 'Annulation',
    icon: CalendarX,
    color: 'text-red-400',
    activeColor: 'from-red-500/20 to-red-500/5',
    subject: 'Annulation de votre rendez-vous - Coupe Homme',
    description: 'Envoyé lorsqu\'un rendez-vous est annulé.',
  },
  {
    id: 'reschedule',
    label: 'Report',
    icon: CalendarClock,
    color: 'text-blue-400',
    activeColor: 'from-blue-500/20 to-blue-500/5',
    subject: 'Modification de votre rendez-vous - Coupe Homme',
    description: 'Envoyé lorsqu\'un rendez-vous est reporté à une autre date.',
  },
  {
    id: 'reminder-24h',
    label: 'Rappel 24h',
    icon: Bell,
    color: 'text-blue-400',
    activeColor: 'from-blue-500/20 to-blue-500/5',
    subject: 'Rappel : votre rendez-vous demain - Coupe Homme',
    description: 'Envoyé automatiquement 24 heures avant le rendez-vous.',
  },
  {
    id: 'reminder-2h',
    label: 'Rappel 2h',
    icon: Bell,
    color: 'text-amber-400',
    activeColor: 'from-amber-500/20 to-amber-500/5',
    subject: 'Rappel : votre rendez-vous dans 2 heures - Coupe Homme',
    description: 'Envoyé automatiquement 2 heures avant le rendez-vous.',
  },
  {
    id: 'welcome',
    label: 'Bienvenue Pro',
    icon: PartyPopper,
    color: 'text-blue-400',
    activeColor: 'from-blue-500/20 to-blue-500/5',
    subject: 'Bienvenue chez Opatam \u2014 Plan Pro activé !',
    description: 'Envoyé après souscription au plan Pro (checkout Stripe).',
  },
  {
    id: 'welcome-studio',
    label: 'Bienvenue Studio',
    icon: Crown,
    color: 'text-purple-400',
    activeColor: 'from-purple-500/20 to-purple-500/5',
    subject: 'Bienvenue chez Opatam \u2014 Plan Studio activé !',
    description: 'Envoyé après souscription au plan Studio (checkout Stripe).',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmailsDevPage() {
  const [selectedType, setSelectedType] = useState<string>('confirmation');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [testEmail, setTestEmail] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedEmailType = EMAIL_TYPES.find((t) => t.id === selectedType) || EMAIL_TYPES[0];

  // Fetch preview HTML
  const fetchPreview = useCallback(async (type: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview', type }),
      });
      const data = await res.json();
      setPreviewHtml(data.html || '');
    } catch {
      setPreviewHtml('<p style="color:red;padding:20px;">Erreur lors du chargement de la preview.</p>');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load preview on mount and type change
  useEffect(() => {
    fetchPreview(selectedType);
    setSendResult(null);
  }, [selectedType, fetchPreview]);

  // Send test email
  const handleSend = async () => {
    if (!testEmail) return;
    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/dev/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', type: selectedType, email: testEmail }),
      });
      const data = await res.json();

      if (data.success) {
        setSendResult({ success: true, message: `Email envoyé à ${testEmail}` });
      } else {
        setSendResult({ success: false, message: data.error || 'Erreur inconnue' });
      }
    } catch (err) {
      setSendResult({
        success: false,
        message: err instanceof Error ? err.message : 'Erreur réseau',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-pink-500/10 rounded-lg">
              <Mail className="w-5 h-5 text-pink-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Emails</h1>
          </div>
          <p className="text-slate-400">
            Previsualiser et tester les templates d&apos;emails transactionnels
          </p>
        </div>

        {/* Email type selector (horizontal pills) */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {EMAIL_TYPES.map((emailType) => {
              const Icon = emailType.icon;
              const isActive = selectedType === emailType.id;
              return (
                <button
                  key={emailType.id}
                  onClick={() => setSelectedType(emailType.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? `bg-gradient-to-r ${emailType.activeColor} text-white border border-white/10 shadow-lg`
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800/50 hover:bg-slate-800/60 hover:text-slate-300'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? emailType.color : ''}`} />
                  {emailType.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content: two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Preview (2/3) */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl overflow-hidden">
              {/* Preview header */}
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800/50">
                <Eye className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-300">Preview</span>
                <span className="text-xs text-slate-500 ml-auto">
                  {selectedEmailType.label}
                </span>
              </div>

              {/* Preview content */}
              <div className="p-4">
                {/* Simulated email viewport */}
                <div className="mx-auto max-w-[520px] rounded-xl border border-slate-700/50 shadow-2xl shadow-black/30 overflow-hidden bg-white">
                  {/* Simulated email client header */}
                  <div className="bg-slate-100 border-b border-slate-200 px-4 py-2.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-3 h-3 rounded-full bg-red-400/80" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                      <div className="w-3 h-3 rounded-full bg-green-400/80" />
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      <span className="font-medium text-slate-700">Objet :</span>{' '}
                      {selectedEmailType.subject}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      De : Opatam &lt;noreply@kamerleontech.com&gt;
                    </p>
                  </div>

                  {/* Email body iframe */}
                  {loading ? (
                    <div className="flex items-center justify-center h-[500px] bg-white">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                        <span className="text-sm text-slate-400">Chargement...</span>
                      </div>
                    </div>
                  ) : (
                    <iframe
                      srcDoc={previewHtml}
                      title="Email preview"
                      className="w-full border-0 bg-white"
                      style={{ height: '600px' }}
                      sandbox="allow-same-origin"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Actions (1/3) */}
          <div className="space-y-6">
            {/* Send test email */}
            <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-white">Envoyer un email de test</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="test-email" className="block text-xs font-medium text-slate-400 mb-1.5">
                    Adresse email
                  </label>
                  <input
                    id="test-email"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-700/50 bg-slate-800/50 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Type d&apos;email
                  </label>
                  <div className="px-3 py-2 rounded-lg border border-slate-700/50 bg-slate-800/30 text-sm text-slate-300">
                    {selectedEmailType.label}
                  </div>
                </div>

                <button
                  onClick={handleSend}
                  disabled={sending || !testEmail}
                  className={`
                    w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${sending || !testEmail
                      ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30'
                    }
                  `}
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Envoyer
                    </>
                  )}
                </button>

                {/* Send result */}
                {sendResult && (
                  <div
                    className={`flex items-start gap-2 px-3 py-2.5 rounded-lg text-sm ${
                      sendResult.success
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {sendResult.success ? (
                      <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{sendResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Email info */}
            <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-white">Informations</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Objet</p>
                  <p className="text-sm text-slate-300">{selectedEmailType.subject}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Declencheur</p>
                  <p className="text-sm text-slate-300">{selectedEmailType.description}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-0.5">Expediteur</p>
                  <p className="text-sm text-slate-300">Opatam &lt;noreply@kamerleontech.com&gt;</p>
                </div>
              </div>
            </div>

            {/* Sample data info */}
            <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-white">Données de preview</h2>
              </div>

              <div className="space-y-2 text-xs">
                {[
                  ['Client', 'Marie Dupont'],
                  ['Prestation', 'Coupe Homme'],
                  ['Salon', 'Salon Élégance'],
                  ['Lieu', 'Paris 11e'],
                  ['Membre', 'Julien'],
                  ['Prix', '25,00 \u20ac'],
                  ['Durée', '30 min'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-300 font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
