'use client';

import { Sparkles } from 'lucide-react';
import { ServiceItem } from './ServiceItem';

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
}

interface ServicesSectionProps {
  services: Service[];
  slug: string;
}

export function ServicesSection({ services, slug }: ServicesSectionProps) {
  if (services.length === 0) {
    return (
      <section className="py-10">
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

  return (
    <section className="py-10">
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
