'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SearchBar } from '@/components/search/SearchBar';
import { ProviderCard } from '@/components/provider/ProviderCard';
import { AppStoreBadges } from '@/components/common/AppStoreBadges';
import { ThemeColorPicker } from '@/components/common/ThemeColorPicker';
import {
  Scissors,
  Sparkles,
  Heart,
  Leaf,
  Dumbbell,
  Wrench,
  Search,
  CalendarCheck,
  Bell,
  Calendar,
  Clock,
  BadgePercent,
} from 'lucide-react';

// Categories data - all use primary color
const categories = [
  { id: 'coiffure', label: 'Coiffure', icon: Scissors },
  { id: 'beaute', label: 'Beaute', icon: Sparkles },
  { id: 'sante', label: 'Sante', icon: Heart },
  { id: 'bien-etre', label: 'Bien-etre', icon: Leaf },
  { id: 'sport', label: 'Sport', icon: Dumbbell },
  { id: 'services', label: 'Services', icon: Wrench },
];

// How it works steps
const steps = [
  {
    icon: Search,
    title: 'Recherchez',
    description: 'Trouvez un professionnel par metier ou lieu pres de chez vous.',
  },
  {
    icon: CalendarCheck,
    title: 'Reservez',
    description: 'Choisissez votre creneau en temps reel, 24h/24.',
  },
  {
    icon: Bell,
    title: 'Profitez',
    description: 'Recevez confirmation et rappels automatiques.',
  },
];

// Pro benefits
const proBenefits = [
  {
    icon: Calendar,
    title: 'Agenda en ligne 24/7',
    description: 'Vos clients reservent a tout moment, meme quand vous travaillez.',
  },
  {
    icon: Clock,
    title: 'Rappels automatiques',
    description: 'Reduisez les no-shows avec des SMS et emails de rappel.',
  },
  {
    icon: BadgePercent,
    title: '0 commission',
    description: 'Aucune commission sur les reservations. Prix fixe mensuel.',
  },
];

// Mock providers data
const featuredProviders = [
  {
    id: '1',
    businessName: 'Salon Elegance',
    photoURL: null,
    category: 'Coiffure',
    description: 'Salon de coiffure haut de gamme au coeur de Paris.',
    isVerified: true,
    city: 'Paris',
    rating: 4.8,
    reviewCount: 124,
    minPrice: 25,
  },
  {
    id: '2',
    businessName: 'Spa Serenite',
    photoURL: null,
    category: 'Bien-etre',
    description: 'Massages et soins relaxants dans un cadre zen.',
    isVerified: true,
    city: 'Lyon',
    rating: 4.9,
    reviewCount: 89,
    minPrice: 45,
  },
  {
    id: '3',
    businessName: 'Institut Beaute Plus',
    photoURL: null,
    category: 'Beaute',
    description: 'Soins du visage et manucure professionnels.',
    isVerified: false,
    city: 'Marseille',
    rating: 4.7,
    reviewCount: 256,
    minPrice: 15,
  },
  {
    id: '4',
    businessName: 'Barber Studio',
    photoURL: null,
    category: 'Coiffure',
    description: 'Le barbier moderne pour homme exigeant.',
    isVerified: true,
    city: 'Bordeaux',
    rating: 4.8,
    reviewCount: 67,
    minPrice: 20,
  },
];

export default function LandingPage() {
  const handleSearch = (query: string, location: string) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (location) params.set('location', location);
    window.location.href = `/search?${params.toString()}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 overflow-x-hidden">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-900 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
                Reservez vos rendez-vous en quelques clics
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400">
                Trouvez et reservez facilement chez les meilleurs professionnels pres de chez vous
              </p>

              {/* Search Bar */}
              <div className="mt-10 max-w-3xl mx-auto">
                <SearchBar onSearch={handleSearch} />
              </div>
            </div>
          </div>

          {/* Decorative gradient blur */}
          <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
            <div
              className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary-200 to-primary-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
              style={{
                clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
            />
          </div>
        </section>

        {/* Categories Section */}
        <section className="py-16 sm:py-20 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Categories populaires
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Trouvez rapidement ce que vous cherchez
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <Link
                    key={category.id}
                    href={`/search?category=${category.id}`}
                    className="group flex flex-col items-center p-6 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {category.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Comment ca marche
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Reservez en 3 etapes simples
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative text-center">
                    {/* Connector line for desktop */}
                    {index < steps.length - 1 && (
                      <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gray-200 dark:bg-gray-700" />
                    )}

                    <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-6">
                      <Icon className="w-10 h-10" />
                      <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xs mx-auto">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Featured Providers Section */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Professionnels populaires
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Decouvrez les prestataires les mieux notes
                </p>
              </div>
              <Link
                href="/search"
                className="hidden sm:inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
              >
                Voir tous
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {featuredProviders.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>

            {/* Mobile view all link */}
            <div className="mt-8 sm:hidden text-center">
              <Link
                href="/search"
                className="inline-flex items-center gap-1 px-6 py-3 text-sm font-medium border-2 border-primary-600 text-primary-600 hover:bg-primary-50 dark:border-primary-400 dark:text-primary-400 dark:hover:bg-primary-950 rounded-lg transition-colors"
              >
                Voir tous les professionnels
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* Professionals CTA Section */}
        <section id="professionals" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
              {/* Content */}
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                  Vous etes professionnel ?
                </h2>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                  Gerez vos reservations, fidelisez vos clients, developpez votre activite
                </p>

                {/* Benefits */}
                <div className="mt-10 space-y-6">
                  {proBenefits.map((benefit) => {
                    const Icon = benefit.icon;
                    return (
                      <div key={benefit.title} className="flex gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {benefit.title}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CTA Button */}
                <div className="mt-10">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-6 py-3 text-base font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
                  >
                    Essai gratuit 7 jours
                  </Link>
                </div>
              </div>

              {/* Image placeholder */}
              <div className="hidden lg:block">
                <div className="relative aspect-square max-w-md mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 rounded-3xl" />
                  <div className="absolute inset-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center">
                    <div className="text-center text-gray-400 dark:text-gray-500">
                      <Calendar className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-sm">Dashboard Pro Preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile App Section */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
              {/* Phone mockup placeholder */}
              <div className="hidden lg:block order-2">
                <div className="relative max-w-xs mx-auto">
                  {/* Phone frame */}
                  <div className="relative w-64 h-[520px] mx-auto bg-gray-900 rounded-[3rem] shadow-2xl border-4 border-gray-800">
                    {/* Screen */}
                    <div className="absolute inset-4 bg-gradient-to-b from-primary-500 to-primary-600 rounded-[2rem] flex items-center justify-center">
                      <div className="text-center text-white/80">
                        <CalendarCheck className="w-16 h-16 mx-auto mb-4 text-white" />
                        <p className="text-sm font-medium">App Preview</p>
                      </div>
                    </div>
                    {/* Notch */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-full" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="lg:order-1">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                  Opatam dans votre poche
                </h2>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                  Gerez vos rendez-vous ou que vous soyez. Disponible sur iOS et Android.
                </p>

                {/* App Store Badges */}
                <div className="mt-8">
                  <AppStoreBadges size="md" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Color theme picker FAB */}
      <ThemeColorPicker />
    </div>
  );
}
