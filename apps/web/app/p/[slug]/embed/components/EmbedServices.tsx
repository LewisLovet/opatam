'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { Clock, ChevronRight, ChevronDown } from 'lucide-react';

interface EmbedService {
  id: string;
  name: string;
  description: string | null;
  photoURL: string | null;
  duration: number;
  price: number;
  priceMax: number | null;
  categoryId: string | null;
}

interface EmbedServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface EmbedServicesProps {
  services: EmbedService[];
  categories: EmbedServiceCategory[];
  onSelect: (serviceId: string) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h${rem}`;
}

function formatPrice(cents: number, centsMax: number | null): string {
  if (cents === 0 && !centsMax) return 'Gratuit';
  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v / 100);
  if (centsMax && centsMax > cents) return `${fmt(cents)} – ${fmt(centsMax)}`;
  return fmt(cents);
}

/**
 * Service card — compact layout that works at 320px+ width.
 * Photo (64px) | name + description + duration | price + chevron
 */
function ServiceCard({ service, onSelect }: { service: EmbedService; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service.id)}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md active:scale-[0.99] transition-all overflow-hidden group"
    >
      <div className="flex items-start gap-3 p-3">
        {service.photoURL ? (
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 relative">
            <Image
              src={service.photoURL}
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-[15px] leading-snug group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
            {service.name}
          </h3>
          {service.description && (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
              {service.description}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(service.duration)}</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-[15px] whitespace-nowrap">
            {formatPrice(service.price, service.priceMax)}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </button>
  );
}

export function EmbedServices({ services, categories, onSelect }: EmbedServicesProps) {
  const hasCategories = categories.length > 0;

  // Collapse all but the first category when there are many
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (categories.length <= 3) return new Set();
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    return new Set(sorted.slice(1).map((c) => c.id));
  });

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const grouped = useMemo(() => {
    if (!hasCategories) return null;
    const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups: { category: EmbedServiceCategory; services: EmbedService[] }[] = [];
    for (const cat of sortedCategories) {
      const catServices = services.filter((s) => s.categoryId === cat.id);
      if (catServices.length > 0) groups.push({ category: cat, services: catServices });
    }
    const uncategorized = services.filter(
      (s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId)
    );
    return { groups, uncategorized };
  }, [services, categories, hasCategories]);

  if (services.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucune prestation disponible pour le moment.
        </p>
      </div>
    );
  }

  // Flat list when no categories
  if (!hasCategories || !grouped) {
    return (
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Choisissez une prestation
        </h2>
        <div className="space-y-2.5">
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} onSelect={onSelect} />
          ))}
        </div>
      </div>
    );
  }

  // Grouped by category
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
        Choisissez une prestation
      </h2>
      <div className="space-y-4">
        {grouped.groups.map(({ category, services: catServices }) => {
          const isCollapsed = collapsed.has(category.id);
          return (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => toggle(category.id)}
                className="flex items-center gap-2 mb-2 w-full text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="w-0.5 h-4 bg-primary-500 rounded-full flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1 truncate">
                  {category.name}
                </span>
                <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {catServices.length}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    isCollapsed ? '' : 'rotate-180'
                  }`}
                />
              </button>
              {!isCollapsed && (
                <div className="space-y-2.5">
                  {catServices.map((s) => (
                    <ServiceCard key={s.id} service={s} onSelect={onSelect} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {grouped.uncategorized.length > 0 && (
          <div>
            {grouped.groups.length > 0 && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="w-0.5 h-4 bg-gray-400 rounded-full flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Autres prestations
                </span>
              </div>
            )}
            <div className="space-y-2.5">
              {grouped.uncategorized.map((s) => (
                <ServiceCard key={s.id} service={s} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
