'use client';

import { Images } from 'lucide-react';
import { PortfolioGallery } from './PortfolioGallery';

interface PortfolioSectionProps {
  photos: string[];
}

export function PortfolioSection({ photos }: PortfolioSectionProps) {
  if (photos.length === 0) return null;

  return (
    <section className="py-10 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <Images className="w-6 h-6 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Portfolio
        </h2>
        <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium rounded-full">
          {photos.length} photos
        </span>
      </div>

      <PortfolioGallery photos={photos} />
    </section>
  );
}
