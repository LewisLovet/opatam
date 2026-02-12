'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Mail, Clock, Send, MessageSquare, HelpCircle, Briefcase } from 'lucide-react';
import { useState } from 'react';

type SubjectType = 'general' | 'support' | 'partnership' | 'press';

const subjects: { value: SubjectType; label: string; icon: React.ReactNode }[] = [
  { value: 'general', label: 'Question générale', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'support', label: 'Support technique', icon: <HelpCircle className="w-4 h-4" /> },
  { value: 'partnership', label: 'Partenariat', icon: <Briefcase className="w-4 h-4" /> },
  { value: 'press', label: 'Presse', icon: <Mail className="w-4 h-4" /> },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general' as SubjectType,
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }

      setStatus('sent');
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue. Réessayez ou contactez-nous directement à contact@opatam.com');
      setStatus('error');
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50">
          {/* Decorative blobs */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-100/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-blue-100/40 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
              <Mail className="w-4 h-4" />
              Contactez-nous
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
              Une question ?{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                Parlons-en.
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Notre équipe est disponible pour répondre à toutes vos questions sur Opatam,
              que vous soyez professionnel ou client.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">

            {/* Left: Contact Info */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Informations</h2>
                <div className="space-y-6">
                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Email</p>
                      <a
                        href="mailto:contact@opatam.com"
                        className="text-gray-900 font-medium hover:text-indigo-600 transition-colors"
                      >
                        contact@opatam.com
                      </a>
                    </div>
                  </div>

                  {/* Response time */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Temps de réponse</p>
                      <p className="text-gray-900 font-medium">Sous 24h en jours ouvrés</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ CTA */}
              <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Questions fréquentes</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Consultez notre FAQ pour trouver rapidement la réponse à votre question.
                </p>
                <a
                  href="/#faq"
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  Voir la FAQ
                </a>
              </div>
            </div>

            {/* Right: Contact Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Envoyez-nous un message</h2>

                {status === 'sent' ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                      <Send className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Message envoyé !</h3>
                    <p className="text-gray-600 mb-6">
                      Nous avons bien reçu votre message. Un email de confirmation vous a été envoyé.
                      Nous vous répondrons sous 24h en jours ouvrés.
                    </p>
                    <button
                      onClick={() => {
                        setStatus('idle');
                        setFormData({ name: '', email: '', subject: 'general', message: '' });
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Envoyer un autre message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name & Email */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Nom complet
                        </label>
                        <input
                          type="text"
                          id="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                          placeholder="Votre nom"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          id="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                          placeholder="votre@email.com"
                        />
                      </div>
                    </div>

                    {/* Subject selector */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Sujet
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {subjects.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, subject: s.value })}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                              formData.subject === s.value
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {s.icon}
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Message
                      </label>
                      <textarea
                        id="message"
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all resize-none"
                        placeholder="Décrivez votre demande en détail..."
                      />
                    </div>

                    {/* Error message */}
                    {status === 'error' && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={status === 'sending'}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {status === 'sending' ? 'Envoi...' : 'Envoyer le message'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
