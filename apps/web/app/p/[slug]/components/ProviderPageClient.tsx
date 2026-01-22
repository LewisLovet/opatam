'use client';

import { useRef, useState, useEffect } from 'react';
import { ProviderHero } from './ProviderHero';
import { ProviderNav } from './ProviderNav';
import { SocialLinks } from './SocialLinks';
import { ServicesSection } from './ServicesSection';
import { PortfolioSection } from './PortfolioSection';
import { ReviewsSection } from './ReviewsSection';
import { InfosSection } from './InfosSection';
import { MobileBookingBar } from './MobileBookingBar';

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
  };
  rating: {
    average: number;
    count: number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
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
  bufferTime: number;
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
  clientId: string;
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

interface ProviderPageClientProps {
  provider: SerializedProvider;
  services: SerializedService[];
  locations: SerializedLocation[];
  members: SerializedMember[];
  reviews: SerializedReview[];
  availabilities: SerializedAvailability[];
  minPrice: number | null;
}

type SectionId = 'prestations' | 'portfolio' | 'avis' | 'infos';

export function ProviderPageClient({
  provider,
  services,
  locations,
  members,
  reviews,
  availabilities,
  minPrice,
}: ProviderPageClientProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('prestations');
  const [showNav, setShowNav] = useState(false);

  // Section refs for scroll spy
  const prestationsRef = useRef<HTMLDivElement>(null);
  const portfolioRef = useRef<HTMLDivElement>(null);
  const avisRef = useRef<HTMLDivElement>(null);
  const infosRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  // Check if has portfolio photos
  const hasPortfolio = provider.portfolioPhotos.length > 0;

  // Check if has social links
  const hasSocials = hasSocialLinks(provider.socialLinks);

  // Scroll spy effect
  useEffect(() => {
    const handleScroll = () => {
      // Show nav after scrolling past hero
      if (heroRef.current) {
        const heroBottom = heroRef.current.getBoundingClientRect().bottom;
        setShowNav(heroBottom < 60);
      }

      // Determine active section
      const sections = [
        { id: 'prestations' as SectionId, ref: prestationsRef },
        ...(hasPortfolio ? [{ id: 'portfolio' as SectionId, ref: portfolioRef }] : []),
        { id: 'avis' as SectionId, ref: avisRef },
        { id: 'infos' as SectionId, ref: infosRef },
      ];

      const scrollPosition = window.scrollY + 150;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section.ref.current) {
          const offsetTop = section.ref.current.offsetTop;
          if (scrollPosition >= offsetTop) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasPortfolio]);

  const scrollToSection = (sectionId: SectionId) => {
    const refs: Record<SectionId, React.RefObject<HTMLDivElement | null>> = {
      prestations: prestationsRef,
      portfolio: portfolioRef,
      avis: avisRef,
      infos: infosRef,
    };

    const ref = refs[sectionId];
    if (ref.current) {
      const offset = 80; // Nav height
      const top = ref.current.offsetTop - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  // Check if provider has team plan (more than 1 member)
  const isTeam = provider.plan === 'team' && members.length > 1;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
      {/* Hero Section */}
      <div ref={heroRef}>
        <ProviderHero provider={provider} />
      </div>

      {/* Social Links - Just after hero, before nav */}
      {hasSocials && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex justify-center">
            <SocialLinks links={provider.socialLinks} />
          </div>
        </div>
      )}

      {/* Sticky Navigation */}
      <ProviderNav
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        visible={showNav}
        hasPortfolio={hasPortfolio}
      />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Services Section */}
        <div ref={prestationsRef} id="prestations">
          <ServicesSection services={services} slug={provider.slug} />
        </div>

        {/* Portfolio Section (only if has photos) */}
        {hasPortfolio && (
          <div ref={portfolioRef} id="portfolio">
            <PortfolioSection photos={provider.portfolioPhotos} />
          </div>
        )}

        {/* Reviews Section (always visible with distribution) */}
        <div ref={avisRef} id="avis">
          <ReviewsSection reviews={reviews} rating={provider.rating} />
        </div>

        {/* Infos Section */}
        <div ref={infosRef} id="infos">
          <InfosSection
            locations={locations}
            members={members}
            availabilities={availabilities}
            isTeam={isTeam}
          />
        </div>
      </div>

      {/* Sticky Booking Bar (all screens) */}
      <MobileBookingBar
        slug={provider.slug}
        minPrice={minPrice}
        businessName={provider.businessName}
      />
    </div>
  );
}

function hasSocialLinks(socialLinks: SerializedProvider['socialLinks']): boolean {
  return !!(socialLinks.instagram || socialLinks.facebook || socialLinks.tiktok || socialLinks.website);
}
