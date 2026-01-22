'use client';

import { Briefcase, User, Star, MapPin } from 'lucide-react';

type SectionId = 'prestations' | 'apropos' | 'avis' | 'infos';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
}

interface ProviderNavProps {
  activeSection: SectionId;
  onSectionClick: (sectionId: SectionId) => void;
  visible: boolean;
  hasAboutContent: boolean;
  hasReviews: boolean;
}

export function ProviderNav({
  activeSection,
  onSectionClick,
  visible,
  hasAboutContent,
  hasReviews,
}: ProviderNavProps) {
  const navItems: NavItem[] = [
    { id: 'prestations', label: 'Prestations', icon: <Briefcase className="w-4 h-4" /> },
    ...(hasAboutContent
      ? [{ id: 'apropos' as SectionId, label: 'A propos', icon: <User className="w-4 h-4" /> }]
      : []),
    ...(hasReviews
      ? [{ id: 'avis' as SectionId, label: 'Avis', icon: <Star className="w-4 h-4" /> }]
      : []),
    { id: 'infos', label: 'Infos', icon: <MapPin className="w-4 h-4" /> },
  ];

  return (
    <nav
      className={`
        sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700
        transition-all duration-300
        ${visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}
      `}
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionClick(item.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap
                transition-colors
                ${
                  activeSection === item.id
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
