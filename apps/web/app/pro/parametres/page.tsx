'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Calendar,
  User,
  CreditCard,
  QrCode,
  Settings,
  Bell,
} from 'lucide-react';
import {
  ReservationSettingsForm,
  NotificationsForm,
  AccountForm,
  SubscriptionSection,
  ShareSection,
  SubscriptionSuccessModal,
} from './components';
import { useAuth } from '@/contexts/AuthContext';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

const tabs = [
  {
    id: 'reservation',
    label: 'Réservations',
    description: 'Règles de prise de rendez-vous',
    icon: Calendar,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Push, emails, rappels',
    icon: Bell,
  },
  {
    id: 'compte',
    label: 'Compte',
    description: 'Email, mot de passe, suppression',
    icon: User,
  },
  {
    id: 'abonnement',
    label: 'Abonnement',
    description: 'Plan, facturation, portail',
    icon: CreditCard,
  },
  {
    id: 'partage',
    label: 'Partage',
    description: 'QR code, liens, partage',
    icon: QrCode,
  },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { provider } = useAuth();

  const tabFromUrl = searchParams.get('tab');
  const validTab = tabs.find((t) => t.id === tabFromUrl);
  const [activeTab, setActiveTab] = useState(validTab?.id || 'reservation');

  // Detect return from Stripe checkout success
  const isCheckoutSuccess = searchParams.get('success') === 'true';
  const [showSuccessModal, setShowSuccessModal] = useState(isCheckoutSuccess);

  // Determine plan name and features for success modal
  const providerPlan = provider?.plan as keyof typeof SUBSCRIPTION_PLANS | undefined;
  const planConfig = providerPlan && providerPlan in SUBSCRIPTION_PLANS
    ? SUBSCRIPTION_PLANS[providerPlan as 'solo' | 'team' | 'test']
    : SUBSCRIPTION_PLANS.solo;

  // Sync URL → state
  useEffect(() => {
    if (tabFromUrl && tabs.some((t) => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.replace(`/pro/parametres?tab=${tabId}`, { scroll: false });
  };

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-6 h-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Paramètres
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 ml-9">
          Configurez votre activité et votre compte
        </p>
      </div>

      {/* Settings panel: sidebar + content */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <div className="flex flex-col lg:flex-row">
          {/* Sidebar navigation */}
          <nav className="lg:w-60 flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 lg:border-r border-b lg:border-b-0 border-gray-200 dark:border-gray-700">
            <ul className="flex lg:flex-col gap-0 overflow-x-auto lg:overflow-x-visible p-2 lg:p-3">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <li key={tab.id}>
                    <button
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={`
                        relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium
                        transition-all whitespace-nowrap
                        ${
                          isActive
                            ? 'bg-white dark:bg-gray-700 text-primary-700 dark:text-primary-300 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
                        }
                      `}
                    >
                      {/* Active indicator bar (desktop only) */}
                      {isActive && (
                        <span className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-600 dark:bg-primary-400" />
                      )}
                      {/* Active indicator bar (mobile: bottom) */}
                      {isActive && (
                        <span className="lg:hidden absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-t-full bg-primary-600 dark:bg-primary-400" />
                      )}
                      <Icon
                        className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${
                          isActive
                            ? 'text-primary-600 dark:text-primary-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <div>{tab.label}</div>
                        <div
                          className={`text-xs font-normal hidden lg:block ${
                            isActive
                              ? 'text-primary-600/70 dark:text-primary-400/70'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {tab.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Content area */}
          <div className="flex-1 min-w-0 bg-white dark:bg-gray-800 p-5 sm:p-6 lg:p-8">
            {/* Section header */}
            <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {currentTab.label}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {currentTab.description}
              </p>
            </div>

            {/* Section content */}
            {activeTab === 'reservation' && <ReservationSettingsForm />}
            {activeTab === 'notifications' && <NotificationsForm />}
            {activeTab === 'compte' && <AccountForm />}
            {activeTab === 'abonnement' && <SubscriptionSection />}
            {activeTab === 'partage' && <ShareSection />}
          </div>
        </div>
      </div>

      {/* Success modal after Stripe checkout */}
      <SubscriptionSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        planName={planConfig.name}
        planFeatures={[...planConfig.features]}
      />
    </div>
  );
}
