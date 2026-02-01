'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AppStoreBadges } from '@/components/common/AppStoreBadges';
import { useAuth } from '@/contexts/AuthContext';
import {
  Smartphone,
  CalendarCheck,
  Bell,
  MapPin,
  Clock,
  Star,
  CheckCircle2,
} from 'lucide-react';

// App features
const features = [
  {
    icon: CalendarCheck,
    title: 'Réservation facile',
    description: 'Réservez vos rendez-vous en quelques clics, 24h/24.',
  },
  {
    icon: Bell,
    title: 'Rappels automatiques',
    description: "Recevez des notifications pour ne jamais oublier un RDV.",
  },
  {
    icon: MapPin,
    title: 'Géolocalisation',
    description: 'Trouvez les professionnels proches de vous.',
  },
  {
    icon: Clock,
    title: 'Disponibilités en temps réel',
    description: 'Voyez les créneaux disponibles instantanément.',
  },
  {
    icon: Star,
    title: 'Avis vérifiés',
    description: 'Consultez les avis des autres clients.',
  },
  {
    icon: CheckCircle2,
    title: 'Historique complet',
    description: 'Retrouvez tous vos rendez-vous passés et à venir.',
  },
];

export default function DownloadAppPage() {
  const { user, isAuthenticated } = useAuth();

  // Get first name from display name
  const firstName = user?.displayName?.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-900 pt-16 pb-24 sm:pt-24 sm:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
              {/* Content */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                  <Smartphone className="w-4 h-4" />
                  Application mobile
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {isAuthenticated && firstName
                    ? `${firstName}, téléchargez l'application Opatam`
                    : "Téléchargez l'application Opatam"}
                </h1>

                <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400">
                  {isAuthenticated
                    ? "L'interface web est réservée aux professionnels. Pour réserver vos rendez-vous, téléchargez notre application mobile gratuite."
                    : "Pour réserver vos rendez-vous en toute simplicité, téléchargez notre application mobile gratuite."}
                </p>

                {/* App Store Badges */}
                <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <AppStoreBadges size="lg" />
                </div>

                {/* Trust indicators */}
                <div className="mt-8 flex items-center gap-6 justify-center lg:justify-start text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>Gratuit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span>iOS & Android</span>
                  </div>
                </div>
              </div>

              {/* Phone mockup */}
              <div className="hidden lg:block">
                <div className="relative max-w-xs mx-auto">
                  {/* Phone frame */}
                  <div className="relative w-72 h-[580px] mx-auto bg-gray-900 rounded-[3rem] shadow-2xl border-4 border-gray-800">
                    {/* Screen */}
                    <div className="absolute inset-4 bg-gradient-to-b from-primary-500 to-primary-600 rounded-[2.5rem] flex items-center justify-center overflow-hidden">
                      <div className="text-center text-white/90 p-6">
                        <CalendarCheck className="w-20 h-20 mx-auto mb-6 text-white" />
                        <p className="text-xl font-semibold mb-2">Opatam</p>
                        <p className="text-sm text-white/70">Vos rendez-vous simplifiés</p>
                      </div>
                    </div>
                    {/* Notch */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-gray-900 rounded-full" />
                  </div>

                  {/* Decorative elements */}
                  <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary-200 dark:bg-primary-800/50 rounded-full blur-2xl opacity-60" />
                  <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary-300 dark:bg-primary-700/50 rounded-full blur-2xl opacity-40" />
                </div>
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

        {/* Features Section */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Tout ce dont vous avez besoin
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-400">
                Une application pensée pour simplifier votre quotidien
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Info Banner for Professionals */}
        <section className="py-12 bg-primary-50 dark:bg-gray-800">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Vous êtes professionnel ?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              L'interface web est conçue spécialement pour gérer votre activité depuis un ordinateur.
            </p>
            <a
              href="/pro"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
            >
              Accéder à l'espace Pro
            </a>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Prêt à simplifier vos réservations ?
            </h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              Téléchargez l'application gratuitement et commencez dès maintenant.
            </p>
            <div className="mt-8 flex justify-center">
              <AppStoreBadges size="lg" />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
