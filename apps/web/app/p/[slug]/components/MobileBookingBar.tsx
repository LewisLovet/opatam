'use client';

import Link from 'next/link';
import { useDevise } from '@/contexts/DeviseContext';
import { useLocale, useTranslations } from 'next-intl';
import { localizedPath } from '@/lib/localizedPath';
import { Button } from '@/components/ui/Button';

interface MobileBookingBarProps {
  slug: string;
  minPrice: number | null;
  businessName: string;
}

export function MobileBookingBar({ slug, minPrice, businessName }: MobileBookingBarProps) {
  // Devise du prestataire de la page : ce formateur ecrivait l'euro
  // en dur, un salon suisse y lisait donc des euros.
  const devise = useDevise();
  const t = useTranslations('provider');
  const locale = useLocale();

  const formatPrice = (cents: number): string => {
    if (cents === 0) return t('services.free');
    const euros = cents / 100;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: devise,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(euros);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Price info */}
            <div className="flex-1 min-w-0">
              {minPrice !== null ? (
                <>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('mobileBar.from')}
                  </span>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">
                    {formatPrice(minPrice)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                  {businessName}
                </p>
              )}
            </div>

            {/* CTA Button */}
            <Link href={localizedPath(`/p/${slug}/reserver`, locale)}>
              <Button size="lg" className="px-8 font-semibold">
                {t('mobileBar.book')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
