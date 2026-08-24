import {
  demoProvider,
  demoLocations,
  demoMembers,
  demoAvailabilities,
  demoBookingProvider,
  demoBookingLocations,
  demoBookingMembers,
  demoBookingAvailabilities,
} from '@/app/p/[slug]/demoData';
import { PROVIDER_THEMES, DEFAULT_THEME_ID } from '@booking-app/shared';
import type { DemoConfig } from './sales-demo';

/**
 * Transforme une config de démo (le JSON validé) en jeux de données pour la
 * page publique ET le tunnel de réservation.
 *
 * S'ADOSSE À demoData : tout ce qui ne vient pas du prospect — lieu, membre,
 * horaires génériques, photos d'ambiance — est repris de la démo générique,
 * qui fonctionne déjà sans la moindre écriture Firestore. Seuls le nom, le
 * thème, la ville et les prestations changent. Une seule source pour les
 * squelettes : si demoData évolue, la démo personnalisée suit.
 *
 * Démo SOLO volontairement : un seul membre, un seul lieu. La démo générique
 * /p/demo reste la vitrine du mode équipe.
 */

const membreSolo = demoMembers[0];
const lieuUnique = demoLocations[0];

function themeValide(themeId: string | undefined): string {
  return PROVIDER_THEMES.some((t) => t.id === themeId) ? (themeId as string) : DEFAULT_THEME_ID;
}

export function buildDemoData(config: DemoConfig, demoId: string) {
  const slug = `demo-${demoId}`;

  const categories = config.categories.map((c, i) => ({
    id: `democat-${i}`,
    name: c.name,
    sortOrder: i,
  }));

  const services = config.categories.flatMap((c, ci) =>
    c.services.map((s, si) => ({
      id: `demosvc-${ci}-${si}`,
      name: s.name,
      description: s.description ?? '',
      duration: s.duration,
      price: s.price,
      bufferTime: 10,
      categoryId: `democat-${ci}`,
      locationIds: [lieuUnique.id],
      memberIds: null as string[] | null,
      variations: s.variations?.map((v, vi) => ({
        id: `demosvc-${ci}-${si}-var-${vi}`,
        name: v.name,
        options: v.options.map((o, oi) => ({
          id: `demosvc-${ci}-${si}-var-${vi}-opt-${oi}`,
          name: o.name,
          price: o.price,
          duration: o.duration ?? s.duration,
        })),
      })),
    })),
  );

  const minPrice = Math.min(...services.map((s) => s.price));

  // Avis d'EXEMPLE, clairement étiquetés — décision produit : montrer le
  // module avis sans jamais laisser croire à de vrais avis du prospect.
  const reviews = [
    {
      id: 'demo-rev-ex-1', providerId: slug, bookingId: 'x', clientId: null,
      memberId: membreSolo.id, clientName: 'Avis d’exemple — Léa', clientPhoto: null,
      rating: 5, comment: 'Ceci est un avis fictif : vos clientes pourront laisser le leur après chaque rendez-vous.',
      isPublic: true, createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    },
    {
      id: 'demo-rev-ex-2', providerId: slug, bookingId: 'x', clientId: null,
      memberId: membreSolo.id, clientName: 'Avis d’exemple — Sonia', clientPhoto: null,
      rating: 5, comment: 'Exemple d’avis client. Les avis sont collectés automatiquement par Opatam.',
      isPublic: true, createdAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
    },
  ];

  const provider = {
    ...demoProvider,
    id: slug,
    slug,
    plan: 'solo',
    teamTier: false,
    businessName: config.businessName,
    description: config.description || `Bienvenue chez ${config.businessName}.`,
    category: config.sector || demoProvider.category,
    themeId: themeValide(config.themeId),
    rating: { average: 5, count: reviews.length, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: reviews.length } },
  };

  const locations = [
    { ...lieuUnique, city: config.city || lieuUnique.city },
  ];
  const members = [membreSolo];
  const availabilities = demoAvailabilities.filter((a) => a.memberId === membreSolo.id);

  // ── Formes tunnel (dérivées, même motif que demoBooking*) ──
  const bookingProvider = {
    ...demoBookingProvider,
    id: slug,
    slug,
    plan: 'solo',
    teamTier: false,
    businessName: config.businessName,
  };
  const bookingServices = services.map((s) => ({
    id: s.id, name: s.name, description: s.description, duration: s.duration,
    price: s.price, bufferTime: s.bufferTime, categoryId: s.categoryId,
    locationIds: s.locationIds, memberIds: s.memberIds, variations: s.variations,
    options: undefined,
  }));
  const bookingCategories = categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }));
  const bookingLocations = [{ ...demoBookingLocations[0], city: config.city || demoBookingLocations[0].city }];
  const bookingMembers = demoBookingMembers.filter((m) => m.id === membreSolo.id);
  const bookingAvailabilities = demoBookingAvailabilities.filter((a) => a.memberId === membreSolo.id);

  return {
    page: { provider, services, categories, locations, members, reviews, availabilities, minPrice },
    booking: {
      provider: bookingProvider,
      services: bookingServices,
      categories: bookingCategories,
      locations: bookingLocations,
      members: bookingMembers,
      availabilities: bookingAvailabilities,
    },
  };
}
