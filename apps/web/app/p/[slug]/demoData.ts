/**
 * Mock data for the demo provider page (/p/demo)
 * Showcases a realistic beauty salon with multiple services, team members, and reviews
 * Photos: Unsplash (free to use, no attribution required)
 */

const now = new Date().toISOString();

// IDs
const PROVIDER_ID = 'demo-provider';
const LOCATION_1_ID = 'demo-loc-1';
const MEMBER_1_ID = 'demo-member-1';
const MEMBER_2_ID = 'demo-member-2';
const MEMBER_3_ID = 'demo-member-3';
const CATEGORY_1_ID = 'demo-cat-1';
const CATEGORY_2_ID = 'demo-cat-2';
const CATEGORY_3_ID = 'demo-cat-3';
const CATEGORY_4_ID = 'demo-cat-4';
const CATEGORY_5_ID = 'demo-cat-5';

// Unsplash image helper — optimized size params
const unsplash = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const demoProvider = {
  id: PROVIDER_ID,
  userId: 'demo-user',
  plan: 'team',
  businessName: 'Studio Beauté Élégance',
  description:
    'Salon de coiffure et esthétique au cœur de Paris. Nos experts prennent soin de vous dans un cadre chaleureux et moderne.',
  category: 'Coiffure & Esthétique',
  slug: 'demo',
  photoURL: unsplash('photo-1560066984-138dadb4c035', 200), // Woman hairstylist portrait
  coverPhotoURL: unsplash('photo-1633681926022-84c23e8cb2d6', 1200), // Salon interior
  portfolioPhotos: [
    unsplash('photo-1522337360788-8b13dee7a37e', 600), // Hair styling
    unsplash('photo-1595476108010-b4d1f102b1b1', 600), // Hair coloring
    unsplash('photo-1605497788044-5a32c7078486', 600), // Hair styling result
    unsplash('photo-1519699047748-de8e457a634e', 600), // Manicure
    unsplash('photo-1457972729786-0411a3b2b626', 600), // Salon ambiance
    unsplash('photo-1521590832167-7bcbfaa6381f', 600), // Hair care
  ],
  socialLinks: {
    instagram: 'https://www.instagram.com/opatam_app',
    facebook: 'https://facebook.com/opatam',
    tiktok: 'https://tiktok.com/@opatam',
    website: 'https://opatam.com',
  },
  rating: {
    average: 4.8,
    count: 127,
    distribution: { 1: 1, 2: 2, 3: 5, 4: 18, 5: 101 },
  },
  isPublished: true,
  isVerified: true,
  createdAt: now,
  updatedAt: now,
};

export const demoServiceCategories = [
  {
    id: CATEGORY_1_ID,
    name: 'Coiffure',
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: CATEGORY_2_ID,
    name: 'Coloration',
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: CATEGORY_3_ID,
    name: 'Ongles',
    sortOrder: 2,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: CATEGORY_4_ID,
    name: 'Soins visage',
    sortOrder: 3,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: CATEGORY_5_ID,
    name: 'Épilation',
    sortOrder: 4,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];

export const demoServices = [
  {
    id: 'demo-svc-1',
    name: 'Coupe femme',
    description: 'Shampoing, coupe et brushing personnalisé',
    duration: 45,
    price: 3500,
    bufferTime: 10,
    categoryId: CATEGORY_1_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: null,
    isActive: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-2',
    name: 'Coupe homme',
    description: 'Coupe tendance avec finitions soignées',
    duration: 30,
    price: 2500,
    bufferTime: 5,
    categoryId: CATEGORY_1_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: null,
    isActive: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-3',
    name: 'Coloration complète',
    description: 'Coloration professionnelle avec produits premium',
    duration: 90,
    price: 6500,
    bufferTime: 15,
    categoryId: CATEGORY_2_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_1_ID, MEMBER_2_ID],
    isActive: true,
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-4',
    name: 'Balayage',
    description: 'Technique de coloration naturelle pour un effet soleil',
    duration: 120,
    price: 8500,
    bufferTime: 15,
    categoryId: CATEGORY_2_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_1_ID, MEMBER_2_ID],
    isActive: true,
    sortOrder: 3,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-5',
    name: 'Soin capillaire profond',
    description: 'Traitement réparateur et nourrissant pour cheveux abîmés',
    duration: 30,
    price: 2000,
    bufferTime: 5,
    categoryId: CATEGORY_1_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: null,
    isActive: true,
    sortOrder: 4,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-6',
    name: 'Manucure classique',
    description: 'Lime, soin des cuticules et pose de vernis',
    duration: 40,
    price: 2800,
    bufferTime: 5,
    categoryId: CATEGORY_3_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_3_ID],
    isActive: true,
    sortOrder: 5,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-7',
    name: 'Pose semi-permanent',
    description: 'Vernis gel longue tenue (jusqu\'à 3 semaines)',
    duration: 60,
    price: 3800,
    bufferTime: 10,
    categoryId: CATEGORY_3_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_3_ID],
    isActive: true,
    sortOrder: 6,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-8',
    name: 'Brushing',
    description: 'Brushing lisse, bouclé ou wavy selon vos envies',
    duration: 30,
    price: 2000,
    bufferTime: 5,
    categoryId: CATEGORY_1_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: null,
    isActive: true,
    sortOrder: 7,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-9',
    name: 'Mèches',
    description: 'Technique de mèches pour un effet lumineux et naturel',
    duration: 100,
    price: 7500,
    bufferTime: 15,
    categoryId: CATEGORY_2_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_1_ID, MEMBER_2_ID],
    isActive: true,
    sortOrder: 8,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-10',
    name: 'Soin hydratant visage',
    description: 'Nettoyage en profondeur et hydratation intense pour un teint éclatant',
    duration: 60,
    price: 5500,
    bufferTime: 10,
    categoryId: CATEGORY_4_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_2_ID, MEMBER_3_ID],
    isActive: true,
    sortOrder: 9,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-11',
    name: 'Soin anti-âge',
    description: 'Traitement lissant et repulpant aux actifs concentrés',
    duration: 75,
    price: 7000,
    bufferTime: 10,
    categoryId: CATEGORY_4_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_2_ID],
    isActive: true,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-12',
    name: 'Peeling doux',
    description: 'Exfoliation douce pour révéler un teint frais et uniforme',
    duration: 45,
    price: 4500,
    bufferTime: 10,
    categoryId: CATEGORY_4_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_2_ID, MEMBER_3_ID],
    isActive: true,
    sortOrder: 11,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-13',
    name: 'Épilation jambes complètes',
    description: 'Épilation à la cire tiède pour une peau douce et nette',
    duration: 45,
    price: 3500,
    bufferTime: 10,
    categoryId: CATEGORY_5_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_3_ID],
    isActive: true,
    sortOrder: 12,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-14',
    name: 'Épilation maillot',
    description: 'Épilation soignée à la cire, différentes formes disponibles',
    duration: 20,
    price: 2000,
    bufferTime: 5,
    categoryId: CATEGORY_5_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_3_ID],
    isActive: true,
    sortOrder: 13,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-15',
    name: 'Épilation aisselles',
    description: 'Épilation rapide et efficace à la cire',
    duration: 15,
    price: 1200,
    bufferTime: 5,
    categoryId: CATEGORY_5_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_3_ID],
    isActive: true,
    sortOrder: 14,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-svc-16',
    name: 'Pédicure complète',
    description: 'Bain de pieds, gommage, soin des ongles et pose de vernis',
    duration: 50,
    price: 3500,
    bufferTime: 10,
    categoryId: CATEGORY_3_ID,
    locationIds: [LOCATION_1_ID],
    memberIds: [MEMBER_3_ID],
    isActive: true,
    sortOrder: 15,
    createdAt: now,
    updatedAt: now,
  },
];

export const demoLocations = [
  {
    id: LOCATION_1_ID,
    name: 'Studio Beauté Élégance — Paris',
    address: '42 Rue du Faubourg Saint-Honoré',
    city: 'Paris',
    postalCode: '75008',
    geopoint: { latitude: 48.8698, longitude: 2.3145 },
    description: 'Au cœur du 8ème arrondissement, à 2 min de la station Madeleine',
    type: 'fixed' as const,
    travelRadius: null,
    isDefault: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];

export const demoMembers = [
  {
    id: MEMBER_1_ID,
    name: 'Sophie Martin',
    email: 'sophie@demo.com',
    phone: null,
    photoURL: unsplash('photo-1494790108377-be9c29b29330', 200),
    accessCode: 'DEMO01',
    locationId: LOCATION_1_ID,
    isDefault: true,
    isActive: true,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: MEMBER_2_ID,
    name: 'Léa Dubois',
    email: 'lea@demo.com',
    phone: null,
    photoURL: unsplash('photo-1438761681033-6461ffad8d80', 200),
    accessCode: 'DEMO02',
    locationId: LOCATION_1_ID,
    isDefault: false,
    isActive: true,
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: MEMBER_3_ID,
    name: 'Camille Petit',
    email: 'camille@demo.com',
    phone: null,
    photoURL: unsplash('photo-1489424731084-a5d8b219a5bb', 200),
    accessCode: 'DEMO03',
    locationId: LOCATION_1_ID,
    isDefault: false,
    isActive: true,
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
  },
];

export const demoReviews = [
  {
    id: 'demo-rev-1',
    providerId: PROVIDER_ID,
    bookingId: 'demo-bkg-1',
    clientId: null,
    memberId: MEMBER_1_ID,
    clientName: 'Marie L.',
    clientPhoto: null,
    rating: 5,
    comment: 'Sophie est incroyable ! Ma coupe est exactement ce que je voulais. Le salon est magnifique et l\'accueil très chaleureux.',
    isPublic: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-rev-2',
    providerId: PROVIDER_ID,
    bookingId: 'demo-bkg-2',
    clientId: null,
    memberId: MEMBER_2_ID,
    clientName: 'Julie D.',
    clientPhoto: null,
    rating: 5,
    comment: 'Mon balayage est sublime, Léa a un vrai talent. Je recommande les yeux fermés !',
    isPublic: true,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-rev-3',
    providerId: PROVIDER_ID,
    bookingId: 'demo-bkg-3',
    clientId: null,
    memberId: MEMBER_3_ID,
    clientName: 'Amina K.',
    clientPhoto: null,
    rating: 4,
    comment: 'Très contente de ma manucure semi-permanente. Camille est très minutieuse.',
    isPublic: true,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-rev-4',
    providerId: PROVIDER_ID,
    bookingId: 'demo-bkg-4',
    clientId: null,
    memberId: MEMBER_1_ID,
    clientName: 'Charlotte B.',
    clientPhoto: null,
    rating: 5,
    comment: 'Toujours au top ! Ça fait 2 ans que je viens ici et je ne changerai pour rien au monde.',
    isPublic: true,
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'demo-rev-5',
    providerId: PROVIDER_ID,
    bookingId: 'demo-bkg-5',
    clientId: null,
    memberId: MEMBER_2_ID,
    clientName: 'Thomas R.',
    clientPhoto: null,
    rating: 5,
    comment: 'Super coupe pour homme, ambiance détendue, je reviendrai c\'est sûr.',
    isPublic: true,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Generate availabilities: Mon-Sat, 9h-19h, for each member
function generateAvailabilities() {
  const avails = [];
  const members = [MEMBER_1_ID, MEMBER_2_ID, MEMBER_3_ID];

  for (const memberId of members) {
    for (let day = 1; day <= 6; day++) {
      // Mon=1 to Sat=6
      avails.push({
        id: `demo-avail-${memberId}-${day}`,
        memberId,
        locationId: LOCATION_1_ID,
        dayOfWeek: day,
        slots:
          day === 6
            ? [{ start: '09:00', end: '17:00' }] // Saturday shorter
            : [
                { start: '09:00', end: '12:30' },
                { start: '14:00', end: '19:00' },
              ],
        isOpen: true,
        effectiveFrom: null,
        updatedAt: now,
      });
    }
    // Sunday closed
    avails.push({
      id: `demo-avail-${memberId}-0`,
      memberId,
      locationId: LOCATION_1_ID,
      dayOfWeek: 0,
      slots: [],
      isOpen: false,
      effectiveFrom: null,
      updatedAt: now,
    });
  }

  return avails;
}

export const demoAvailabilities = generateAvailabilities();

/**
 * Serialized data for the booking flow (/p/demo/reserver)
 * These match the shape expected by BookingFlow component
 */
export const demoBookingProvider = {
  id: PROVIDER_ID,
  businessName: 'Studio Beauté Élégance',
  slug: 'demo',
  photoURL: unsplash('photo-1560066984-138dadb4c035', 200),
  plan: 'team',
  settings: {
    reminderTimes: [24],
    requiresConfirmation: false,
    defaultBufferTime: 10,
    timezone: 'Europe/Paris',
    minBookingNotice: 2,
    maxBookingAdvance: 60,
    allowClientCancellation: true,
    cancellationDeadline: 24,
  },
};

export const demoBookingCategories = demoServiceCategories.map((c) => ({
  id: c.id,
  name: c.name,
  sortOrder: c.sortOrder,
}));

export const demoBookingServices = demoServices.map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  duration: s.duration,
  price: s.price,
  bufferTime: s.bufferTime,
  categoryId: s.categoryId,
  locationIds: s.locationIds,
  memberIds: s.memberIds,
}));

export const demoBookingLocations = demoLocations.map((l) => ({
  id: l.id,
  name: l.name,
  address: l.address,
  city: l.city,
  postalCode: l.postalCode,
  type: l.type,
}));

export const demoBookingMembers = demoMembers.map((m) => ({
  id: m.id,
  name: m.name,
  photoURL: m.photoURL,
  locationId: m.locationId,
  isDefault: m.isDefault,
}));

export const demoBookingAvailabilities = demoAvailabilities.map((a) => ({
  id: a.id,
  memberId: a.memberId,
  locationId: a.locationId,
  dayOfWeek: a.dayOfWeek,
  slots: a.slots,
  isOpen: a.isOpen,
}));

/**
 * Generate mock time slots for a given date (used in demo booking flow)
 * Simulates realistic salon time slots
 */
export function generateDemoSlots(date: Date, serviceDuration: number) {
  const dateStr = date.toISOString().split('T')[0];
  const isSaturday = date.getDay() === 6;

  // Morning slots
  const morningSlots = isSaturday
    ? ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']
    : ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];

  // Afternoon slots (weekdays only)
  const afternoonSlots = isSaturday
    ? []
    : ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'];

  const allStartTimes = [...morningSlots, ...afternoonSlots];

  // Remove some slots randomly (simulate booked ones) — seed by date for consistency
  const seed = date.getDate() + date.getMonth() * 31;
  const filtered = allStartTimes.filter((_, i) => (seed + i * 7) % 5 !== 0);

  return filtered.map((start) => {
    const [h, m] = start.split(':').map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + serviceDuration;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');
    const end = `${endH}:${endM}`;

    const datetime = new Date(`${dateStr}T${start}:00`).toISOString();
    const endDatetime = new Date(`${dateStr}T${end}:00`).toISOString();

    return { date: dateStr, start, end, datetime, endDatetime };
  });
}

/**
 * Calculate the next available date for the demo
 * Returns tomorrow if it's a weekday, otherwise next Monday
 */
export function getDemoNextAvailableDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  // If Sunday, push to Monday
  if (tomorrow.getDay() === 0) {
    tomorrow.setDate(tomorrow.getDate() + 1);
  }

  return tomorrow.toISOString();
}

/**
 * Demo per-member availabilities for team display
 */
export function getDemoMemberAvailabilities() {
  const base = getDemoNextAvailableDate();
  const baseDate = new Date(base);

  // Second member available 2 days later
  const date2 = new Date(baseDate);
  date2.setDate(date2.getDate() + 2);
  if (date2.getDay() === 0) date2.setDate(date2.getDate() + 1);

  // Third member available 4 days later
  const date3 = new Date(baseDate);
  date3.setDate(date3.getDate() + 4);
  if (date3.getDay() === 0) date3.setDate(date3.getDate() + 1);

  return demoMembers.map((m, i) => ({
    memberId: m.id,
    memberName: m.name,
    memberPhoto: m.photoURL,
    nextDate: i === 0 ? base : i === 1 ? date2.toISOString() : date3.toISOString(),
  }));
}
