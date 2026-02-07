'use client';

import Link from 'next/link';
import {
  Package,
  Blocks,
  Flame,
  Database,
  Settings,
  CreditCard,
  Zap,
  Sprout,
  Activity,
  Layers,
  TestTubes,
  Wrench,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface SectionCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  links: { href: string; label: string }[];
}

const sections: { heading: string; headingIcon: React.ReactNode; headingColor: string; accentColor: string; cards: SectionCard[] }[] = [
  {
    heading: 'Composants',
    headingIcon: <Layers className="w-4 h-4" />,
    headingColor: 'text-blue-400',
    accentColor: 'from-blue-500 to-cyan-500',
    cards: [
      {
        title: 'UI Components',
        description: 'Showcase des composants UI de base (Button, Input, Card, Modal...)',
        icon: <Package className="w-6 h-6" />,
        color: 'bg-blue-500',
        gradientFrom: 'from-blue-500/20',
        gradientTo: 'to-cyan-500/5',
        links: [{ href: '/dev/components', label: 'Voir les composants' }],
      },
      {
        title: 'Composants Metier',
        description: 'Header, SearchBar, ProviderCard, SlotPicker, etc.',
        icon: <Blocks className="w-6 h-6" />,
        color: 'bg-emerald-500',
        gradientFrom: 'from-emerald-500/20',
        gradientTo: 'to-teal-500/5',
        links: [{ href: '/dev/components-metier', label: 'Voir les composants' }],
      },
    ],
  },
  {
    heading: 'Tests',
    headingIcon: <TestTubes className="w-4 h-4" />,
    headingColor: 'text-orange-400',
    accentColor: 'from-orange-500 to-amber-500',
    cards: [
      {
        title: 'Firebase Connection',
        description: 'Test de la connexion Firebase et configuration',
        icon: <Flame className="w-6 h-6" />,
        color: 'bg-amber-500',
        gradientFrom: 'from-amber-500/20',
        gradientTo: 'to-orange-500/5',
        links: [{ href: '/dev/tests/firebase-connection', label: 'Tester' }],
      },
      {
        title: 'Repositories',
        description: 'CRUD Firestore collections (Users, Providers, Members, Locations...)',
        icon: <Database className="w-6 h-6" />,
        color: 'bg-orange-500',
        gradientFrom: 'from-orange-500/20',
        gradientTo: 'to-red-500/5',
        links: [
          { href: '/dev/tests', label: 'Vue d\'ensemble' },
          { href: '/dev/tests/users', label: 'Users' },
          { href: '/dev/tests/providers', label: 'Providers' },
          { href: '/dev/tests/prestations', label: 'Prestations' },
          { href: '/dev/tests/availability', label: 'Availability' },
          { href: '/dev/tests/bookings', label: 'Bookings' },
        ],
      },
      {
        title: 'Services',
        description: 'Logique metier & workflows (Auth, Booking, Scheduling...)',
        icon: <Settings className="w-6 h-6" />,
        color: 'bg-purple-500',
        gradientFrom: 'from-purple-500/20',
        gradientTo: 'to-pink-500/5',
        links: [
          { href: '/dev/tests/services', label: 'Vue d\'ensemble' },
          { href: '/dev/tests/services/auth', label: 'Auth' },
          { href: '/dev/tests/services/provider', label: 'Provider' },
          { href: '/dev/tests/services/members', label: 'Members' },
          { href: '/dev/tests/services/catalog', label: 'Catalog' },
          { href: '/dev/tests/services/scheduling', label: 'Scheduling' },
          { href: '/dev/tests/services/bookings', label: 'Bookings' },
        ],
      },
      {
        title: 'Stripe',
        description: 'Checkout, Customer Portal, Webhooks et plans d\'abonnement',
        icon: <CreditCard className="w-6 h-6" />,
        color: 'bg-indigo-500',
        gradientFrom: 'from-indigo-500/20',
        gradientTo: 'to-violet-500/5',
        links: [{ href: '/dev/tests/stripe', label: 'Tester Stripe' }],
      },
    ],
  },
  {
    heading: 'Outils',
    headingIcon: <Wrench className="w-4 h-4" />,
    headingColor: 'text-teal-400',
    accentColor: 'from-teal-500 to-emerald-500',
    cards: [
      {
        title: 'Cloud Functions',
        description: 'Tester les Cloud Functions Firebase : connexion, calcul nextAvailableSlot, notifications, bookings.',
        icon: <Zap className="w-6 h-6" />,
        color: 'bg-teal-500',
        gradientFrom: 'from-teal-500/20',
        gradientTo: 'to-emerald-500/5',
        links: [{ href: '/dev/tools/functions', label: 'Ouvrir' }],
      },
      {
        title: 'Donnees de test',
        description: 'Generer et supprimer des providers de test avec toutes leurs donnees (services, membres, locations).',
        icon: <Sprout className="w-6 h-6" />,
        color: 'bg-lime-600',
        gradientFrom: 'from-lime-500/20',
        gradientTo: 'to-green-500/5',
        links: [{ href: '/dev/tools/seed', label: 'Ouvrir' }],
      },
    ],
  },
];

// Quick stats data
const quickStats = [
  { label: 'Composants', value: '2', icon: <Layers className="w-4 h-4" />, color: 'text-blue-400' },
  { label: 'Tests', value: '4', icon: <TestTubes className="w-4 h-4" />, color: 'text-orange-400' },
  { label: 'Outils', value: '2', icon: <Wrench className="w-4 h-4" />, color: 'text-teal-400' },
  { label: 'Sections', value: '8', icon: <Activity className="w-4 h-4" />, color: 'text-purple-400' },
];

export default function DevHubPage() {
  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="relative mb-10 overflow-hidden">
          {/* Decorative background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 rounded-2xl" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

          <div className="relative py-8 px-1">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span className="text-sm font-medium text-purple-400/80">Developer Tools</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Dev Hub
            </h1>
            <p className="text-slate-400 mt-3 text-lg max-w-xl">
              Outils de developpement et pages de test pour le booking-app Opatam
            </p>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
              {quickStats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/60 border border-slate-800/50 backdrop-blur-sm"
                >
                  <div className={`${stat.color}`}>
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{stat.value}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section) => (
            <div key={section.heading}>
              <div className="flex items-center gap-3 mb-5">
                <div className={`p-1.5 rounded-md bg-gradient-to-r ${section.accentColor} bg-opacity-20`}>
                  <span className={section.headingColor}>{section.headingIcon}</span>
                </div>
                <h2 className={`text-sm font-bold uppercase tracking-wider ${section.headingColor}`}>
                  {section.heading}
                </h2>
                <div className={`flex-1 h-px bg-gradient-to-r ${section.accentColor} opacity-20`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.cards.map((card) => (
                  <div
                    key={card.title}
                    className="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20"
                  >
                    {/* Gradient border effect */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/30 p-px">
                      <div className="absolute inset-px rounded-[11px] bg-slate-900" />
                    </div>

                    {/* Hover glow */}
                    <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${card.gradientFrom} ${card.gradientTo} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                    <div className="relative p-5">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 ${card.color} rounded-xl text-white flex-shrink-0 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                          {card.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-white group-hover:text-white transition-colors">
                            {card.title}
                          </h3>
                          <p className="text-sm text-slate-400 mt-1 mb-4 leading-relaxed">
                            {card.description}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {card.links.map((link, idx) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                className={`
                                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                                  ${idx === 0
                                    ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10 hover:border-white/20'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent hover:border-slate-700/50'
                                  }
                                `}
                              >
                                {link.label}
                                {idx === 0 && <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5" />}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mt-12 relative overflow-hidden rounded-xl border border-slate-800/50">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-pink-500/5" />
          <div className="relative p-5 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 flex-shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300 mb-1">Tip</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Utilisez la sidebar a gauche pour naviguer entre les differentes sections.
                Ces pages sont uniquement accessibles en environnement de developpement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
