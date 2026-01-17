'use client';

import { useState } from 'react';
import { Scissors, Sparkles, HandMetal, Dumbbell, User } from 'lucide-react';

// Layout (for demo display only)
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

// Search
import { SearchBar } from '@/components/search/SearchBar';
import { SearchFilters } from '@/components/search/SearchFilters';
import { CategoryPills } from '@/components/search/CategoryPills';

// Provider
import { ProviderCard } from '@/components/provider/ProviderCard';
import { ProviderHeader } from '@/components/provider/ProviderHeader';
import { ProviderInfo } from '@/components/provider/ProviderInfo';
import { FeaturedProviders } from '@/components/provider/FeaturedProviders';

// Booking
import { ServiceCard } from '@/components/booking/ServiceCard';
import { ServiceList } from '@/components/booking/ServiceList';
import { MemberPicker } from '@/components/booking/MemberPicker';
import { SlotPicker } from '@/components/booking/SlotPicker';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { ClientForm } from '@/components/booking/ClientForm';

// Review
import { ReviewCard } from '@/components/review/ReviewCard';
import { ReviewList } from '@/components/review/ReviewList';
import { RatingDisplay } from '@/components/review/RatingDisplay';

// Common
import { AppStoreBadges } from '@/components/common/AppStoreBadges';
import { EmptyState } from '@/components/common/EmptyState';
import { StepIndicator } from '@/components/common/StepIndicator';

// Mock Data - Enriched provider data with all fields
const mockProviders = [
  {
    id: '1',
    businessName: 'Salon Elegance',
    photoURL: null,
    category: 'Coiffure',
    description: 'Salon de coiffure haut de gamme au coeur de Paris. Nos experts vous accueillent dans un cadre chaleureux.',
    isVerified: true,
    city: 'Paris',
    rating: 4.8,
    reviewCount: 124,
    minPrice: 25,
  },
  {
    id: '2',
    businessName: 'Spa Bien-Etre',
    photoURL: null,
    category: 'Spa & Massage',
    description: 'Detente et relaxation dans un espace zen. Massages, soins du corps et du visage.',
    isVerified: true,
    city: 'Lyon',
    rating: 4.6,
    reviewCount: 89,
    minPrice: 45,
  },
  {
    id: '3',
    businessName: 'Institut Beaute Plus',
    photoURL: null,
    category: 'Esthetique',
    description: null, // No description case
    isVerified: false,
    city: 'Marseille',
    rating: 4.9,
    reviewCount: 256,
    minPrice: 15,
  },
  {
    id: '4',
    businessName: 'Barber Shop',
    photoURL: null,
    category: 'Barbier',
    description: 'Le barbier traditionnel reinvente. Coupe, barbe et soins pour homme.',
    isVerified: true,
    city: null, // No city case
    rating: 4.7,
    reviewCount: 0, // No reviews case - should not show rating
    minPrice: 20,
  },
  {
    id: '5',
    businessName: 'Nouveau Salon',
    photoURL: null,
    category: 'Coiffure',
    description: 'Un nouveau salon qui vient d\'ouvrir ses portes.',
    isVerified: false,
    city: 'Nice',
    rating: 0,
    reviewCount: 0, // No reviews - should not show rating
    minPrice: null, // No services yet - should not show price
  },
];

const mockServices = [
  {
    id: '1',
    name: 'Coupe femme',
    description: 'Coupe, shampooing et brushing inclus',
    duration: 45,
    price: 35,
  },
  {
    id: '2',
    name: 'Coloration',
    description: 'Coloration complète avec soin',
    duration: 90,
    price: 65,
  },
  {
    id: '3',
    name: 'Balayage',
    description: 'Technique de coloration naturelle pour un effet soleil',
    duration: 120,
    price: 95,
  },
];

const mockMembers = [
  { id: '1', name: 'Marie Dupont', photoURL: null, role: 'Coiffeuse senior' },
  { id: '2', name: 'Jean Martin', photoURL: null, role: 'Coloriste' },
  { id: '3', name: 'Sophie Bernard', photoURL: null, role: 'Styliste' },
];

const mockReviews = [
  {
    id: '1',
    rating: 5,
    comment: 'Excellent service ! Marie est très professionnelle et à l\'écoute. Je recommande vivement.',
    clientName: 'Claire L.',
    clientPhotoURL: null,
    serviceName: 'Coupe femme',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    rating: 4,
    comment: 'Très bon salon, ambiance agréable. Un peu d\'attente mais le résultat en vaut la peine.',
    clientName: 'Thomas M.',
    clientPhotoURL: null,
    serviceName: 'Coloration',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    rating: 5,
    comment: 'Parfait !',
    clientName: 'Emma R.',
    clientPhotoURL: null,
    serviceName: 'Balayage',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  },
];

const mockCategories = [
  { id: 'coiffure', label: 'Coiffure', icon: <Scissors className="w-4 h-4" /> },
  { id: 'spa', label: 'Spa & Massage', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'esthetique', label: 'Esthétique', icon: <HandMetal className="w-4 h-4" /> },
  { id: 'barbier', label: 'Barbier', icon: <User className="w-4 h-4" /> },
  { id: 'fitness', label: 'Fitness', icon: <Dumbbell className="w-4 h-4" /> },
];

const mockFilterCategories = [
  { value: 'coiffure', label: 'Coiffure' },
  { value: 'spa', label: 'Spa & Massage' },
  { value: 'esthetique', label: 'Esthétique' },
  { value: 'barbier', label: 'Barbier' },
];

// Generate mock time slots
function generateMockSlots() {
  const slots = [];
  const now = new Date();

  for (let day = 0; day < 10; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);

    // Generate slots from 9:00 to 18:00
    for (let hour = 9; hour < 18; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const slotDate = new Date(date);
        slotDate.setHours(hour, min, 0, 0);

        // Randomly mark some slots as unavailable
        const available = Math.random() > 0.3;

        slots.push({
          datetime: slotDate,
          available,
        });
      }
    }
  }

  return slots.filter(s => s.available);
}

const mockSlots = generateMockSlots();

// Component Section
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 pb-2 border-b border-gray-200 dark:border-gray-700">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function ComponentsMetierPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState(2);

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-x-hidden">
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Composants Métier
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Démo des composants métier réutilisables (layout, search, provider, booking, review, common)
        </p>

        {/* Search Components */}
        <Section title="Search Components">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">SearchBar (default)</h3>
              <SearchBar
                onSearch={(query, location) => console.log('Search:', query, location)}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">SearchBar (large)</h3>
              <SearchBar
                size="large"
                defaultQuery="Coiffure"
                defaultLocation="Paris"
                onSearch={(query, location) => console.log('Search:', query, location)}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">CategoryPills</h3>
              <CategoryPills
                categories={mockCategories}
                selectedId={selectedCategory}
                onSelect={setSelectedCategory}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">SearchFilters</h3>
              <SearchFilters
                categories={mockFilterCategories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                onSortChange={(sort) => console.log('Sort:', sort)}
                onReset={() => setSelectedCategory(null)}
              />
            </div>
          </div>
        </Section>

        {/* Provider Components */}
        <Section title="Provider Components">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">ProviderCard</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockProviders.slice(0, 2).map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">FeaturedProviders</h3>
              <FeaturedProviders
                title="Nos coiffeurs populaires"
                subtitle="Les mieux notés de votre région"
                providers={mockProviders}
                viewAllHref="/recherche"
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">ProviderHeader</h3>
              <ProviderHeader
                provider={{
                  businessName: 'Salon Élégance',
                  photoURL: null,
                  coverPhotoURL: null,
                  category: 'Coiffure',
                  description: 'Salon de coiffure haut de gamme au cœur de Paris. Nos experts vous accueillent dans un cadre chaleureux.',
                  rating: 4.8,
                  reviewCount: 124,
                  isVerified: true,
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">ProviderInfo</h3>
              <ProviderInfo
                address="123 Rue de la Paix"
                city="Paris"
                postalCode="75001"
                phone="01 23 45 67 89"
                email="contact@salon-elegance.fr"
                website="https://salon-elegance.fr"
                className="max-w-md"
              />
            </div>
          </div>
        </Section>

        {/* Booking Components */}
        <Section title="Booking Components">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">ServiceCard</h3>
              <div className="max-w-md">
                <ServiceCard
                  service={mockServices[0]}
                  selected={selectedService === mockServices[0].id}
                  onSelect={setSelectedService}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">ServiceList</h3>
              <div className="max-w-lg">
                <ServiceList
                  services={mockServices}
                  selectedId={selectedService}
                  onSelect={setSelectedService}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">MemberPicker</h3>
              <div className="max-w-md">
                <MemberPicker
                  members={mockMembers}
                  selectedId={selectedMember}
                  onSelect={setSelectedMember}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">SlotPicker</h3>
              <SlotPicker
                slots={mockSlots}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">BookingSummary</h3>
              <div className="max-w-md">
                <BookingSummary
                  service={{
                    name: 'Coupe femme',
                    duration: 45,
                    price: 35,
                  }}
                  datetime={new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)}
                  location={{
                    name: 'Salon Élégance - Paris',
                    address: '123 Rue de la Paix, 75001 Paris',
                  }}
                  member={{
                    name: 'Marie Dupont',
                    photoURL: null,
                  }}
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">ClientForm</h3>
              <div className="max-w-md">
                <ClientForm
                  onSubmit={(data) => console.log('Form submitted:', data)}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Review Components */}
        <Section title="Review Components">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">RatingDisplay (sizes)</h3>
              <div className="space-y-3">
                <RatingDisplay rating={4.5} count={124} size="sm" />
                <RatingDisplay rating={4.5} count={124} size="md" />
                <RatingDisplay rating={4.5} count={124} size="lg" />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">ReviewCard</h3>
              <div className="max-w-lg">
                <ReviewCard review={mockReviews[0]} />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">ReviewList</h3>
              <div className="max-w-lg">
                <ReviewList
                  reviews={mockReviews}
                  averageRating={4.7}
                  totalCount={mockReviews.length}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Common Components */}
        <Section title="Common Components">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">StepIndicator</h3>
              <StepIndicator
                steps={[
                  { label: 'Prestation', description: 'Choisir une prestation' },
                  { label: 'Créneau', description: 'Sélectionner un créneau' },
                  { label: 'Confirmation', description: 'Confirmer la réservation' },
                ]}
                currentStep={currentStep}
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                  className="px-3 py-1 text-sm bg-gray-200 rounded"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
                  className="px-3 py-1 text-sm bg-gray-200 rounded"
                >
                  Suivant
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">EmptyState</h3>
              <EmptyState
                title="Aucun résultat"
                description="Nous n'avons trouvé aucun prestataire correspondant à votre recherche."
                action={{
                  label: 'Modifier la recherche',
                  onClick: () => console.log('Modify search'),
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">EmptyState (custom icon)</h3>
              <EmptyState
                icon={
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                title="Aucun créneau disponible"
                description="Il n'y a plus de créneaux disponibles pour cette date."
                action={{
                  label: 'Choisir une autre date',
                  onClick: () => console.log('Change date'),
                }}
                secondaryAction={{
                  label: 'Être notifié',
                  onClick: () => console.log('Notify'),
                  variant: 'outline',
                }}
              />
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">AppStoreBadges</h3>
              <AppStoreBadges />
            </div>
          </div>
        </Section>

        {/* Layout Components Demo */}
        <Section title="Layout Components">
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-medium mb-4">Header</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <Header />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Footer</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <Footer />
              </div>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
