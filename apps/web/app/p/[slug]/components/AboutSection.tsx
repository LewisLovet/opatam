'use client';

import { useState } from 'react';
import { User, ChevronDown, ChevronUp, Quote } from 'lucide-react';
import { PortfolioGallery } from './PortfolioGallery';
import { SocialLinks } from './SocialLinks';

interface SocialLinksData {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
}

interface AboutSectionProps {
  description: string;
  portfolioPhotos: string[];
  socialLinks: SocialLinksData;
}

const MAX_DESCRIPTION_LENGTH = 300;

export function AboutSection({ description, portfolioPhotos, socialLinks }: AboutSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSocialLinks = !!(
    socialLinks.instagram ||
    socialLinks.facebook ||
    socialLinks.tiktok ||
    socialLinks.website
  );

  const isLongDescription = description.length > MAX_DESCRIPTION_LENGTH;
  const displayDescription = expanded || !isLongDescription
    ? description
    : description.substring(0, MAX_DESCRIPTION_LENGTH) + '...';

  return (
    <section className="py-10 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-6">
        <User className="w-6 h-6 text-primary-500" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          A propos
        </h2>
      </div>

      {/* Description in quote style */}
      {description && (
        <div className="relative mb-8">
          <div className="relative bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/10 rounded-2xl p-6 sm:p-8">
            {/* Decorative quote */}
            <Quote className="absolute top-4 left-4 w-8 h-8 text-primary-300 dark:text-primary-700 opacity-50" />

            <div className="relative pl-6">
              <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed whitespace-pre-line">
                {displayDescription}
              </p>

              {isLongDescription && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-4 inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 font-medium text-sm hover:underline"
                >
                  {expanded ? (
                    <>
                      Voir moins
                      <ChevronUp className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Voir plus
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Portfolio Gallery */}
      {portfolioPhotos.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            Portfolio
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm rounded-full">
              {portfolioPhotos.length} photos
            </span>
          </h3>
          <PortfolioGallery photos={portfolioPhotos} />
        </div>
      )}

      {/* Social Links */}
      {hasSocialLinks && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Retrouvez-moi sur
          </h3>
          <SocialLinks links={socialLinks} />
        </div>
      )}
    </section>
  );
}
