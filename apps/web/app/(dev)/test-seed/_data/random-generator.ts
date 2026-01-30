/**
 * Generateur de donnees aleatoires pour les providers de test
 */

// Prenoms
const FIRST_NAMES = [
  'Marie', 'Sophie', 'Julie', 'Camille', 'Laura', 'Emma', 'Lea', 'Chloe', 'Manon', 'Sarah',
  'Thomas', 'Lucas', 'Hugo', 'Antoine', 'Maxime', 'Alexandre', 'Nicolas', 'Pierre', 'Marc', 'David',
  'Nadia', 'Fatima', 'Amina', 'Yasmine', 'Leila', 'Sofia', 'Clara', 'Ines', 'Lina', 'Nina',
  'Amelie', 'Pauline', 'Marine', 'Justine', 'Margot', 'Alice', 'Louise', 'Juliette', 'Charlotte', 'Oceane',
];

// Noms de famille
const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
  'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
  'Morel', 'Girard', 'Andre', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'Francois', 'Martinez', 'Legrand',
];

// Suffixes pour noms d'entreprise
const BUSINESS_SUFFIXES: Record<string, string[]> = {
  coiffure: ['Coiffure', 'Hair Studio', 'Salon', 'Hair Design', 'Coiff\'Style', 'Hair Art'],
  spa: ['Spa', 'Bien-Etre', 'Wellness', 'Relaxation', 'Detente', 'Serenite'],
  coaching: ['Coaching', 'Fitness', 'Training', 'Sport', 'Form', 'Coach'],
  beaute: ['Beaute', 'Institut', 'Esthetique', 'Beauty', 'Nails', 'Beauty Lab'],
  massage: ['Massage', 'Zen', 'Relaxation', 'Bien-Etre', 'Detente', 'Therapy'],
  sante: ['Sante', 'Osteo', 'Kine', 'Cabinet', 'Centre', 'Clinique'],
};

// Prefixes pour noms d'entreprise
const BUSINESS_PREFIXES = [
  'L\'Atelier', 'Le Studio', 'Chez', 'Institut', 'Centre', 'Espace', 'La Maison', 'Le Salon', 'Au',
];

// Villes avec coordonnees
const CITIES = [
  { name: 'Paris', postalCode: '75001', lat: 48.8566, lng: 2.3522 },
  { name: 'Paris', postalCode: '75011', lat: 48.8590, lng: 2.3780 },
  { name: 'Paris', postalCode: '75015', lat: 48.8421, lng: 2.2989 },
  { name: 'Lyon', postalCode: '69001', lat: 45.7676, lng: 4.8344 },
  { name: 'Lyon', postalCode: '69002', lat: 45.7578, lng: 4.8320 },
  { name: 'Marseille', postalCode: '13001', lat: 43.2965, lng: 5.3698 },
  { name: 'Marseille', postalCode: '13008', lat: 43.2558, lng: 5.3850 },
  { name: 'Bordeaux', postalCode: '33000', lat: 44.8378, lng: -0.5792 },
  { name: 'Toulouse', postalCode: '31000', lat: 43.6047, lng: 1.4442 },
  { name: 'Nantes', postalCode: '44000', lat: 47.2184, lng: -1.5536 },
  { name: 'Nice', postalCode: '06000', lat: 43.7102, lng: 7.2620 },
  { name: 'Lille', postalCode: '59000', lat: 50.6292, lng: 3.0573 },
  { name: 'Strasbourg', postalCode: '67000', lat: 48.5734, lng: 7.7521 },
  { name: 'Montpellier', postalCode: '34000', lat: 43.6108, lng: 3.8767 },
  { name: 'Rennes', postalCode: '35000', lat: 48.1173, lng: -1.6778 },
  { name: 'Grenoble', postalCode: '38000', lat: 45.1885, lng: 5.7245 },
  { name: 'Dijon', postalCode: '21000', lat: 47.3220, lng: 5.0415 },
  { name: 'Angers', postalCode: '49000', lat: 47.4784, lng: -0.5632 },
  { name: 'Reims', postalCode: '51100', lat: 49.2583, lng: 4.0317 },
  { name: 'Tours', postalCode: '37000', lat: 47.3941, lng: 0.6848 },
];

// Noms de rues
const STREET_NAMES = [
  'Rue de la Paix', 'Avenue des Champs', 'Boulevard Victor Hugo', 'Rue du Commerce',
  'Place de la Republique', 'Rue Jean Jaures', 'Avenue Foch', 'Rue de Rivoli',
  'Boulevard Haussmann', 'Rue Saint-Honore', 'Avenue Montaigne', 'Rue du Faubourg',
  'Place Bellecour', 'Cours Mirabeau', 'Rue Sainte-Catherine', 'Quai des Chartrons',
  'Rue de la Liberte', 'Avenue de la Gare', 'Boulevard Gambetta', 'Rue Nationale',
];

// Categories disponibles
const CATEGORIES = ['coiffure', 'spa', 'coaching', 'beaute', 'massage', 'sante'] as const;
type Category = typeof CATEGORIES[number];

// Services par categorie
const SERVICES_BY_CATEGORY: Record<Category, Array<{ name: string; duration: number; priceRange: [number, number]; description: string }>> = {
  coiffure: [
    { name: 'Coupe femme', duration: 45, priceRange: [2500, 4500], description: 'Coupe, shampoing et brushing' },
    { name: 'Coupe homme', duration: 30, priceRange: [1800, 3000], description: 'Coupe classique homme' },
    { name: 'Coloration', duration: 90, priceRange: [5000, 8000], description: 'Coloration complete avec soin' },
    { name: 'Balayage', duration: 120, priceRange: [7000, 12000], description: 'Balayage naturel ou contraste' },
    { name: 'Brushing', duration: 30, priceRange: [2000, 3500], description: 'Mise en forme et brushing' },
    { name: 'Meches', duration: 90, priceRange: [6000, 9000], description: 'Meches et reflets' },
    { name: 'Soin capillaire', duration: 30, priceRange: [2500, 4000], description: 'Soin profond et hydratation' },
    { name: 'Coupe enfant', duration: 20, priceRange: [1200, 2000], description: 'Coupe pour enfant' },
  ],
  spa: [
    { name: 'Massage relaxant', duration: 60, priceRange: [6000, 9000], description: 'Massage corps complet aux huiles' },
    { name: 'Massage deep tissue', duration: 75, priceRange: [7500, 11000], description: 'Massage profond tensions musculaires' },
    { name: 'Soin visage hydratant', duration: 45, priceRange: [5000, 7500], description: 'Nettoyage et hydratation profonde' },
    { name: 'Rituel corps complet', duration: 120, priceRange: [10000, 15000], description: 'Gommage, enveloppement et massage' },
    { name: 'Hammam privatif', duration: 60, priceRange: [4000, 6000], description: 'Acces hammam prive' },
    { name: 'Soin anti-stress', duration: 90, priceRange: [8000, 12000], description: 'Rituel detente complet' },
  ],
  coaching: [
    { name: 'Seance individuelle', duration: 60, priceRange: [4000, 7000], description: 'Coaching personnalise 1h' },
    { name: 'Bilan forme', duration: 90, priceRange: [6000, 9000], description: 'Evaluation et programme sur-mesure' },
    { name: 'Seance duo', duration: 60, priceRange: [6000, 9000], description: 'Entrainement a deux' },
    { name: 'Programme 10 seances', duration: 60, priceRange: [35000, 55000], description: 'Pack 10 seances' },
    { name: 'Cours collectif', duration: 45, priceRange: [1500, 2500], description: 'Cours en petit groupe' },
    { name: 'Coaching nutrition', duration: 45, priceRange: [5000, 8000], description: 'Conseils nutritionnels personnalises' },
  ],
  beaute: [
    { name: 'Manucure classique', duration: 30, priceRange: [2000, 3500], description: 'Limage, cuticules et vernis' },
    { name: 'Pose gel', duration: 60, priceRange: [4000, 6000], description: 'Pose complete gel UV' },
    { name: 'Epilation jambes', duration: 30, priceRange: [1800, 3000], description: 'Epilation a la cire' },
    { name: 'Epilation maillot', duration: 20, priceRange: [1200, 2500], description: 'Maillot classique ou integral' },
    { name: 'Soin visage anti-age', duration: 60, priceRange: [6000, 9000], description: 'Soin premium anti-rides' },
    { name: 'Maquillage jour', duration: 30, priceRange: [3000, 5000], description: 'Maquillage naturel' },
    { name: 'Maquillage soiree', duration: 45, priceRange: [4500, 7000], description: 'Maquillage evenement' },
    { name: 'Extension cils', duration: 90, priceRange: [6000, 10000], description: 'Pose cil a cil' },
  ],
  massage: [
    { name: 'Massage suedois', duration: 60, priceRange: [5500, 8000], description: 'Massage classique tonifiant' },
    { name: 'Massage pierres chaudes', duration: 75, priceRange: [7000, 10000], description: 'Relaxation profonde' },
    { name: 'Massage sportif', duration: 45, priceRange: [5000, 7500], description: 'Recuperation apres effort' },
    { name: 'Reflexologie plantaire', duration: 45, priceRange: [4500, 6500], description: 'Stimulation zones reflexes' },
    { name: 'Massage californien', duration: 60, priceRange: [6000, 8500], description: 'Massage fluide et enveloppant' },
    { name: 'Massage thai', duration: 90, priceRange: [7500, 11000], description: 'Massage traditionnel thailandais' },
  ],
  sante: [
    { name: 'Consultation osteopathie', duration: 45, priceRange: [5000, 7500], description: 'Bilan et traitement' },
    { name: 'Suivi sportif', duration: 30, priceRange: [4000, 6000], description: 'Consultation de suivi' },
    { name: 'Osteopathie pediatrique', duration: 30, priceRange: [4500, 6500], description: 'Consultation pour enfants' },
    { name: 'Seance kinesitherapie', duration: 30, priceRange: [3500, 5500], description: 'Reeducation et soins' },
    { name: 'Bilan postural', duration: 60, priceRange: [6000, 9000], description: 'Analyse posturale complete' },
  ],
};

// Images Unsplash par categorie (URLs directes)
const CATEGORY_IMAGES: Record<Category, { photos: string[]; covers: string[] }> = {
  coiffure: {
    photos: [
      'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400&h=400&fit=crop',
    ],
    covers: [
      'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?w=1200&h=400&fit=crop',
    ],
  },
  spa: {
    photos: [
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&h=400&fit=crop',
    ],
    covers: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=1200&h=400&fit=crop',
    ],
  },
  coaching: {
    photos: [
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1581009146145-b5ef050c149a?w=400&h=400&fit=crop',
    ],
    covers: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&h=400&fit=crop',
    ],
  },
  beaute: {
    photos: [
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=400&h=400&fit=crop',
    ],
    covers: [
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=400&fit=crop',
    ],
  },
  massage: {
    photos: [
      'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=400&h=400&fit=crop',
    ],
    covers: [
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&h=400&fit=crop',
    ],
  },
  sante: {
    photos: [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=400&fit=crop',
    ],
    covers: [
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=400&fit=crop',
      'https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=1200&h=400&fit=crop',
    ],
  },
};

// Descriptions par categorie
const DESCRIPTIONS_BY_CATEGORY: Record<Category, string[]> = {
  coiffure: [
    'Salon de coiffure au coeur de la ville. Specialiste des colorations et coupes tendances.',
    'Une equipe passionnee a votre service pour sublimer votre chevelure.',
    'Coiffeur visagiste experimente. Conseils personnalises et ambiance chaleureuse.',
    'Votre salon de coiffure moderne. Techniques innovantes et produits de qualite.',
    'Expert en coupe et coloration. Transformez votre look avec nos conseils.',
  ],
  spa: [
    'Un havre de paix pour une relaxation totale. Massages et soins du visage.',
    'Evadez-vous du quotidien dans notre espace bien-etre.',
    'Spa urbain offrant une parenthese de detente au coeur de la ville.',
    'Rituels de beaute et massages pour un moment de pure relaxation.',
    'Centre de bien-etre proposant des soins personnalises et de qualite.',
  ],
  coaching: [
    'Coach sportif certifie. Programmes personnalises pour atteindre vos objectifs.',
    'Transformez votre corps et votre esprit avec un accompagnement sur-mesure.',
    'Coaching fitness adapte a tous les niveaux. Resultats garantis.',
    'Votre partenaire forme et sante. Entrainements motives et efficaces.',
    'Personal trainer experimente. Depassez vos limites en toute securite.',
  ],
  beaute: [
    'Institut de beaute haut de gamme. Soins du visage, manucure et maquillage.',
    'Sublimez votre beaute naturelle avec nos soins experts.',
    'Espace beaute moderne proposant les dernieres techniques esthetiques.',
    'Votre institut de beaute de confiance pour tous vos soins.',
    'Professionnelles passionnees pour prendre soin de vous.',
  ],
  massage: [
    'Masseur-kinesitherapeute diplome. Massages therapeutiques et relaxants.',
    'Soulagez vos tensions avec nos techniques de massage expertes.',
    'Cabinet de massage proposant differentes approches pour votre bien-etre.',
    'Detente et relaxation garanties dans un cadre apaisant.',
    'Specialiste du massage bien-etre. A votre ecoute pour vos besoins.',
  ],
  sante: [
    'Cabinet d\'osteopathie. Traitement des douleurs et troubles fonctionnels.',
    'Approche globale du corps pour retrouver equilibre et mobilite.',
    'Osteopathe experimente. Accompagnement des sportifs et des familles.',
    'Soins osteopathiques adaptes a chaque patient.',
    'Centre de sante proposant une prise en charge complete et personnalisee.',
  ],
};

// Horaires types
const SCHEDULE_TEMPLATES = [
  // Standard: Lun-Ven 9h-18h, Sam matin
  [
    { dayOfWeek: 0, isOpen: false, slots: [] },
    { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
    { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
    { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
    { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
    { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] },
    { dayOfWeek: 6, isOpen: true, slots: [{ start: '09:00', end: '13:00' }] },
  ],
  // Journee continue
  [
    { dayOfWeek: 0, isOpen: false, slots: [] },
    { dayOfWeek: 1, isOpen: true, slots: [{ start: '10:00', end: '19:00' }] },
    { dayOfWeek: 2, isOpen: true, slots: [{ start: '10:00', end: '19:00' }] },
    { dayOfWeek: 3, isOpen: true, slots: [{ start: '10:00', end: '19:00' }] },
    { dayOfWeek: 4, isOpen: true, slots: [{ start: '10:00', end: '19:00' }] },
    { dayOfWeek: 5, isOpen: true, slots: [{ start: '10:00', end: '19:00' }] },
    { dayOfWeek: 6, isOpen: true, slots: [{ start: '10:00', end: '17:00' }] },
  ],
  // Ferme lundi
  [
    { dayOfWeek: 0, isOpen: false, slots: [] },
    { dayOfWeek: 1, isOpen: false, slots: [] },
    { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '19:00' }] },
    { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '19:00' }] },
    { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '19:00' }] },
    { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '12:30' }, { start: '14:00', end: '19:00' }] },
    { dayOfWeek: 6, isOpen: true, slots: [{ start: '09:00', end: '17:00' }] },
  ],
];

// Utilitaires
function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(range: [number, number]): number {
  // Arrondir au 50 centimes pres
  const price = randomInt(range[0], range[1]);
  return Math.round(price / 50) * 50;
}

function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// Generateur de nom d'entreprise
function generateBusinessName(category: Category, firstName: string): string {
  const type = randomInt(0, 2);
  const suffixes = BUSINESS_SUFFIXES[category];

  switch (type) {
    case 0:
      // "Prenom Suffixe" - ex: "Marie Coiffure"
      return `${firstName} ${randomItem(suffixes)}`;
    case 1:
      // "Prefixe Prenom" - ex: "Chez Marie"
      return `${randomItem(BUSINESS_PREFIXES)} ${firstName}`;
    default:
      // "Suffixe Ville/Adjectif" - ex: "Salon Elegance"
      const adjectives = ['Elegance', 'Prestige', 'Zen', 'Royal', 'Premium', 'Excellence'];
      return `${randomItem(suffixes)} ${randomItem(adjectives)}`;
  }
}

// Generateur de numero de rue
function generateStreetNumber(): string {
  return `${randomInt(1, 150)}`;
}

// Generateur de telephone
function generatePhone(): string {
  const prefixes = ['06', '07'];
  return `${randomItem(prefixes)}${randomInt(10000000, 99999999)}`;
}

// Generateur d'email
function generateEmail(businessName: string): string {
  const slug = businessName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `contact@${slug}.test`;
}

// Generateur de code d'acces
function generateAccessCode(name: string): string {
  const prefix = name.split(' ')[0].toUpperCase().substring(0, 5);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

// Generateur de rating
function generateRating(): { average: number; count: number; distribution: Record<number, number> } {
  const count = randomInt(5, 120);
  const average = 3.5 + Math.random() * 1.5; // Entre 3.5 et 5.0

  const fiveStars = Math.floor(count * (average - 3) / 2.5);
  const fourStars = Math.floor(count * 0.25);
  const threeStars = Math.floor(count * 0.1);
  const twoStars = Math.floor(count * 0.05);
  const oneStar = Math.max(0, count - fiveStars - fourStars - threeStars - twoStars);

  return {
    average: Math.round(average * 10) / 10,
    count,
    distribution: {
      1: oneStar,
      2: twoStars,
      3: threeStars,
      4: fourStars,
      5: Math.max(0, fiveStars),
    },
  };
}

// Selecteur d'image aleatoire
function getRandomImage(category: Category, type: 'photo' | 'cover'): string {
  const images = type === 'photo'
    ? CATEGORY_IMAGES[category].photos
    : CATEGORY_IMAGES[category].covers;
  return randomItem(images);
}

// Interface pour un provider genere
export interface GeneratedProvider {
  id: string;
  businessName: string;
  ownerName: string;
  category: Category;
  description: string;
  city: string;
  postalCode: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  photoURL: string;
  coverPhotoURL: string;
  services: Array<{
    name: string;
    duration: number;
    price: number;
    description: string;
  }>;
  schedule: typeof SCHEDULE_TEMPLATES[0];
  rating: ReturnType<typeof generateRating>;
  accessCode: string;
}

// Fonction principale de generation
export function generateRandomProvider(index: number): GeneratedProvider {
  const uniqueId = generateUniqueId();
  const category = randomItem(CATEGORIES);
  const firstName = randomItem(FIRST_NAMES);
  const lastName = randomItem(LAST_NAMES);
  const ownerName = `${firstName} ${lastName}`;
  const businessName = generateBusinessName(category, firstName);
  const city = randomItem(CITIES);
  const streetNumber = generateStreetNumber();
  const streetName = randomItem(STREET_NAMES);

  // Generer 3 a 6 services aleatoires
  const availableServices = SERVICES_BY_CATEGORY[category];
  const serviceCount = randomInt(3, Math.min(6, availableServices.length));
  const selectedServices = randomItems(availableServices, serviceCount);
  const services = selectedServices.map((s) => ({
    name: s.name,
    duration: s.duration,
    price: randomPrice(s.priceRange),
    description: s.description,
  }));

  return {
    id: `test-seed-${index}-${uniqueId}`,
    businessName,
    ownerName,
    category,
    description: randomItem(DESCRIPTIONS_BY_CATEGORY[category]),
    city: city.name,
    postalCode: city.postalCode,
    address: `${streetNumber} ${streetName}`,
    latitude: city.lat + (Math.random() - 0.5) * 0.02,
    longitude: city.lng + (Math.random() - 0.5) * 0.02,
    phone: generatePhone(),
    email: generateEmail(businessName),
    photoURL: getRandomImage(category, 'photo'),
    coverPhotoURL: getRandomImage(category, 'cover'),
    services,
    schedule: randomItem(SCHEDULE_TEMPLATES),
    rating: generateRating(),
    accessCode: generateAccessCode(ownerName),
  };
}

// Generer plusieurs providers
export function generateRandomProviders(count: number): GeneratedProvider[] {
  return Array.from({ length: count }, (_, i) => generateRandomProvider(i));
}

// Export des categories pour l'affichage
export const CATEGORY_LABELS: Record<Category, string> = {
  coiffure: 'Coiffure',
  spa: 'Spa & Bien-etre',
  coaching: 'Coaching & Sport',
  beaute: 'Beaute',
  massage: 'Massage',
  sante: 'Sante',
};

export type { Category };
