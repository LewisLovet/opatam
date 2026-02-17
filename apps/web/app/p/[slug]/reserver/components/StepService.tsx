'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Check, ChevronRight } from 'lucide-react';

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
  if (cents === 0) return 'Gratuit';
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
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (el) {
      setDescClamped(el.scrollHeight > el.clientHeight);
    }
  }, [service.description]);

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
            <div className="mt-1">
              <p
                ref={descRef}
                className={`text-sm text-gray-500 dark:text-gray-400 ${!descExpanded ? 'line-clamp-2' : ''}`}
              >
                {service.description}
              </p>
              {descClamped && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDescExpanded((v) => !v);
                  }}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-0.5 inline-block"
                >
                  {descExpanded ? 'Moins' : 'Plus de détails'}
                </span>
              )}
            </div>
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
                className="flex items-center gap-3 mb-3 w-full text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-800 rounded-xl px-4 py-3 transition-colors"
              >
                <div className="w-1 h-5 bg-primary-500 rounded-full flex-shrink-0" />
                <h3 className="text-[17px] font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
                  {category.name}
                </h3>
                <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {catServices.length}
                </span>
                <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-auto transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`} />
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
                className="flex items-center gap-3 mb-3 w-full text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-800 rounded-xl px-4 py-3 transition-colors"
              >
                <div className="w-1 h-5 bg-primary-500 rounded-full flex-shrink-0" />
                <h3 className="text-[17px] font-semibold text-gray-800 dark:text-gray-200 tracking-tight">
                  Autres
                </h3>
                <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {grouped.uncategorized.length}
                </span>
                <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 ml-auto transition-transform duration-200 ${!collapsedCategories.has('__uncategorized__') ? 'rotate-90' : ''}`} />
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
