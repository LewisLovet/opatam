'use client';

import Link from 'next/link';
import {
  Zap,
  CreditCard,
  Sprout,
  Mail,
  Handshake,
  ArrowRight,
  Sparkles,
  Eye,
} from 'lucide-react';

const tools = [
  {
    title: 'Cloud Functions',
    description: 'Tester les Cloud Functions : notifications, calcul nextAvailableSlot, bookings.',
    icon: <Zap className="w-6 h-6" />,
    color: 'bg-teal-500',
    href: '/dev/tools/functions',
  },
  {
    title: 'Emails',
    description: 'Prévisualiser les templates d\'emails et envoyer des emails de test.',
    icon: <Mail className="w-6 h-6" />,
    color: 'bg-pink-500',
    href: '/dev/tools/emails',
  },
  {
    title: 'Données de test',
    description: 'Générer et supprimer des providers de test avec toutes leurs données.',
    icon: <Sprout className="w-6 h-6" />,
    color: 'bg-lime-600',
    href: '/dev/tools/seed',
  },
  {
    title: 'Stripe Connect — Affiliés',
    description: 'Créer des comptes Connect, simuler des paiements et remboursements avec commissions.',
    icon: <Handshake className="w-6 h-6" />,
    color: 'bg-indigo-500',
    href: '/dev/tools/affiliates',
  },
  {
    title: 'Stripe Checkout',
    description: 'Tester le checkout, les webhooks et le portail client Stripe.',
    icon: <CreditCard className="w-6 h-6" />,
    color: 'bg-violet-500',
    href: '/dev/tests/stripe',
  },
  {
    title: 'RevenueCat',
    description: 'Monitorer les webhooks RevenueCat et simuler des événements IAP.',
    icon: <Eye className="w-6 h-6" />,
    color: 'bg-amber-500',
    href: '/dev/tests/revenuecat',
  },
];

export default function DevHubPage() {
  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-purple-400/80">Developer Tools</span>
          </div>
          <h1 className="text-4xl font-bold text-white">Dev Hub</h1>
          <p className="text-slate-400 mt-2">
            Outils de développement et pages de test — Opatam
          </p>
        </div>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group relative rounded-xl bg-slate-900 border border-slate-800 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-slate-700 hover:shadow-xl hover:shadow-black/20"
            >
              <div className={`inline-flex p-3 ${tool.color} rounded-xl text-white mb-4 shadow-lg transition-transform duration-200 group-hover:scale-110`}>
                {tool.icon}
              </div>
              <h3 className="text-base font-semibold text-white mb-1">{tool.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-3">{tool.description}</p>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-white transition-colors">
                Ouvrir <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
