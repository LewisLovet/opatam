'use client';

import { Modal, ModalBody } from '@/components/ui/Modal';
import {
  Users,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
  X,
  Check,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

interface UpgradeTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'members' | 'locations';
}

const CONTEXT_CONFIG = {
  members: {
    title: 'Développez votre équipe',
    subtitle: 'Coordonnez plusieurs professionnels et boostez votre activité.',
    currentLimit: '1 membre',
    upgradeLimit: 'jusqu\'à 5 membres',
  },
  locations: {
    title: 'Ouvrez de nouveaux lieux',
    subtitle: 'Gérez plusieurs adresses et touchez plus de clients.',
    currentLimit: '1 lieu',
    upgradeLimit: 'jusqu\'à 5 lieux',
  },
};

const STUDIO_HIGHLIGHTS = [
  {
    icon: Users,
    title: 'Agendas synchronisés',
    description: 'Jusqu\'à 5 professionnels avec planning coordonné',
  },
  {
    icon: MapPin,
    title: 'Multi-lieux',
    description: 'Gérez jusqu\'à 5 adresses différentes',
  },
  {
    icon: Calendar,
    title: 'Prestations par membre',
    description: 'Assignez les services à chaque professionnel',
  },
  {
    icon: Sparkles,
    title: 'Page d\'équipe',
    description: 'Vitrine professionnelle avec tous vos membres',
  },
];

export function UpgradeTeamModal({ isOpen, onClose, context }: UpgradeTeamModalProps) {
  const router = useRouter();
  const config = CONTEXT_CONFIG[context];
  const teamPlan = SUBSCRIPTION_PLANS.team;
  const monthlyPrice = (teamPlan.baseMonthlyPrice / 100).toFixed(2).replace('.', ',');

  const handleUpgrade = () => {
    onClose();
    router.push('/pro/parametres?tab=abonnement');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalBody className="p-0">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with gradient accent line */}
        <div className="pt-6 px-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
              <Zap className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
              Plan Studio
            </span>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            {config.title}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {config.subtitle}
          </p>
        </div>

        {/* Features grid */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {STUDIO_HIGHLIGHTS.map((feature) => (
              <div
                key={feature.title}
                className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
              >
                <feature.icon className="h-5 w-5 text-violet-600 dark:text-violet-400 mb-2" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                  {feature.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison strip */}
        <div className="mx-6 mb-4 rounded-xl overflow-hidden border border-violet-200 dark:border-violet-800">
          <div className="flex">
            <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-800 text-center border-r border-violet-200 dark:border-violet-800">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Actuellement</p>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{config.currentLimit}</p>
            </div>
            <div className="flex-1 p-3 bg-violet-50 dark:bg-violet-900/20 text-center">
              <p className="text-xs text-violet-600 dark:text-violet-400 mb-0.5">Avec Studio</p>
              <p className="text-sm font-bold text-violet-700 dark:text-violet-300">{config.upgradeLimit}</p>
            </div>
          </div>
        </div>

        {/* Price + CTA */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900 dark:text-white">{monthlyPrice}€</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/mois</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              Tout le plan Pro inclus
            </div>
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all duration-200"
          >
            Voir les plans
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={onClose}
            className="w-full mt-2 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Plus tard
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
