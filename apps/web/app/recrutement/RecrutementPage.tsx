'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import {
  Users,
  Send,
  Video,
  Megaphone,
  Palette,
  Camera,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { useState } from 'react';

type ProfileType = 'vidéaste' | 'community-manager' | 'graphiste' | 'photographe';

const profiles: {
  value: ProfileType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    value: 'vidéaste',
    label: 'Vidéaste',
    icon: <Video className="w-6 h-6" />,
    description: 'Tournage, montage et contenu vidéo pour les réseaux sociaux et la publicité.',
  },
  {
    value: 'community-manager',
    label: 'Community Manager',
    icon: <Megaphone className="w-6 h-6" />,
    description: 'Gestion de comptes, création de contenu et stratégie réseaux sociaux.',
  },
  {
    value: 'graphiste',
    label: 'Graphiste / Designer',
    icon: <Palette className="w-6 h-6" />,
    description: 'Visuels réseaux sociaux, supports publicitaires et identité visuelle.',
  },
  {
    value: 'photographe',
    label: 'Photographe',
    icon: <Camera className="w-6 h-6" />,
    description: 'Shootings professionnels et packs visuels pour nos clients.',
  },
];

const advantages = [
  'Missions rémunérées et concrètes',
  'Flexibilité et autonomie',
  'Projets variés avec des professionnels',
  'Réseau en croissance partout en France',
];

export default function RecrutementPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    profile: '' as ProfileType | '',
    portfolio: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch('/api/recrutement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setStatus('sent');
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Une erreur est survenue. Réessayez ou contactez-nous à contact@opatam.com'
      );
      setStatus('error');
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-blue-50">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-100/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-blue-100/40 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-medium text-indigo-700 mb-6">
              <Users className="w-4 h-4" />
              Recrutement
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
              Rejoignez l&apos;équipe{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                Opatam
              </span>
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Vous êtes freelance, créatif ou expert du digital ? Collaborez avec nous sur des
              missions concrètes et rémunérées, partout en France.
            </p>
          </div>
        </section>

        {/* Profiles */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Profils recherchés
            </h2>
            <p className="mt-3 text-gray-600 max-w-xl mx-auto">
              Nous collaborons avec des talents dans ces domaines pour accompagner notre croissance
              et celle de nos clients.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {profiles.map((p) => (
              <div
                key={p.value}
                className="rounded-2xl border border-gray-200 bg-white p-6 hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4">
                  {p.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{p.label}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Advantages + Form */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Left: Why join */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Pourquoi nous rejoindre</h2>
                <div className="space-y-4">
                  {advantages.map((adv) => (
                    <div key={adv} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-gray-700">{adv}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tarification</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Les tarifs sont définis en fonction du type de mission, de sa durée et du niveau
                  d&apos;expertise requis. Chaque collaboration fait l&apos;objet d&apos;un accord clair avant
                  le début de la mission.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-indigo-600">
                  <ArrowRight className="w-4 h-4" />
                  Missions ponctuelles ou régulières
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6">
                <p className="text-sm text-indigo-800 leading-relaxed">
                  Nous recherchons des profils sérieux, autonomes et professionnels, capables de
                  représenter l&apos;image d&apos;Opatam auprès de nos clients et partenaires.
                </p>
              </div>
            </div>

            {/* Right: Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Postuler</h2>

                {status === 'sent' ? (
                  <div className="text-center py-12">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                      <Send className="w-7 h-7 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Candidature envoyée !
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Merci pour votre intérêt. Nous examinerons votre profil et reviendrons vers
                      vous si votre candidature correspond à nos besoins.
                    </p>
                    <button
                      onClick={() => {
                        setStatus('idle');
                        setFormData({
                          firstName: '',
                          lastName: '',
                          email: '',
                          phone: '',
                          city: '',
                          profile: '',
                          portfolio: '',
                          message: '',
                        });
                      }}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Envoyer une autre candidature
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="lastName"
                          className="block text-sm font-medium text-gray-700 mb-1.5"
                        >
                          Nom
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          required
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                          placeholder="Votre nom"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="firstName"
                          className="block text-sm font-medium text-gray-700 mb-1.5"
                        >
                          Prénom
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          required
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                          placeholder="Votre prénom"
                        />
                      </div>
                    </div>

                    {/* Email & Phone */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="email"
                          className="block text-sm font-medium text-gray-700 mb-1.5"
                        >
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
                      <div>
                        <label
                          htmlFor="phone"
                          className="block text-sm font-medium text-gray-700 mb-1.5"
                        >
                          Téléphone
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                          placeholder="06 12 34 56 78"
                        />
                      </div>
                    </div>

                    {/* City */}
                    <div>
                      <label
                        htmlFor="city"
                        className="block text-sm font-medium text-gray-700 mb-1.5"
                      >
                        Ville
                      </label>
                      <input
                        type="text"
                        id="city"
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                        placeholder="Votre ville"
                      />
                    </div>

                    {/* Profile type */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Type de profil
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {profiles.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, profile: p.value })}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                              formData.profile === p.value
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Portfolio */}
                    <div>
                      <label
                        htmlFor="portfolio"
                        className="block text-sm font-medium text-gray-700 mb-1.5"
                      >
                        Portfolio / Instagram / Site{' '}
                        <span className="text-gray-400 font-normal">(optionnel)</span>
                      </label>
                      <input
                        type="url"
                        id="portfolio"
                        value={formData.portfolio}
                        onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                        placeholder="https://votre-portfolio.com"
                      />
                    </div>

                    {/* Message */}
                    <div>
                      <label
                        htmlFor="message"
                        className="block text-sm font-medium text-gray-700 mb-1.5"
                      >
                        Présentez-vous en quelques mots
                      </label>
                      <textarea
                        id="message"
                        required
                        rows={4}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all resize-none"
                        placeholder="Votre expérience, vos disponibilités, ce qui vous motive..."
                      />
                    </div>

                    {/* Error */}
                    {status === 'error' && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                      </div>
                    )}

                    {/* Submit */}
                    <button
                      type="submit"
                      disabled={status === 'sending' || !formData.profile}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {status === 'sending' ? 'Envoi...' : 'Envoyer ma candidature'}
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
