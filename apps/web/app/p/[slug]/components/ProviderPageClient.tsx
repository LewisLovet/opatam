'use client';

import { useRef, useState, useEffect } from 'react';
import { ProviderHero } from './ProviderHero';
import { ProviderNav } from './ProviderNav';
import { ServicesSection } from './ServicesSection';
import { AboutSection } from './AboutSection';
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

type SectionId = 'prestations' | 'apropos' | 'avis' | 'infos';

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
  const aproposRef = useRef<HTMLDivElement>(null);
  const avisRef = useRef<HTMLDivElement>(null);
  const infosRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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
        { id: 'apropos' as SectionId, ref: aproposRef },
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
  }, []);

  const scrollToSection = (sectionId: SectionId) => {
    const refs: Record<SectionId, React.RefObject<HTMLDivElement | null>> = {
      prestations: prestationsRef,
      apropos: aproposRef,
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

  // Check if there's content for about section
  const hasAboutContent =
    !!provider.description || provider.portfolioPhotos.length > 0 || hasSocialLinks(provider.socialLinks);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-24">
      {/* Hero Section */}
      <div ref={heroRef}>
        <ProviderHero provider={provider} />
      </div>

      {/* Sticky Navigation */}
      <ProviderNav
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        visible={showNav}
        hasAboutContent={hasAboutContent}
        hasReviews={reviews.length > 0 || provider.rating.count > 0}
      />

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Services Section */}
        <div ref={prestationsRef} id="prestations">
          <ServicesSection services={services} slug={provider.slug} />
        </div>

        {/* About Section */}
        {hasAboutContent && (
          <div ref={aproposRef} id="apropos">
            <AboutSection
              description={provider.description}
              portfolioPhotos={provider.portfolioPhotos}
              socialLinks={provider.socialLinks}
            />
          </div>
        )}

        {/* Reviews Section */}
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

      {/* Mobile Booking Bar */}
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
