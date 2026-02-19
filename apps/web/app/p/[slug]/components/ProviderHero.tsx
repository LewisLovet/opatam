'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, User, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { getCategoryLabel } from '@booking-app/shared';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { RatingDisplay } from '@/components/review/RatingDisplay';
import { ShareButton } from './ShareButton';

interface MemberNextAvailability {
  memberId: string;
  memberName: string;
  memberPhoto: string | null;
  nextDate: string | null;
}

// PayPal SVG logo
function PayPalLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
    </svg>
  );
}

interface ProviderHeroProps {
  provider: {
    businessName: string;
    photoURL: string | null;
    coverPhotoURL: string | null;
    category: string;
    description: string;
    rating: {
      average: number;
      count: number;
    };
    isVerified: boolean;
  };
  nextAvailableDate: string | null;
  paypalLink?: string | null;
  memberAvailabilities?: MemberNextAvailability[];
  isTeam?: boolean;
}

/**
 * Format the next available date for display
 * Returns: "Aujourd'hui", "Demain", or "Lun. 3 février"
 */
function formatNextAvailableDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return "Aujourd'hui";
  }

  if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Demain';
  }

  // Format as "Lun. 3 février"
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

export function ProviderHero({
  provider,
  nextAvailableDate,
  paypalLink,
  memberAvailabilities = [],
  isTeam = false,
}: ProviderHeroProps) {
  const paypalUrl = paypalLink
    ? paypalLink.startsWith('http') ? paypalLink : `https://paypal.me/${paypalLink}`
    : null;
  const formattedDate = formatNextAvailableDate(nextAvailableDate);
  // For team plans, show per-member availability; sort by earliest date first
  const showMemberDispos = isTeam && memberAvailabilities.length > 1;

  // Description "Voir plus" logic
  const [descExpanded, setDescExpanded] = useState(false);
  const [descTruncated, setDescTruncated] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (el) {
      // Check if text is actually truncated (scrollHeight > clientHeight)
      setDescTruncated(el.scrollHeight > el.clientHeight + 1);
    }
  }, [provider.description]);

  return (
    <div className="overflow-hidden">
      {/* Cover Photo */}
      <div className="relative h-32 sm:h-48 md:h-64 bg-gray-200 dark:bg-gray-800">
        {provider.coverPhotoURL ? (
          <img
            src={provider.coverPhotoURL}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Share button */}
        <div className="absolute top-4 right-4 z-10">
          <ShareButton businessName={provider.businessName} />
        </div>
      </div>

      {/* Provider Info */}
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-12 sm:-mt-16 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            {/* Avatar */}
            <Avatar
              src={provider.photoURL}
              alt={provider.businessName}
              size="xl"
              className="w-20 h-20 sm:w-28 sm:h-28 border-4 border-white dark:border-gray-900 shadow-lg flex-shrink-0"
            />

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1 sm:pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 sm:text-white dark:text-white break-words">
                  {provider.businessName}
                </h1>
                {provider.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-medium rounded-full">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Vérifié
                  </span>
                )}
              </div>

              <Badge className="mt-2">{getCategoryLabel(provider.category)}</Badge>

              {provider.rating.count > 0 && (
                <div className="mt-3">
                  <RatingDisplay rating={provider.rating.average} count={provider.rating.count} size="md" />
                </div>
              )}

              {provider.description && (
                <div className="mt-3">
                  <p
                    ref={descRef}
                    className={`text-gray-600 dark:text-gray-400 ${descExpanded ? '' : 'line-clamp-1'}`}
                  >
                    {provider.description}
                  </p>
                  {(descTruncated || descExpanded) && (
                    <button
                      type="button"
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {descExpanded ? 'Voir moins' : 'Voir plus'}
                    </button>
                  )}
                </div>
              )}

              {/* Next Available Date Badge + PayPal */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {formattedDate && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                      Prochaine dispo : {formattedDate}
                    </span>
                  </div>
                )}
                {paypalUrl && (
                  <a
                    href={paypalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#0070BA] hover:bg-[#005C99] text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                  >
                    <PayPalLogo className="w-4 h-4" />
                    <span className="text-sm font-semibold">PayPal</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Per-member availability (Team plans only) */}
          {showMemberDispos && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Disponibilités par professionnel
              </h3>
              <div className="space-y-2.5">
                {memberAvailabilities
                  .filter((ma) => ma.nextDate !== null)
                  .sort((a, b) => (a.nextDate! < b.nextDate! ? -1 : 1))
                  .map((ma) => (
                    <div key={ma.memberId} className="flex items-center gap-3">
                      {ma.memberPhoto ? (
                        <Image
                          src={ma.memberPhoto}
                          alt={ma.memberName}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white min-w-0 truncate">
                        {ma.memberName}
                      </span>
                      <span className="ml-auto text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2 py-1 rounded-md whitespace-nowrap">
                        {formatNextAvailableDate(ma.nextDate)}
                      </span>
                    </div>
                  ))}
                {memberAvailabilities.filter((ma) => ma.nextDate === null).length > 0 && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 pt-1">
                    {memberAvailabilities.filter((ma) => ma.nextDate === null).length} professionnel(s) sans disponibilité prochaine
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
