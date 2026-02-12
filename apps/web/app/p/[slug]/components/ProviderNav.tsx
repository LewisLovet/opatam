'use client';

import { Briefcase, Star, Clock } from 'lucide-react';

type TabId = 'prestations' | 'avis' | 'horaires';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface ProviderNavProps {
  activeTab: TabId;
  onTabClick: (tabId: TabId) => void;
  reviewCount?: number;
}

const tabs: TabItem[] = [
  { id: 'prestations', label: 'Prestations', icon: <Briefcase className="w-4 h-4" /> },
  { id: 'avis', label: 'Avis', icon: <Star className="w-4 h-4" /> },
  { id: 'horaires', label: 'Horaires', icon: <Clock className="w-4 h-4" /> },
];

export function ProviderNav({
  activeTab,
  onTabClick,
  reviewCount,
}: ProviderNavProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`
              flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors -mb-px
              ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.id === 'avis' && reviewCount !== undefined && reviewCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                {reviewCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
