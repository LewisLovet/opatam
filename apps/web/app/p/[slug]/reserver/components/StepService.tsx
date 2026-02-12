'use client';

import { useMemo, useState } from 'react';
import { Clock, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  bufferTime: number;
  categoryId?: string | null;
  locationIds: string[];
  memberIds: string[] | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface StepServiceProps {
  services: Service[];
  categories?: ServiceCategory[];
  selectedServiceId: string | null;
  onSelect: (serviceId: string) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes}`;
}

function formatPrice(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(euros);
}

function ServiceButton({
  service,
  isSelected,
  onSelect,
}: {
  service: Service;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(service.id)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {service.name}
            </h3>
            {isSelected && (
              <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          {service.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {service.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{formatDuration(service.duration)}</span>
          </div>
        </div>
        <div className="flex-shrink-0">
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {formatPrice(service.price)}
          </span>
        </div>
      </div>
    </button>
  );
}

export function StepService({ services, categories = [], selectedServiceId, onSelect }: StepServiceProps) {
  const hasCategories = categories.length > 0;

  // When there are many categories (>3), collapse all except the first by default
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    if (categories.length <= 3) return new Set<string>();
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    return new Set(sorted.slice(1).map((c) => c.id));
  });

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const grouped = useMemo(() => {
    if (!hasCategories) return null;

    const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups: { category: ServiceCategory; services: Service[] }[] = [];

    for (const cat of sortedCategories) {
      const catServices = services.filter((s) => s.categoryId === cat.id);
      if (catServices.length > 0) {
        groups.push({ category: cat, services: catServices });
      }
    }

    const uncategorized = services.filter(
      (s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId)
    );

    return { groups, uncategorized };
  }, [services, categories, hasCategories]);

  // No categories → flat list
  if (!hasCategories || !grouped) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Choisissez une prestation
        </h2>
        <div className="space-y-3">
          {services.map((service) => (
            <ServiceButton
              key={service.id}
              service={service}
              isSelected={service.id === selectedServiceId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    );
  }

  // With categories → grouped
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Choisissez une prestation
      </h2>
      <div className="space-y-6">
        {grouped.groups.map(({ category, services: catServices }) => {
          const isCollapsed = collapsedCategories.has(category.id);
          return (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="flex items-center gap-2 mb-3 group w-full text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 transition-colors" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 transition-colors" />
                )}
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {category.name}
                </h3>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-medium rounded-full">
                  {catServices.length}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-3">
                  {catServices.map((service) => (
                    <ServiceButton
                      key={service.id}
                      service={service}
                      isSelected={service.id === selectedServiceId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {grouped.uncategorized.length > 0 && (
          <div>
            {grouped.groups.length > 0 && (
              <button
                type="button"
                onClick={() => toggleCategory('__uncategorized__')}
                className="flex items-center gap-2 mb-3 group w-full text-left"
              >
                {collapsedCategories.has('__uncategorized__') ? (
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 transition-colors" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0 transition-colors" />
                )}
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Autres
                </h3>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-medium rounded-full">
                  {grouped.uncategorized.length}
                </span>
              </button>
            )}
            {!collapsedCategories.has('__uncategorized__') && (
              <div className="space-y-3">
                {grouped.uncategorized.map((service) => (
                  <ServiceButton
                    key={service.id}
                    service={service}
                    isSelected={service.id === selectedServiceId}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
