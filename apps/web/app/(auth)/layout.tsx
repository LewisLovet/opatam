'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  BadgePercent,
  ShieldCheck,
  MapPin,
  Scissors,
  CalendarCheck,
  Rocket,
  Gift,
  Sparkles,
} from 'lucide-react';
import { LogoWhite } from '@/components/ui';

// Step-based content for register wizard
const REGISTER_STEP_CONTENT = [
  {
    // Step 1 - Business
    title: 'Gerez vos reservations en toute simplicite',
    benefits: [
      {
        icon: Calendar,
        title: 'Agenda en ligne',
        description: 'Accessible 24h/24, 7j/7',
      },
      {
        icon: Clock,
        title: 'Rappels automatiques',
        description: 'Reduisez les no-shows',
      },
      {
        icon: BadgePercent,
        title: 'Sans commission',
        description: '100% de vos revenus',
      },
    ],
  },
  {
    // Step 2 - Location
    title: 'Vos clients vous trouvent facilement',
    benefits: [
      {
        icon: MapPin,
        title: 'Visibilite locale',
        description: 'Apparaissez dans les recherches',
      },
      {
        icon: Calendar,
        title: 'Page personnalisee',
        description: 'Votre vitrine en ligne',
      },
      {
        icon: Sparkles,
        title: 'Profil professionnel',
        description: 'Inspirez confiance',
      },
    ],
  },
  {
    // Step 3 - Service
    title: 'Presentez vos services',
    benefits: [
      {
        icon: Scissors,
        title: 'Catalogue complet',
        description: 'Toutes vos prestations',
      },
      {
        icon: Clock,
        title: 'Durees flexibles',
        description: 'Adaptees a vos besoins',
      },
      {
        icon: BadgePercent,
        title: 'Tarifs clairs',
        description: 'Transparence totale',
      },
    ],
  },
  {
    // Step 4 - Availability
    title: 'Gardez le controle de votre agenda',
    benefits: [
      {
        icon: CalendarCheck,
        title: 'Horaires flexibles',
        description: 'Vous decidez quand',
      },
      {
        icon: Clock,
        title: 'Mise a jour instantanee',
        description: 'Modifiez a tout moment',
      },
      {
        icon: Sparkles,
        title: 'Zero conflit',
        description: 'Fini les doubles reservations',
      },
    ],
  },
  {
    // Step 5 - Preview
    title: 'Pret a vous lancer ?',
    benefits: [
      {
        icon: Rocket,
        title: 'Demarrage rapide',
        description: 'En ligne en 2 minutes',
      },
      {
        icon: Sparkles,
        title: 'Modifiable a tout moment',
        description: 'Evoluez avec votre activite',
      },
      {
        icon: BadgePercent,
        title: 'Sans engagement',
        description: 'Annulez quand vous voulez',
      },
    ],
  },
  {
    // Step 6 - Account
    title: "Plus qu'une etape !",
    benefits: [
      {
        icon: Gift,
        title: '7 jours offerts',
        description: "Testez sans limite",
      },
      {
        icon: ShieldCheck,
        title: 'Donnees securisees',
        description: 'Protection maximale',
      },
      {
        icon: Rocket,
        title: 'Support reactif',
        description: 'On vous accompagne',
      },
    ],
  },
];

// Default benefits for login/forgot-password
const DEFAULT_BENEFITS = [
  {
    icon: Calendar,
    title: 'Agenda en ligne',
    description: 'Accessible 24h/24, 7j/7',
  },
  {
    icon: Clock,
    title: 'Rappels automatiques',
    description: 'Reduisez les no-shows',
  },
  {
    icon: BadgePercent,
    title: 'Sans commission',
    description: '100% de vos revenus',
  },
];

interface InfoPanelProps {
  isRight: boolean;
  registerStep?: number;
}

function InfoPanel({ isRight, registerStep }: InfoPanelProps) {
  const isRegisterWizard = registerStep !== undefined && registerStep > 0;
  const stepContent = isRegisterWizard
    ? REGISTER_STEP_CONTENT[registerStep - 1] || REGISTER_STEP_CONTENT[0]
    : null;

  const title = stepContent?.title || 'Gerez vos reservations en toute simplicite';
  const benefits = stepContent?.benefits || DEFAULT_BENEFITS;

  return (
    <div
      className={`hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-600 dark:to-primary-800 text-white p-10 xl:p-12 relative overflow-hidden ${
        isRight ? 'order-2' : 'order-1'
      }`}
    >
      {/* Decorative bubbles */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Large blurred circles */}
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary-400/20 blur-3xl" />
        <div className="absolute top-1/3 -right-16 w-48 h-48 rounded-full bg-white/5 blur-2xl" />

        {/* Medium circles */}
        <div className="absolute top-20 right-20 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute bottom-40 left-10 w-16 h-16 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-1/4 w-12 h-12 rounded-full bg-primary-300/20" />

        {/* Small sharp circles */}
        <div className="absolute top-32 left-1/3 w-6 h-6 rounded-full bg-white/15" />
        <div className="absolute bottom-1/4 right-16 w-8 h-8 rounded-full bg-white/10" />
        <div className="absolute top-2/3 left-20 w-4 h-4 rounded-full bg-white/20" />
        <div className="absolute bottom-20 right-1/3 w-5 h-5 rounded-full bg-primary-200/15" />
      </div>

      {/* Logo */}
      <div className="relative z-10">
        <Link href="/">
          <LogoWhite size="lg" variant="light" subtitle="Espace Professionnel" />
        </Link>
      </div>

      {/* Main content with transition */}
      <div className="my-auto relative z-10">
        <h1
          key={title}
          className="text-3xl xl:text-4xl font-bold leading-tight mb-8 transition-all duration-300"
        >
          {title}
        </h1>

        <div className="space-y-6">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={`${benefit.title}-${index}`}
                className="flex items-start gap-4 transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{benefit.title}</h3>
                  <p className="text-primary-100">{benefit.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Security notice - styled box */}
      <div className="relative z-10">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-sm text-primary-50">
            Connexion securisee - Vos donnees sont protegees
          </span>
        </div>
      </div>
    </div>
  );
}

function MobileHeader() {
  return (
    <div className="lg:hidden flex items-center justify-center py-6 bg-gradient-to-r from-primary-600 to-primary-700 dark:from-primary-700 dark:to-primary-800">
      <Link href="/">
        <LogoWhite size="lg" variant="light" subtitle="Espace Professionnel" />
      </Link>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRegister = pathname === '/register';
  const [registerStep, setRegisterStep] = useState(1);

  // Listen for step changes from register page
  useEffect(() => {
    if (!isRegister) return;

    // Get initial step from sessionStorage
    const savedStep = sessionStorage.getItem('register-step');
    if (savedStep) {
      setRegisterStep(parseInt(savedStep));
    }

    // Listen for step change events
    const handleStepChange = (event: CustomEvent<number>) => {
      setRegisterStep(event.detail);
    };

    window.addEventListener('register-step-change', handleStepChange as EventListener);
    return () => {
      window.removeEventListener('register-step-change', handleStepChange as EventListener);
    };
  }, [isRegister]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile header */}
      <MobileHeader />

      {/* Split screen container */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2">
        {/* Info Panel - position depends on route */}
        <InfoPanel isRight={isRegister} registerStep={isRegister ? registerStep : undefined} />

        {/* Form Panel */}
        <div
          className={`flex-1 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-10 xl:px-16 bg-gray-50 dark:bg-gray-900 ${
            isRegister ? 'order-1' : 'order-2'
          }`}
        >
          <div
            className={`w-full mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700 overflow-visible ${
              isRegister ? 'max-w-lg' : 'max-w-md'
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
