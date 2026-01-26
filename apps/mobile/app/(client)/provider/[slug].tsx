/**
 * Provider Detail Screen
 * Full provider profile with services, reviews, and booking CTA
 * TODO: Connect to Firebase when ready
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  ProviderHeader,
  ProviderInfo,
  ServiceCategory,
  RatingStats,
  ReviewCard,
  StickyFooter,
  Button,
  EmptyState,
  useToast,
} from '../../../components';
import type { Rating } from '@booking-app/shared';

// Mock types
interface MockProvider {
  id: string;
  slug: string;
  businessName: string;
  description: string;
  category: string;
  photoURL: string | null;
  coverPhotoURL: string | null;
  rating: Rating;
  address: string;
  city: string;
  phone: string | null;
}

interface MockService {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  category: string;
}

interface MockReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  date: Date;
}

// Mock data
const mockProvidersData: Record<string, MockProvider> = {
  'studio-beaute-paris': {
    id: '1',
    slug: 'studio-beaute-paris',
    businessName: 'Studio Beauté Paris',
    description: 'Studio de coiffure et beauté situé au coeur de Paris. Notre équipe de professionnels vous accueille dans un cadre chaleureux et moderne pour toutes vos envies capillaires.',
    category: 'Coiffure',
    photoURL: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
    coverPhotoURL: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
    rating: { average: 4.8, count: 124, distribution: { 1: 2, 2: 3, 3: 8, 4: 25, 5: 86 } },
    address: '15 Rue de la Paix',
    city: 'Paris 75002',
    phone: '+33 1 42 68 53 00',
  },
  'zen-massage': {
    id: '2',
    slug: 'zen-massage',
    businessName: 'Zen Massage',
    description: 'Centre de massage et bien-être. Découvrez nos soins relaxants pour retrouver sérénité et équilibre.',
    category: 'Massage',
    photoURL: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400',
    coverPhotoURL: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800',
    rating: { average: 4.9, count: 89, distribution: { 1: 1, 2: 1, 3: 5, 4: 12, 5: 70 } },
    address: '28 Avenue Victor Hugo',
    city: 'Paris 75016',
    phone: '+33 1 45 00 12 34',
  },
  'coach-fitness-pro': {
    id: '3',
    slug: 'coach-fitness-pro',
    businessName: 'Coach Fitness Pro',
    description: 'Coaching sportif personnalisé. Atteignez vos objectifs avec un accompagnement sur mesure.',
    category: 'Coaching',
    photoURL: null,
    coverPhotoURL: null,
    rating: { average: 4.7, count: 56, distribution: { 1: 0, 2: 2, 3: 4, 4: 15, 5: 35 } },
    address: '5 Place Bellecour',
    city: 'Lyon 69002',
    phone: '+33 4 78 00 00 00',
  },
  'beaute-naturelle': {
    id: '4',
    slug: 'beaute-naturelle',
    businessName: 'Beauté Naturelle',
    description: 'Institut de beauté bio et naturel. Soins du visage et du corps avec des produits 100% naturels.',
    category: 'Beauté',
    photoURL: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400',
    coverPhotoURL: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
    rating: { average: 4.6, count: 78, distribution: { 1: 1, 2: 2, 3: 6, 4: 20, 5: 49 } },
    address: '12 Rue de la République',
    city: 'Lyon 69001',
    phone: '+33 4 72 00 00 00',
  },
  'spa-wellness': {
    id: '5',
    slug: 'spa-wellness',
    businessName: 'Spa & Wellness',
    description: 'Spa haut de gamme proposant une gamme complète de soins relaxants et revitalisants.',
    category: 'Massage',
    photoURL: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400',
    coverPhotoURL: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
    rating: { average: 4.5, count: 45, distribution: { 1: 0, 2: 1, 3: 4, 4: 15, 5: 25 } },
    address: '45 Boulevard Longchamp',
    city: 'Marseille 13001',
    phone: '+33 4 91 00 00 00',
  },
};

const mockServicesData: Record<string, MockService[]> = {
  'studio-beaute-paris': [
    { id: '1', name: 'Coupe femme', description: 'Coupe, shampoing et brushing', duration: 45, price: 3500, category: 'Coupes' },
    { id: '2', name: 'Coupe homme', description: 'Coupe classique', duration: 30, price: 2500, category: 'Coupes' },
    { id: '3', name: 'Coloration', description: 'Coloration complète avec soin', duration: 90, price: 6500, category: 'Couleurs' },
    { id: '4', name: 'Mèches', description: 'Mèches ou balayage', duration: 120, price: 8500, category: 'Couleurs' },
    { id: '5', name: 'Brushing', description: null, duration: 30, price: 2000, category: 'Coiffage' },
  ],
  'zen-massage': [
    { id: '1', name: 'Massage relaxant', description: 'Massage du corps entier aux huiles essentielles', duration: 60, price: 7000, category: 'Massages' },
    { id: '2', name: 'Massage sportif', description: 'Massage profond pour sportifs', duration: 45, price: 6000, category: 'Massages' },
    { id: '3', name: 'Réflexologie', description: 'Massage des pieds et zones réflexes', duration: 45, price: 5500, category: 'Soins' },
  ],
  'coach-fitness-pro': [
    { id: '1', name: 'Séance individuelle', description: 'Coaching personnalisé 1h', duration: 60, price: 5000, category: 'Coaching' },
    { id: '2', name: 'Programme mensuel', description: '4 séances par mois', duration: 60, price: 18000, category: 'Forfaits' },
  ],
  'beaute-naturelle': [
    { id: '1', name: 'Soin visage', description: 'Nettoyage et hydratation bio', duration: 60, price: 5500, category: 'Visage' },
    { id: '2', name: 'Gommage corps', description: 'Exfoliation naturelle', duration: 45, price: 4500, category: 'Corps' },
  ],
  'spa-wellness': [
    { id: '1', name: 'Forfait détente', description: 'Accès spa + massage', duration: 120, price: 12000, category: 'Forfaits' },
    { id: '2', name: 'Soin signature', description: 'Notre soin exclusif', duration: 90, price: 9500, category: 'Soins' },
  ],
};

const mockReviewsData: Record<string, MockReview[]> = {
  'studio-beaute-paris': [
    { id: '1', authorName: 'Marie Dupont', rating: 5, comment: "Excellente prestation ! Sophie est très professionnelle et à l'écoute.", date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { id: '2', authorName: 'Jean Martin', rating: 4, comment: "Très bon service, juste un peu d'attente à l'arrivée.", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    { id: '3', authorName: 'Lucie Bernard', rating: 5, comment: null, date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
  ],
  'zen-massage': [
    { id: '1', authorName: 'Pierre Leroy', rating: 5, comment: 'Un moment de pure détente. Je recommande vivement !', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { id: '2', authorName: 'Sophie Martin', rating: 5, comment: 'Excellent massage, très relaxant.', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
  ],
  'coach-fitness-pro': [
    { id: '1', authorName: 'Thomas Durand', rating: 5, comment: "Super coach ! J'ai atteint mes objectifs.", date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
  ],
  'beaute-naturelle': [
    { id: '1', authorName: 'Emma Petit', rating: 4, comment: 'Très bons produits naturels.', date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
  ],
  'spa-wellness': [
    { id: '1', authorName: 'Claire Moreau', rating: 5, comment: 'Une expérience incroyable !', date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
  ],
};

// Group services by category
function groupServicesByCategory(services: MockService[]): { title: string; services: MockService[] }[] {
  const grouped: Record<string, MockService[]> = {};

  for (const service of services) {
    const category = service.category || 'Autres';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(service);
  }

  return Object.entries(grouped).map(([title, services]) => ({
    title,
    services,
  }));
}

export default function ProviderDetailScreen() {
  const { colors, spacing } = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  // Data state
  const [provider, setProvider] = useState<MockProvider | null>(null);
  const [services, setServices] = useState<MockService[]>([]);
  const [reviews, setReviews] = useState<MockReview[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  // Loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load provider data (mock)
  const loadData = useCallback(async (isRefresh = false) => {
    if (!slug) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Get mock data
      const providerData = mockProvidersData[slug];
      if (!providerData) {
        setError('Prestataire non trouvé');
        return;
      }
      setProvider(providerData);
      setServices(mockServicesData[slug] || []);
      setReviews(mockReviewsData[slug] || []);
    } catch (err) {
      console.error('Error loading provider:', err);
      setError('Erreur lors du chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [slug]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle refresh
  const handleRefresh = () => {
    loadData(true);
  };

  // Handle service selection
  const handleSelectService = (serviceId: string | null) => {
    setSelectedServiceId(serviceId);
  };

  // Handle booking
  const handleBooking = () => {
    if (!selectedServiceId) {
      showToast({
        variant: 'warning',
        message: 'Sélectionnez une prestation',
      });
      return;
    }

    // For now, show login message
    showToast({
      variant: 'info',
      message: 'Connectez-vous pour réserver',
    });
  };

  // Group services by category
  const serviceCategories = groupServicesByCategory(services);

  // Get selected service
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="body" color="textSecondary" style={{ marginTop: spacing.md }}>
          Chargement...
        </Text>
      </View>
    );
  }

  // Error state
  if (error || !provider) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Erreur"
          description={error || 'Prestataire non trouvé'}
          actionLabel="Retour"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Provider Header */}
        <ProviderHeader
          coverPhotoURL={provider.coverPhotoURL}
          avatarURL={provider.photoURL}
          businessName={provider.businessName}
          category={provider.category}
          rating={provider.rating}
        />

        {/* Provider Info */}
        <View style={{ padding: spacing.lg }}>
          <Card padding="md" shadow="sm">
            <ProviderInfo
              description={provider.description}
              address={provider.address}
              city={provider.city}
              phone={provider.phone}
            />
          </Card>
        </View>

        {/* Services */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="h2" style={{ marginBottom: spacing.md }}>
            Prestations
          </Text>
          {services.length === 0 ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="cut-outline"
                title="Aucune prestation"
                description="Ce prestataire n'a pas encore de prestations"
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.lg }}>
              {serviceCategories.map((category, index) => (
                <ServiceCategory
                  key={index}
                  title={category.title}
                  services={category.services.map((s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    duration: s.duration,
                    price: s.price / 100, // Convert cents to euros
                  }))}
                  selectedId={selectedServiceId}
                  onSelectService={handleSelectService}
                  collapsible
                  defaultExpanded={index === 0}
                />
              ))}
            </View>
          )}
        </View>

        {/* Reviews */}
        <View style={{ padding: spacing.lg }}>
          <Text variant="h2" style={{ marginBottom: spacing.md }}>
            Avis
          </Text>

          {/* Rating Stats */}
          {provider.rating.count > 0 && (
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <RatingStats
                average={provider.rating.average}
                count={provider.rating.count}
                distribution={provider.rating.distribution}
              />
            </Card>
          )}

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="chatbubble-outline"
                title="Aucun avis"
                description="Ce prestataire n'a pas encore d'avis"
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  authorName={review.authorName}
                  rating={review.rating}
                  comment={review.comment}
                  date={review.date}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <StickyFooter>
        <View style={styles.footerContent}>
          {selectedService && (
            <View style={{ marginBottom: spacing.sm }}>
              <Text variant="caption" color="textSecondary">
                {selectedService.name} - {selectedService.duration} min
              </Text>
              <Text variant="h3" color="primary">
                {(selectedService.price / 100).toFixed(2)} €
              </Text>
            </View>
          )}
          <Button
            variant="primary"
            title={selectedService ? 'Réserver' : 'Sélectionnez une prestation'}
            onPress={handleBooking}
            disabled={!selectedServiceId}
          />
        </View>
      </StickyFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  footerContent: {
    // Dynamic styles
  },
});
