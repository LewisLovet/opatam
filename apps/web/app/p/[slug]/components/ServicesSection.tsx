'use client';

import { useMemo, useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { ServiceItem } from './ServiceItem';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  categoryId?: string | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface ServicesSectionProps {
  services: Service[];
  categories?: ServiceCategory[];
  slug: string;
}

export function ServicesSection({ services, categories = [], slug }: ServicesSectionProps) {
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

  if (services.length === 0) {
    return (
      <section className="pt-6 pb-10">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Prestations
          </h2>
        </div>
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">
            Aucune prestation disponible pour le moment.
          </p>
        </div>
      </section>
    );
  }

  // No categories → flat list (backward compatible)
  if (!hasCategories || !grouped) {
    return (
      <section className="pt-6 pb-10">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-6 h-6 text-primary-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Prestations
          </h2>
          <span className="ml-2 px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-full">
            {services.length}
          </span>
        </div>
        <div className="space-y-4">
          {services.map((service) => (
            <ServiceItem key={service.id} service={service} slug={slug} />
          ))}
        </div>
      </section>
    );
  }

  // With categories → grouped display
  return (
    <section className="pt-6 pb-10">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-6 h-6 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Prestations
        </h2>
        <span className="ml-2 px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium rounded-full">
          {services.length}
        </span>
      </div>

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
                <div className="space-y-4">
                  {catServices.map((service) => (
                    <ServiceItem key={service.id} service={service} slug={slug} />
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
              <div className="space-y-4">
                {grouped.uncategorized.map((service) => (
                  <ServiceItem key={service.id} service={service} slug={slug} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
