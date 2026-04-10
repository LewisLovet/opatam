'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { ProviderHero } from './ProviderHero';
import { ProviderNav } from './ProviderNav';
import { SocialLinks } from './SocialLinks';
import { ServicesSection } from './ServicesSection';
import { PortfolioSection } from './PortfolioSection';
import { ReviewsSection } from './ReviewsSection';
import { InfosSection } from './InfosSection';
import { MobileBookingBar } from './MobileBookingBar';
import { DemoBanner } from './DemoBanner';

// Serialized types (dates as strings from server)
interface SerializedProvider {
  id: string;
  userId: string;
  plan: string;
  businessName: string;
  description: string;
  category: string;
  slug: string;
  photoURL: string | null;
  coverPhotoURL: string | null;
  portfolioPhotos: string[];
  socialLinks: {
    instagram: string | null;
    facebook: string | null;
    tiktok: string | null;
    website: string | null;
    paypal: string | null;
  };
  rating: {
    average: number;
    count: number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  };
  settings?: {
    bookingNotice?: string | null;
  };
  isPublished: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SerializedService {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  priceMax?: number | null;
  bufferTime: number;
  categoryId?: string | null;
  locationIds: string[];
  memberIds: string[] | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SerializedLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  geopoint: { latitude: number; longitude: number } | null;
  description: string | null;
  type: 'fixed' | 'mobile';
  travelRadius: number | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SerializedMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photoURL: string | null;
  accessCode: string;
  locationId: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SerializedReview {
  id: string;
  providerId: string;
  bookingId: string;
  clientId: string | null;
  memberId: string | null;
  clientName: string;
  clientPhoto: string | null;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string;
}

interface SerializedAvailability {
  id: string;
  memberId: string;
  locationId: string;
  dayOfWeek: number;
  slots: { start: string; end: string }[];
  isOpen: boolean;
  effectiveFrom: string | null;
  updatedAt: string;
}

interface SerializedServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface MemberNextAvailability {
  memberId: string;
  memberName: string;
  memberPhoto: string | null;
  nextDate: string | null;
}

interface ProviderPageClientProps {
  provider: SerializedProvider;
  services: SerializedService[];
  serviceCategories?: SerializedServiceCategory[];
  locations: SerializedLocation[];
  members: SerializedMember[];
  reviews: SerializedReview[];
  availabilities: SerializedAvailability[];
  minPrice: number | null;
  nextAvailableDate: string | null;
  memberAvailabilities?: MemberNextAvailability[];
  isDemo?: boolean;
}

type TabId = 'prestations' | 'avis' | 'horaires';

export function ProviderPageClient({
  provider,
  services,
  serviceCategories = [],
  locations,
  members,
  reviews,
  availabilities,
  minPrice,
  nextAvailableDate,
  memberAvailabilities = [],
  isDemo = false,
}: ProviderPageClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('prestations');
  const [showNotice, setShowNotice] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const bookingNotice = provider.settings?.bookingNotice;

  const handleBookingClick = useCallback((url: string) => {
    if (bookingNotice) {
      setPendingUrl(url);
      setShowNotice(true);
    } else {
      router.push(url);
    }
  }, [bookingNotice, router]);

  const handleNoticeAccept = () => {
    setShowNotice(false);
    if (pendingUrl) {
      router.push(pendingUrl);
      setPendingUrl(null);
    }
  };

  // Track page view (deduplicated per session per provider)
  useEffect(() => {
    if (isDemo) return;
    const key = `pv_${provider.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    fetch('/api/analytics/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: provider.id }),
    }).catch(() => {});
  }, [provider.id, isDemo]);

  // Check if has portfolio photos
  const hasPortfolio = provider.portfolioPhotos.length > 0;

  // Check if has social links
  const hasSocials = hasSocialLinks(provider.socialLinks);

  // Check if provider has team plan (more than 1 member)
  const isTeam = provider.plan === 'team' && members.length > 1;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
      {/* Demo welcome modal */}
      {isDemo && <DemoBanner />}

      {/* Hero Section */}
      <ProviderHero
        provider={provider}
        nextAvailableDate={nextAvailableDate}
        paypalLink={provider.socialLinks?.paypal}
        memberAvailabilities={isTeam ? memberAvailabilities : []}
        isTeam={isTeam}
      />

      {/* Social Links - Just after hero, before tabs */}
      {hasSocials && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex justify-center">
            <SocialLinks links={provider.socialLinks} />
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <ProviderNav
        activeTab={activeTab}
        onTabClick={setActiveTab}
        reviewCount={reviews.length}
      />

      {/* Tab Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {activeTab === 'prestations' && (
          <>
            <ServicesSection services={services} categories={serviceCategories} slug={provider.slug} onBookingClick={bookingNotice ? handleBookingClick : undefined} />
            {/* Portfolio shown below services if available */}
            {hasPortfolio && (
              <PortfolioSection photos={provider.portfolioPhotos} />
            )}
          </>
        )}

        {activeTab === 'avis' && (
          <ReviewsSection reviews={reviews} rating={provider.rating} />
        )}

        {activeTab === 'horaires' && (
          <InfosSection
            locations={locations}
            members={members}
            availabilities={availabilities}
            isTeam={isTeam}
          />
        )}
      </div>

      {/* Sticky Booking Bar (all screens) */}
      <MobileBookingBar
        slug={provider.slug}
        minPrice={minPrice}
        businessName={provider.businessName}
      />

      {/* Booking Notice Modal */}
      {showNotice && bookingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotice(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Information importante
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-line mb-6">
              {bookingNotice}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNotice(false)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleNoticeAccept}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                J&apos;ai compris, continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function hasSocialLinks(socialLinks: SerializedProvider['socialLinks']): boolean {
  return !!(socialLinks.instagram || socialLinks.facebook || socialLinks.tiktok || socialLinks.website);
}
