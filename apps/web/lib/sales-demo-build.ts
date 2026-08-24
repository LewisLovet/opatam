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
import { themeDepuisCouleur } from './sales-demo-theme';
import { prixEffectif, type DemoConfig } from './sales-demo';

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

function themeValide(themeId: string | undefined): boolean {
  return PROVIDER_THEMES.some((t) => t.id === themeId);
}

/** themeId explicite > couleur de marque relevée par l'IA > défaut. */
function resoudreTheme(config: DemoConfig): string {
  if (themeValide(config.themeId)) return config.themeId as string;
  if (config.brandColor) return themeDepuisCouleur(config.brandColor);
  return DEFAULT_THEME_ID;
}

// ── Images par secteur ──────────────────────────────────────────────────────
// Le prompt impose un secteur parmi une liste fermée ; chaque secteur a son
// jeu de photos (couverture, portrait, galerie) pour que la démo d'un barbier
// ne s'ouvre pas sur un salon de coiffure féminin. URLs toutes vérifiées
// (contenu inclus) le 2026-08-24. « coiffure » et le repli « autre » gardent
// les photos de la démo générique, déjà en production.

const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

interface JeuImages {
  cover: string;
  portrait: string;
  galerie: string[];
}

const IMAGES_PAR_SECTEUR: Record<string, JeuImages> = {
  barbier: {
    cover: unsplash('photo-1585747860715-2ba37e788b70', 1200), // intérieur barbershop
    portrait: unsplash('photo-1622287162716-f311baa1a2b8', 200), // barbier en action
    galerie: [
      unsplash('photo-1503951914875-452162b0f3f1', 600), // rasage
      unsplash('photo-1587909209111-5097ee578ec3', 600), // outils
      unsplash('photo-1622287162716-f311baa1a2b8', 600),
    ],
  },
  ongles: {
    cover: unsplash('photo-1610992015732-2449b76344bc', 1200), // manucure claire
    portrait: unsplash('photo-1604654894610-df63bc536371', 200),
    galerie: [
      unsplash('photo-1519014816548-bf5fe059798b', 600), // ongles rouges
      unsplash('photo-1604654894610-df63bc536371', 600),
      unsplash('photo-1610992015732-2449b76344bc', 600),
    ],
  },
  esthetique: {
    cover: unsplash('photo-1570172619644-dfd03ed5d881', 1200), // soin visage
    portrait: unsplash('photo-1616394584738-fc6e612e71b9', 200),
    galerie: [
      unsplash('photo-1570172619644-dfd03ed5d881', 600),
      unsplash('photo-1616394584738-fc6e612e71b9', 600),
      unsplash('photo-1540555700478-4be289fbecef', 600), // produits spa
    ],
  },
  maquillage: {
    cover: unsplash('photo-1487412947147-5cebf100ffc2', 1200), // mise en beauté
    portrait: unsplash('photo-1487412947147-5cebf100ffc2', 200),
    galerie: [
      unsplash('photo-1512496015851-a90fb38ba796', 600), // palette
      unsplash('photo-1596462502278-27bfdc403348', 600), // produits
      unsplash('photo-1487412947147-5cebf100ffc2', 600),
    ],
  },
  massage: {
    cover: unsplash('photo-1544161515-4ab6ce6db874', 1200), // massage huile
    portrait: unsplash('photo-1600334129128-685c5582fd35', 200),
    galerie: [
      unsplash('photo-1544161515-4ab6ce6db874', 600),
      unsplash('photo-1600334129128-685c5582fd35', 600), // pierres chaudes
      unsplash('photo-1540555700478-4be289fbecef', 600),
    ],
  },
  tatouage: {
    cover: unsplash('photo-1565058379802-bbe93b2f703a', 1200), // tatoueur au travail
    portrait: unsplash('photo-1598371839696-5c5bb00bdc28', 200),
    galerie: [
      unsplash('photo-1565058379802-bbe93b2f703a', 600),
      unsplash('photo-1611501275019-9b5cda994e8d', 600),
      unsplash('photo-1598371839696-5c5bb00bdc28', 600),
    ],
  },
};

/** Couverture représentative d'une démo — la photo téléversée, sinon celle du
 *  secteur, sinon celle de la démo générique. Sert au visuel de l'e-mail et
 *  aux vignettes de l'interface commerciale. */
export function couvertureDemo(sector: string | undefined, coverPerso?: string | null): string {
  if (coverPerso) return coverPerso;
  return imagesDuSecteur(sector)?.cover ?? (demoProvider.coverPhotoURL as string);
}

/** « Barbier », « barber shop » → barbier. Secteur inconnu → photos génériques. */
function imagesDuSecteur(sector: string | undefined): JeuImages | null {
  if (!sector) return null;
  const cle = sector
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  for (const [nom, jeu] of Object.entries(IMAGES_PAR_SECTEUR)) {
    if (cle.includes(nom) || (nom === 'ongles' && /nail|manucure|onglerie/.test(cle))) return jeu;
  }
  if (/barber/.test(cle)) return IMAGES_PAR_SECTEUR.barbier;
  if (/spa|bien.?etre/.test(cle)) return IMAGES_PAR_SECTEUR.massage;
  if (/tattoo/.test(cle)) return IMAGES_PAR_SECTEUR.tatouage;
  return null;
}

export function buildDemoData(
  config: DemoConfig,
  demoId: string,
  photos: { logo?: string; cover?: string } = {},
) {
  const slug = `demo-${demoId}`;

  // Les prestations « sur devis » (sans prix exploitable) sont écartées : la
  // page les afficherait « Gratuit ». L'aperçu du commercial les signale
  // avant création. Une catégorie vidée disparaît avec ses prestations.
  const categoriesUtiles = config.categories
    .map((c) => ({ ...c, services: c.services.filter((s) => prixEffectif(s) !== null) }))
    .filter((c) => c.services.length > 0);

  const categories = categoriesUtiles.map((c, i) => ({
    id: `democat-${i}`,
    name: c.name,
    sortOrder: i,
  }));

  const services = categoriesUtiles.flatMap((c, ci) =>
    c.services.map((s, si) => ({
      id: `demosvc-${ci}-${si}`,
      name: s.name,
      description: s.description ?? '',
      duration: s.duration,
      price: prixEffectif(s) as number,
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
      // Suppléments : prix et minutes AJOUTÉS — une durée absente n'allonge
      // pas le rendez-vous (0), contrairement aux variations où elle retombe
      // sur la durée de la prestation (valeur absolue).
      options: s.options?.map((o, oi) => ({
        id: `demosvc-${ci}-${si}-sup-${oi}`,
        name: o.name,
        description: null,
        price: o.price,
        duration: o.duration ?? 0,
        nestedVariations: [],
        nestedInfoFields: [],
      })),
    })),
  );

  const minPrice = services.length ? Math.min(...services.map((s) => s.price)) : 0;

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

  const images = imagesDuSecteur(config.sector);
  const provider = {
    ...demoProvider,
    id: slug,
    slug,
    plan: 'solo',
    teamTier: false,
    businessName: config.businessName,
    description: config.description || `Bienvenue chez ${config.businessName}.`,
    category: config.sector || demoProvider.category,
    themeId: resoudreTheme(config),
    ...(images
      ? {
          photoURL: images.portrait,
          coverPhotoURL: images.cover,
          portfolioPhotos: images.galerie,
        }
      : {}),
    // Les photos téléversées par le commercial priment sur tout : le logo
    // remplace le portrait, la couverture remplace celle du secteur.
    ...(photos.logo ? { photoURL: photos.logo } : {}),
    ...(photos.cover ? { coverPhotoURL: photos.cover } : {}),
    rating: { average: 5, count: reviews.length, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: reviews.length } },
  };

  // Le lieu porte le NOM DU PROSPECT, pas celui de la démo générique — c'est
  // ce qui s'affiche dans le récapitulatif de réservation. Ville remplacée →
  // code postal retiré (un « 75008 Lyon » se remarque immédiatement).
  const locations = [
    {
      ...lieuUnique,
      name: config.businessName,
      city: config.city || lieuUnique.city,
      ...(config.city ? { postalCode: '' } : {}),
    },
  ];
  // Même cohérence pour le visage : sur une démo barbier, le portrait
  // sectoriel remplace la coiffeuse de la démo générique.
  const members = [
    images ? { ...membreSolo, photoURL: images.portrait } : membreSolo,
  ];
  const availabilities = demoAvailabilities.filter((a) => a.memberId === membreSolo.id);

  // ── Formes tunnel (dérivées, même motif que demoBooking*) ──
  const bookingProvider = {
    ...demoBookingProvider,
    id: slug,
    slug,
    plan: 'solo',
    teamTier: false,
    businessName: config.businessName,
    themeId: provider.themeId,
  };
  const bookingServices = services.map((s) => ({
    id: s.id, name: s.name, description: s.description, duration: s.duration,
    price: s.price, bufferTime: s.bufferTime, categoryId: s.categoryId,
    locationIds: s.locationIds, memberIds: s.memberIds, variations: s.variations,
    options: s.options,
  }));
  const bookingCategories = categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder }));
  const bookingLocations = [
    {
      ...demoBookingLocations[0],
      name: config.businessName,
      city: config.city || demoBookingLocations[0].city,
      ...(config.city ? { postalCode: '' } : {}),
    },
  ];
  const bookingMembers = demoBookingMembers
    .filter((m) => m.id === membreSolo.id)
    .map((m) => (images ? { ...m, photoURL: images.portrait } : m));
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
