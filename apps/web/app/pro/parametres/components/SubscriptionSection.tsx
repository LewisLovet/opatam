'use client';

import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui';
import { CreditCard, Sparkles, Check, Clock } from 'lucide-react';

export function SubscriptionSection() {
  const { provider } = useAuth();

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case 'trial':
        return 'Essai gratuit';
      case 'solo':
        return 'Solo';
      case 'team':
        return 'Equipe';
      default:
        return plan;
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'trial':
        return 'warning' as const;
      case 'solo':
        return 'info' as const;
      case 'team':
        return 'success' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="p-6 bg-gradient-to-br from-primary-500/10 to-primary-600/5 dark:from-primary-500/20 dark:to-primary-600/10 rounded-xl border border-primary-200 dark:border-primary-800">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Votre abonnement actuel
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {getPlanLabel(provider?.plan || 'trial')}
            </h3>
          </div>
          <Badge variant={getPlanBadgeVariant(provider?.plan || 'trial')}>
            {provider?.plan === 'trial' ? 'Actif' : 'Premium'}
          </Badge>
        </div>

        {provider?.subscription?.validUntil && (
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>
              Valide jusqu'au{' '}
              {new Intl.DateTimeFormat('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(provider.subscription.validUntil)}
            </span>
          </div>
        )}
      </div>

      {/* Coming Soon Notice */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Gestion des abonnements
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            La gestion des abonnements et des paiements sera bientot disponible.
          </p>
          <Badge variant="info">Bientot disponible</Badge>
        </div>
      </div>

      {/* Features Preview */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 dark:text-white">
          Fonctionnalites a venir
        </h4>
        <ul className="space-y-3">
          {[
            'Mise a niveau vers un plan superieur',
            'Gestion des moyens de paiement',
            'Historique des factures',
            'Telechargement des factures PDF',
            'Annulation et remboursement',
          ].map((feature, index) => (
            <li
              key={index}
              className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"
            >
              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </div>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
