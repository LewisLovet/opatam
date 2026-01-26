/**
 * Business Components Showcase Page
 * Displays all business components organized by tabs
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import {
  Text,
  Card,
  Button,
  ProviderCard,
  ProviderHeader,
  ProviderInfo,
  SearchBar,
  CategoryPills,
  CitySelect,
  EmptyState,
  ScreenHeader,
  ServiceCard,
  ServiceCategory,
  BookingStatusBadge,
  BookingCard,
  BookingDetail,
  BookingRecap,
  CalendarStrip,
  TimeSlotGrid,
  MemberCard,
  MemberPicker,
  StickyFooter,
  // Lot 3 - Reviews
  StarRating,
  StarRatingInput,
  ReviewCard,
  RatingStats,
  // Lot 3 - Pro
  StatCard,
  DaySchedule,
  BookingListItem,
} from '../components';

// ============================================================================
// MOCK DATA
// ============================================================================

// Provider mock data - aligned with @booking-app/shared types
const mockProvider = {
  photoURL: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
  coverPhotoURL: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
  avatarURL: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  businessName: 'Studio Beauté Paris',
  category: 'Coiffure',
  city: 'Paris',
  address: '15 Rue de la Paix, 75002 Paris',
  phone: '+33 1 42 68 53 00',
  description:
    'Studio de coiffure et beauté situé au cœur de Paris. Notre équipe de professionnels vous accueille dans un cadre chaleureux et moderne.',
  rating: {
    average: 4.8,
    count: 124,
    distribution: { 1: 2, 2: 3, 3: 8, 4: 25, 5: 86 },
  },
  minPrice: 2500,
  isVerified: true,
};

const mockProviderNew = {
  photoURL: null,
  businessName: 'Nouveau Prestataire',
  category: 'Massage',
  city: 'Lyon',
  rating: {
    average: 0,
    count: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  },
  minPrice: null,
  isVerified: false,
};

const mockCategories = [
  { id: 'coiffure', label: 'Coiffure' },
  { id: 'beaute', label: 'Beauté' },
  { id: 'massage', label: 'Massage' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'sante', label: 'Santé' },
];

const mockCities = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille'];

// Services mock data
const mockServices = [
  { id: '1', name: 'Coupe femme', description: 'Coupe, shampoing et brushing', duration: 45, price: 35 },
  { id: '2', name: 'Coupe homme', description: 'Coupe classique', duration: 30, price: 25 },
  { id: '3', name: 'Coloration', description: 'Coloration complète avec soin', duration: 90, price: 65 },
  { id: '4', name: 'Brushing', description: null, duration: 30, price: 20 },
];

const mockServiceCategories = [
  {
    title: 'Coupes',
    services: [
      { id: '1', name: 'Coupe femme', description: 'Coupe, shampoing et brushing', duration: 45, price: 35 },
      { id: '2', name: 'Coupe homme', description: 'Coupe classique', duration: 30, price: 25 },
    ],
  },
  {
    title: 'Couleurs',
    services: [
      { id: '3', name: 'Coloration', description: 'Coloration complète avec soin', duration: 90, price: 65 },
      { id: '5', name: 'Mèches', description: 'Mèches ou balayage', duration: 120, price: 85 },
    ],
  },
];

// Booking mock data
const mockBooking = {
  id: 'booking-1',
  date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  time: '14:30',
  provider: {
    name: 'Studio Beauté Paris',
    photoURL: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
    phone: '+33 1 42 68 53 00',
    address: '15 Rue de la Paix, 75002 Paris',
  },
  service: { name: 'Coupe femme', duration: 45, price: 35 },
  member: { name: 'Sophie Martin' },
  status: 'confirmed' as const,
  location: { name: 'Salon Principal', address: '15 Rue de la Paix, 75002 Paris' },
};

const mockBookingPast = {
  ...mockBooking,
  id: 'booking-2',
  date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  status: 'confirmed' as const,
};

// Members mock data
const mockMembers = [
  { id: '1', name: 'Sophie Martin', role: 'Coiffeuse senior', avatarURL: null },
  { id: '2', name: 'Julie Dubois', role: 'Coloriste', avatarURL: null },
  { id: '3', name: 'Marc Laurent', role: 'Coiffeur', avatarURL: null },
];

// Time slots mock data
const mockTimeSlots = [
  { time: '09:00', available: true },
  { time: '09:30', available: true },
  { time: '10:00', available: false },
  { time: '10:30', available: true },
  { time: '11:00', available: true },
  { time: '11:30', available: false },
  { time: '14:00', available: true },
  { time: '14:30', available: true },
  { time: '15:00', available: true },
  { time: '15:30', available: false },
  { time: '16:00', available: true },
  { time: '16:30', available: true },
];

// Reviews mock data
const mockReviews = [
  {
    id: '1',
    authorName: 'Marie Dupont',
    rating: 5,
    comment: "Excellente prestation ! Sophie est très professionnelle et à l'écoute. Je recommande vivement.",
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // il y a 2 jours
    reply: {
      text: "Merci beaucoup Marie ! C'était un plaisir de vous recevoir.",
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  },
  {
    id: '2',
    authorName: 'Jean Martin',
    rating: 4,
    comment: "Très bon service, juste un peu d'attente à l'arrivée.",
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // il y a 1 semaine
    reply: null,
  },
  {
    id: '3',
    authorName: 'Lucie Bernard',
    rating: 5,
    comment: null, // Avis sans commentaire
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    reply: null,
  },
];

const mockRatingStats = {
  average: 4.6,
  count: 124,
  distribution: {
    5: 78,
    4: 32,
    3: 10,
    2: 3,
    1: 1,
  },
};

// Pro mode mock data
const mockDayBookings = [
  { id: '1', startTime: '09:00', endTime: '09:45', clientName: 'Marie Dupont', serviceName: 'Coupe femme', status: 'confirmed' as const },
  { id: '2', startTime: '10:00', endTime: '11:30', clientName: 'Sophie Martin', serviceName: 'Coloration', status: 'confirmed' as const },
  { id: '3', startTime: '11:30', endTime: '12:00', clientName: 'Jean Petit', serviceName: 'Coupe homme', status: 'pending' as const },
  { id: '4', startTime: '14:00', endTime: '14:45', clientName: 'Lucie Bernard', serviceName: 'Brushing', status: 'confirmed' as const },
  { id: '5', startTime: '15:00', endTime: '15:30', clientName: 'Paul Durand', serviceName: 'Coupe homme', status: 'cancelled' as const },
];

const mockProStats = [
  { icon: 'calendar-outline' as const, label: "RDV aujourd'hui", value: 8 },
  { icon: 'time-outline' as const, label: 'En attente', value: 2, trend: { value: -1, isPositive: true } },
  { icon: 'star-outline' as const, label: 'Note moyenne', value: '4.8' },
  { icon: 'people-outline' as const, label: 'Clients ce mois', value: 47, trend: { value: 12, isPositive: true } },
];

// ============================================================================
// TABS CONFIGURATION
// ============================================================================

type TabId = 'provider' | 'search' | 'services' | 'booking' | 'calendar' | 'layout' | 'reviews' | 'pro';

const tabs: { id: TabId; label: string }[] = [
  { id: 'provider', label: 'Prestataire' },
  { id: 'search', label: 'Recherche' },
  { id: 'services', label: 'Services' },
  { id: 'booking', label: 'Réservation' },
  { id: 'calendar', label: 'Calendrier' },
  { id: 'layout', label: 'Layout' },
  { id: 'reviews', label: 'Avis' },
  { id: 'pro', label: 'Pro' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BusinessComponentsScreen() {
  const { colors, spacing } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>('provider');

  // Demo state
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.divider }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tab,
                  {
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    borderBottomWidth: 2,
                    borderBottomColor: isActive ? colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  variant="body"
                  color={isActive ? 'primary' : 'textSecondary'}
                  style={{ fontWeight: isActive ? '600' : '400' }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'provider' && (
          <ProviderTabContent provider={mockProvider} />
        )}

        {activeTab === 'search' && (
          <SearchTabContent
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            selectedCategory={selectedCategory}
            onCategorySelect={setSelectedCategory}
            selectedCity={selectedCity}
            onCityChange={setSelectedCity}
            categories={mockCategories}
            cities={mockCities}
          />
        )}

        {activeTab === 'services' && (
          <ServicesTabContent
            selectedServiceId={selectedServiceId}
            onSelectService={setSelectedServiceId}
          />
        )}

        {activeTab === 'booking' && <BookingTabContent />}

        {activeTab === 'calendar' && (
          <CalendarTabContent
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
          />
        )}

        {activeTab === 'layout' && <LayoutTabContent />}

        {activeTab === 'reviews' && <ReviewsTabContent />}

        {activeTab === 'pro' && <ProTabContent />}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// TAB CONTENT COMPONENTS
// ============================================================================

// Provider Tab
interface ProviderTabContentProps {
  provider: typeof mockProvider;
}

function ProviderTabContent({ provider }: ProviderTabContentProps) {
  const { spacing } = useTheme();

  return (
    <View>
      <Section title="ProviderCard">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Card pour les résultats de recherche
        </Text>
        <ProviderCard
          photoURL={provider.photoURL}
          businessName={provider.businessName}
          category={provider.category}
          city={provider.city}
          rating={provider.rating}
          minPrice={provider.minPrice}
          onPress={() => console.log('Provider card pressed')}
        />

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Sans photo / Sans avis
        </Text>
        <ProviderCard
          photoURL={mockProviderNew.photoURL}
          businessName={mockProviderNew.businessName}
          category={mockProviderNew.category}
          city={mockProviderNew.city}
          rating={mockProviderNew.rating}
          minPrice={null}
          onPress={() => console.log('Provider card pressed')}
        />
      </Section>

      <Section title="ProviderHeader">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Hero de la fiche prestataire
        </Text>
        <Card padding="none" shadow="sm">
          <ProviderHeader
            coverPhotoURL={provider.coverPhotoURL}
            avatarURL={provider.avatarURL}
            businessName={provider.businessName}
            category={provider.category}
            rating={provider.rating}
            onRatingPress={() => console.log('Rating pressed')}
          />
        </Card>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Sans photos
        </Text>
        <Card padding="none" shadow="sm">
          <ProviderHeader
            coverPhotoURL={null}
            avatarURL={null}
            businessName="Nouveau Prestataire"
            category="Coaching"
            rating={mockProviderNew.rating}
          />
        </Card>
      </Section>

      <Section title="ProviderInfo">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Section informations
        </Text>
        <Card padding="md" shadow="sm">
          <ProviderInfo
            description={provider.description}
            address={provider.address}
            city={provider.city}
            phone={provider.phone}
          />
        </Card>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Sans description / Sans téléphone
        </Text>
        <Card padding="md" shadow="sm">
          <ProviderInfo
            description={null}
            address="20 Avenue des Champs-Élysées"
            city="Paris"
            phone={null}
          />
        </Card>
      </Section>
    </View>
  );
}

// Search Tab
interface SearchTabContentProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string | null;
  onCategorySelect: (id: string | null) => void;
  selectedCity: string | null;
  onCityChange: (city: string | null) => void;
  categories: { id: string; label: string }[];
  cities: string[];
}

function SearchTabContent({
  searchValue,
  onSearchChange,
  selectedCategory,
  onCategorySelect,
  selectedCity,
  onCityChange,
  categories,
  cities,
}: SearchTabContentProps) {
  const { spacing } = useTheme();

  return (
    <View>
      <Section title="SearchBar">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Barre de recherche avec clear
        </Text>
        <SearchBar
          value={searchValue}
          onChangeText={onSearchChange}
          placeholder="Rechercher un prestataire..."
          onSubmit={() => console.log('Search submitted:', searchValue)}
        />
      </Section>

      <Section title="CategoryPills">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Filtres par catégorie (scroll horizontal)
        </Text>
        <View style={{ marginHorizontal: -spacing.lg }}>
          <CategoryPills
            categories={categories}
            selectedId={selectedCategory}
            onSelect={onCategorySelect}
            showAll
          />
        </View>
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          Sélection: {selectedCategory || 'Toutes'}
        </Text>
      </Section>

      <Section title="CitySelect">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Sélecteur de ville (modal)
        </Text>
        <CitySelect
          value={selectedCity}
          cities={cities}
          onChange={onCityChange}
        />
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          Ville: {selectedCity || 'Toutes les villes'}
        </Text>
      </Section>
    </View>
  );
}

// Services Tab
interface ServicesTabContentProps {
  selectedServiceId: string | null;
  onSelectService: (id: string | null) => void;
}

function ServicesTabContent({ selectedServiceId, onSelectService }: ServicesTabContentProps) {
  const { spacing } = useTheme();

  return (
    <View>
      <Section title="ServiceCard">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Card prestation individuelle
        </Text>
        <View style={{ gap: spacing.sm }}>
          {mockServices.slice(0, 2).map((service) => (
            <ServiceCard
              key={service.id}
              name={service.name}
              description={service.description}
              duration={service.duration}
              price={service.price}
              selected={selectedServiceId === service.id}
              onPress={() => onSelectService(service.id)}
            />
          ))}
        </View>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Sans description
        </Text>
        <ServiceCard
          name="Brushing"
          description={null}
          duration={30}
          price={20}
        />
      </Section>

      <Section title="ServiceCategory">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Groupement par catégorie (collapsible)
        </Text>
        <View style={{ gap: spacing.lg }}>
          {mockServiceCategories.map((category, index) => (
            <ServiceCategory
              key={index}
              title={category.title}
              services={category.services}
              selectedId={selectedServiceId}
              onSelectService={onSelectService}
              collapsible
              defaultExpanded={index === 0}
            />
          ))}
        </View>
      </Section>
    </View>
  );
}

// Booking Tab
function BookingTabContent() {
  const { spacing } = useTheme();

  return (
    <View>
      <Section title="BookingStatusBadge">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Badges de statut
        </Text>
        <View style={[styles.badgeRow, { gap: spacing.sm }]}>
          <BookingStatusBadge status="pending" />
          <BookingStatusBadge status="confirmed" />
          <BookingStatusBadge status="cancelled" />
          <BookingStatusBadge status="noshow" />
        </View>
      </Section>

      <Section title="BookingCard">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Card pour liste de RDV
        </Text>
        <View style={{ gap: spacing.sm }}>
          <BookingCard
            date={mockBooking.date}
            time={mockBooking.time}
            providerName={mockBooking.provider.name}
            providerPhotoURL={mockBooking.provider.photoURL}
            serviceName={mockBooking.service.name}
            duration={mockBooking.service.duration}
            status="confirmed"
            onPress={() => console.log('Booking card pressed')}
          />
          <BookingCard
            date={new Date()}
            time="10:00"
            providerName="Autre Prestataire"
            providerPhotoURL={null}
            serviceName="Massage relaxant"
            duration={60}
            status="pending"
            onPress={() => console.log('Booking card pressed')}
          />
          <BookingCard
            date={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)}
            time="15:00"
            providerName="Studio Beauté"
            providerPhotoURL={null}
            serviceName="Coloration"
            duration={90}
            status="cancelled"
          />
        </View>
      </Section>

      <Section title="BookingDetail">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Détail d'un RDV (futur - avec annulation)
        </Text>
        <Card padding="none" shadow="sm">
          <BookingDetail
            booking={mockBooking}
            onCancel={() => console.log('Cancel booking')}
            onCall={() => console.log('Call provider')}
          />
        </Card>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          RDV passé (avec avis)
        </Text>
        <Card padding="none" shadow="sm">
          <BookingDetail
            booking={mockBookingPast}
            onReview={() => console.log('Leave review')}
          />
        </Card>
      </Section>

      <Section title="BookingRecap">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Récapitulatif avant confirmation
        </Text>
        <BookingRecap
          provider={{
            name: mockProvider.businessName,
            photoURL: mockProvider.avatarURL,
            address: mockProvider.address,
          }}
          service={mockBooking.service}
          member={mockBooking.member}
          date={mockBooking.date}
          time={mockBooking.time}
          location={mockBooking.location}
        />
      </Section>
    </View>
  );
}

// Calendar Tab
interface CalendarTabContentProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  selectedMemberId: string | null;
  onSelectMember: (id: string | null) => void;
}

function CalendarTabContent({
  selectedDate,
  onSelectDate,
  selectedTime,
  onSelectTime,
  selectedMemberId,
  onSelectMember,
}: CalendarTabContentProps) {
  const { spacing } = useTheme();

  return (
    <View>
      <Section title="CalendarStrip">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Sélection de date horizontale
        </Text>
        <View style={{ marginHorizontal: -spacing.lg }}>
          <CalendarStrip
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
          />
        </View>
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          Date: {selectedDate.toLocaleDateString('fr-FR')}
        </Text>
      </Section>

      <Section title="TimeSlotGrid">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Grille de créneaux horaires
        </Text>
        <TimeSlotGrid
          slots={mockTimeSlots}
          selectedTime={selectedTime}
          onSelectTime={onSelectTime}
        />
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          Heure: {selectedTime || 'Non sélectionnée'}
        </Text>
      </Section>

      <Section title="MemberCard">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Card membre individuelle
        </Text>
        <View style={{ gap: spacing.sm }}>
          <MemberCard
            name="Sophie Martin"
            role="Coiffeuse senior"
            avatarURL={null}
            selected={false}
            onPress={() => {}}
          />
          <MemberCard
            name="Julie Dubois"
            role="Coloriste"
            avatarURL={null}
            selected={true}
            onPress={() => {}}
          />
        </View>
      </Section>

      <Section title="MemberPicker">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Sélecteur de membre avec "Peu importe"
        </Text>
        <MemberPicker
          members={mockMembers}
          selectedId={selectedMemberId}
          onSelect={onSelectMember}
          allowAny
        />
      </Section>

      <Section title="StickyFooter">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Footer fixe avec CTA (aperçu)
        </Text>
        <Card padding="none" shadow="sm">
          <View style={{ padding: spacing.md }}>
            <Button variant="primary" onPress={() => console.log('Confirm')} title="Confirmer la réservation" />
          </View>
        </Card>
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          Note: Le StickyFooter réel est positionné en absolute bottom
        </Text>
      </Section>
    </View>
  );
}

// Layout Tab
function LayoutTabContent() {
  const { colors, spacing, radius } = useTheme();

  return (
    <View>
      <Section title="EmptyState">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Avec bouton d'action
        </Text>
        <EmptyState
          icon="search-outline"
          title="Aucun résultat"
          description="Essayez de modifier vos critères de recherche"
          actionLabel="Modifier la recherche"
          onAction={() => console.log('Modify search')}
        />

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Sans action
        </Text>
        <EmptyState
          icon="calendar-outline"
          title="Pas de réservations"
          description="Vos prochaines réservations apparaîtront ici"
        />

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Favoris vides
        </Text>
        <EmptyState
          icon="heart-outline"
          title="Aucun favori"
          description="Ajoutez des prestataires à vos favoris pour les retrouver facilement"
          actionLabel="Découvrir"
          onAction={() => console.log('Discover')}
        />
      </Section>

      <Section title="ScreenHeader">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Aperçu réaliste d'un écran
        </Text>
        {/* Simulated screen container */}
        <View
          style={{
            borderRadius: radius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScreenHeader
            title="Mes réservations"
            leftAction={{
              icon: <Ionicons name="arrow-back" size={24} color={colors.text} />,
              onPress: () => console.log('Back'),
              accessibilityLabel: 'Retour',
            }}
            rightAction={{
              icon: <Ionicons name="add" size={24} color={colors.text} />,
              onPress: () => console.log('Add'),
              accessibilityLabel: 'Ajouter',
            }}
            safeArea={false}
          />
          {/* Simulated content */}
          <View style={{ padding: spacing.md, backgroundColor: colors.surfaceSecondary, minHeight: 120 }}>
            <Text variant="caption" color="textMuted" align="center">
              Contenu de l'écran...
            </Text>
          </View>
        </View>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Sans actions
        </Text>
        <View
          style={{
            borderRadius: radius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScreenHeader title="Profil" safeArea={false} />
          <View style={{ padding: spacing.md, backgroundColor: colors.surfaceSecondary, minHeight: 80 }}>
            <Text variant="caption" color="textMuted" align="center">
              Contenu...
            </Text>
          </View>
        </View>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Action droite seulement
        </Text>
        <View
          style={{
            borderRadius: radius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScreenHeader
            title="Paramètres"
            rightAction={{
              icon: <Ionicons name="settings-outline" size={24} color={colors.text} />,
              onPress: () => console.log('Settings'),
              accessibilityLabel: 'Paramètres',
            }}
            safeArea={false}
          />
          <View style={{ padding: spacing.md, backgroundColor: colors.surfaceSecondary, minHeight: 80 }}>
            <Text variant="caption" color="textMuted" align="center">
              Contenu...
            </Text>
          </View>
        </View>
      </Section>
    </View>
  );
}

// Reviews Tab
function ReviewsTabContent() {
  const { colors, spacing } = useTheme();
  const [inputRating, setInputRating] = useState(0);

  return (
    <View>
      <Section title="StarRating">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Affichage de note (lecture seule)
        </Text>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color="textMuted" style={{ width: 60 }}>Size sm:</Text>
            <StarRating rating={4.5} size="sm" showValue />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color="textMuted" style={{ width: 60 }}>Size md:</Text>
            <StarRating rating={4.5} size="md" showValue />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color="textMuted" style={{ width: 60 }}>Size lg:</Text>
            <StarRating rating={4.5} size="lg" showValue />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color="textMuted" style={{ width: 60 }}>3 stars:</Text>
            <StarRating rating={3} size="md" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color="textMuted" style={{ width: 60 }}>0 stars:</Text>
            <StarRating rating={0} size="md" />
          </View>
        </View>
      </Section>

      <Section title="StarRatingInput">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Saisie de note (interactive)
        </Text>
        <Card padding="lg" shadow="sm">
          <Text variant="label" color="textSecondary" align="center" style={{ marginBottom: spacing.md }}>
            Votre note : {inputRating > 0 ? inputRating : '-'}
          </Text>
          <StarRatingInput
            value={inputRating}
            onChange={setInputRating}
            size="lg"
          />
        </Card>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Taille moyenne
        </Text>
        <Card padding="md" shadow="sm">
          <StarRatingInput
            value={3}
            onChange={() => {}}
            size="md"
          />
        </Card>

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Désactivé
        </Text>
        <Card padding="md" shadow="sm">
          <StarRatingInput
            value={4}
            onChange={() => {}}
            size="md"
            disabled
          />
        </Card>
      </Section>

      <Section title="RatingStats">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Statistiques globales des avis
        </Text>
        <Card padding="lg" shadow="sm">
          <RatingStats
            average={mockRatingStats.average}
            count={mockRatingStats.count}
            distribution={mockRatingStats.distribution}
          />
        </Card>
      </Section>

      <Section title="ReviewCard">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Avis avec réponse
        </Text>
        <ReviewCard
          authorName={mockReviews[0].authorName}
          rating={mockReviews[0].rating}
          comment={mockReviews[0].comment}
          date={mockReviews[0].date}
          reply={mockReviews[0].reply}
        />

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Avis sans réponse
        </Text>
        <ReviewCard
          authorName={mockReviews[1].authorName}
          rating={mockReviews[1].rating}
          comment={mockReviews[1].comment}
          date={mockReviews[1].date}
          reply={mockReviews[1].reply}
        />

        <Text
          variant="label"
          color="textSecondary"
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
        >
          Avis sans commentaire
        </Text>
        <ReviewCard
          authorName={mockReviews[2].authorName}
          rating={mockReviews[2].rating}
          comment={mockReviews[2].comment}
          date={mockReviews[2].date}
          reply={mockReviews[2].reply}
        />
      </Section>
    </View>
  );
}

// Pro Tab
function ProTabContent() {
  const { colors, spacing, radius } = useTheme();

  return (
    <View>
      <Section title="StatCard">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Cards de stats pour le dashboard Pro
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {mockProStats.map((stat, index) => (
            <View key={index} style={{ width: '47%' }}>
              <StatCard
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                trend={stat.trend}
                onPress={() => console.log('Stat pressed:', stat.label)}
              />
            </View>
          ))}
        </View>
      </Section>

      <Section title="DaySchedule">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Vue calendrier jour
        </Text>
        <Card padding="none" shadow="sm">
          <View style={{ height: 400 }}>
            <DaySchedule
              date={new Date()}
              bookings={mockDayBookings}
              workingHours={{ start: '09:00', end: '16:00' }}
              onBookingPress={(id) => console.log('Booking pressed:', id)}
            />
          </View>
        </Card>
      </Section>

      <Section title="BookingListItem">
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
          Liste compacte des RDV
        </Text>
        <Card padding="none" shadow="sm">
          {mockDayBookings.map((booking) => (
            <BookingListItem
              key={booking.id}
              time={booking.startTime}
              clientName={booking.clientName}
              serviceName={booking.serviceName}
              duration={
                (parseInt(booking.endTime.split(':')[0]) * 60 + parseInt(booking.endTime.split(':')[1])) -
                (parseInt(booking.startTime.split(':')[0]) * 60 + parseInt(booking.startTime.split(':')[1]))
              }
              status={booking.status}
              onPress={() => console.log('Booking pressed:', booking.id)}
              onConfirm={booking.status === 'pending' ? () => console.log('Confirm:', booking.id) : undefined}
              onCancel={booking.status === 'pending' ? () => console.log('Cancel:', booking.id) : undefined}
            />
          ))}
        </Card>
      </Section>
    </View>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const { colors, spacing } = useTheme();

  return (
    <View style={{ marginBottom: spacing['3xl'] }}>
      <Text
        variant="h2"
        style={{
          marginBottom: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabsContainer: {
    borderBottomWidth: 1,
  },
  tab: {
    // styles applied dynamically
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
