/**
 * Données de test pour les providers
 * 10 providers réalistes avec des services variés
 */

export interface TestService {
  name: string;
  duration: number;
  price: number; // en centimes
  description: string;
}

export interface TestProviderData {
  businessName: string;
  category: string;
  description: string;
  city: string;
  postalCode: string;
  address: string;
  photoURL: string;
  coverPhotoURL: string;
  ownerName: string;
  services: TestService[];
}

export const TEST_PROVIDERS: TestProviderData[] = [
  {
    businessName: "Marie Coiffure",
    category: "coiffure",
    description: "Salon de coiffure au cœur de Paris. Spécialiste des colorations et coupes tendances. Ambiance chaleureuse et équipe passionnée.",
    city: "Paris",
    postalCode: "75011",
    address: "42 Rue Oberkampf",
    photoURL: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&h=400&fit=crop",
    ownerName: "Marie Dupont",
    services: [
      { name: "Coupe femme", duration: 45, price: 3500, description: "Coupe, shampoing et brushing" },
      { name: "Coupe homme", duration: 30, price: 2500, description: "Coupe classique homme" },
      { name: "Coloration", duration: 90, price: 6500, description: "Coloration complète avec soin" },
      { name: "Balayage", duration: 120, price: 8500, description: "Balayage naturel ou contrasté" },
    ],
  },
  {
    businessName: "Spa Sérénité",
    category: "spa",
    description: "Un havre de paix au cœur de Lyon. Massages, soins du visage et rituels bien-être pour une relaxation totale.",
    city: "Lyon",
    postalCode: "69002",
    address: "15 Place Bellecour",
    photoURL: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&h=400&fit=crop",
    ownerName: "Sophie Martin",
    services: [
      { name: "Massage relaxant", duration: 60, price: 7000, description: "Massage corps complet aux huiles essentielles" },
      { name: "Massage deep tissue", duration: 75, price: 8500, description: "Massage profond pour tensions musculaires" },
      { name: "Soin visage hydratant", duration: 45, price: 5500, description: "Nettoyage et hydratation en profondeur" },
      { name: "Rituel corps complet", duration: 120, price: 12000, description: "Gommage, enveloppement et massage" },
    ],
  },
  {
    businessName: "FitCoach Thomas",
    category: "coaching",
    description: "Coach sportif certifié. Programmes personnalisés pour perte de poids, prise de masse ou remise en forme. À domicile ou en salle.",
    city: "Bordeaux",
    postalCode: "33000",
    address: "8 Cours de l'Intendance",
    photoURL: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=400&fit=crop",
    ownerName: "Thomas Renard",
    services: [
      { name: "Séance individuelle", duration: 60, price: 5000, description: "Coaching personnalisé 1h" },
      { name: "Bilan forme", duration: 90, price: 7500, description: "Évaluation complète et programme sur-mesure" },
      { name: "Pack 10 séances", duration: 60, price: 40000, description: "10 séances à prix réduit" },
    ],
  },
  {
    businessName: "Institut Beauté Divine",
    category: "beaute",
    description: "Institut de beauté haut de gamme. Soins du visage, manucure, épilation et maquillage par des expertes passionnées.",
    city: "Marseille",
    postalCode: "13001",
    address: "25 La Canebière",
    photoURL: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&h=400&fit=crop",
    ownerName: "Nadia Belkacem",
    services: [
      { name: "Manucure classique", duration: 30, price: 2500, description: "Limage, cuticules et vernis" },
      { name: "Pose gel", duration: 60, price: 4500, description: "Pose complète gel UV" },
      { name: "Épilation jambes", duration: 30, price: 2000, description: "Épilation à la cire" },
      { name: "Épilation maillot", duration: 20, price: 1500, description: "Maillot classique ou intégral" },
      { name: "Soin visage anti-âge", duration: 60, price: 7500, description: "Soin premium anti-rides" },
    ],
  },
  {
    businessName: "Barber Shop Le Dandy",
    category: "coiffure",
    description: "Barbier traditionnel avec une touche moderne. Tailles de barbe, coupes homme et soins. Ambiance vintage garantie.",
    city: "Toulouse",
    postalCode: "31000",
    address: "12 Rue des Arts",
    photoURL: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&h=400&fit=crop",
    ownerName: "Lucas Moreau",
    services: [
      { name: "Coupe homme", duration: 30, price: 2500, description: "Coupe tendance ou classique" },
      { name: "Taille barbe", duration: 20, price: 1500, description: "Taille et entretien de la barbe" },
      { name: "Coupe + barbe", duration: 45, price: 3500, description: "Forfait complet" },
      { name: "Rasage traditionnel", duration: 30, price: 2500, description: "Rasage au coupe-chou" },
    ],
  },
  {
    businessName: "Yoga Zen Studio",
    category: "coaching",
    description: "Studio de yoga pour tous niveaux. Hatha, Vinyasa, Yin yoga et méditation. Retrouvez équilibre et sérénité.",
    city: "Nantes",
    postalCode: "44000",
    address: "5 Rue Crébillon",
    photoURL: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1588286840104-8957b019727f?w=1200&h=400&fit=crop",
    ownerName: "Émilie Rousseau",
    services: [
      { name: "Cours collectif", duration: 60, price: 1500, description: "Cours de yoga en groupe (max 10)" },
      { name: "Cours particulier", duration: 60, price: 5000, description: "Séance individuelle personnalisée" },
      { name: "Atelier méditation", duration: 45, price: 2000, description: "Initiation à la méditation" },
    ],
  },
  {
    businessName: "Massage & Bien-être",
    category: "massage",
    description: "Masseur-kinésithérapeute diplômé. Massages thérapeutiques et relaxants. Soulagement des douleurs et détente profonde.",
    city: "Nice",
    postalCode: "06000",
    address: "30 Promenade des Anglais",
    photoURL: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=1200&h=400&fit=crop",
    ownerName: "Pierre Leclerc",
    services: [
      { name: "Massage suédois", duration: 60, price: 6500, description: "Massage classique tonifiant" },
      { name: "Massage aux pierres chaudes", duration: 75, price: 8000, description: "Relaxation profonde" },
      { name: "Massage sportif", duration: 45, price: 5500, description: "Récupération après l'effort" },
      { name: "Réflexologie plantaire", duration: 45, price: 5000, description: "Stimulation des zones réflexes" },
    ],
  },
  {
    businessName: "L'Atelier du Sourcil",
    category: "beaute",
    description: "Experte en restructuration du regard. Microblading, extension de cils et teinture. Sublimez votre regard naturellement.",
    city: "Lille",
    postalCode: "59000",
    address: "18 Rue de Béthune",
    photoURL: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=1200&h=400&fit=crop",
    ownerName: "Amélie Petit",
    services: [
      { name: "Restructuration sourcils", duration: 30, price: 2000, description: "Épilation et mise en forme" },
      { name: "Teinture sourcils", duration: 20, price: 1500, description: "Coloration semi-permanente" },
      { name: "Extension cils classique", duration: 90, price: 7000, description: "Pose cil à cil naturelle" },
      { name: "Extension cils volume", duration: 120, price: 9000, description: "Pose volume russe" },
      { name: "Rehaussement cils", duration: 60, price: 5500, description: "Permanente des cils" },
    ],
  },
  {
    businessName: "Ostéo Santé",
    category: "sante",
    description: "Cabinet d'ostéopathie. Traitement des douleurs, troubles fonctionnels et accompagnement des sportifs. Approche globale du corps.",
    city: "Strasbourg",
    postalCode: "67000",
    address: "22 Place Kléber",
    photoURL: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&h=400&fit=crop",
    ownerName: "Dr. Marc Weber",
    services: [
      { name: "Consultation ostéopathie", duration: 45, price: 6000, description: "Bilan et traitement" },
      { name: "Suivi sportif", duration: 30, price: 4500, description: "Consultation de suivi" },
      { name: "Ostéopathie pédiatrique", duration: 30, price: 5000, description: "Consultation pour enfants" },
    ],
  },
  {
    businessName: "Nails Factory",
    category: "beaute",
    description: "Prothésiste ongulaire créative. Nail art, poses en gel et acrylique. Des ongles uniques qui vous ressemblent !",
    city: "Montpellier",
    postalCode: "34000",
    address: "7 Place de la Comédie",
    photoURL: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop",
    coverPhotoURL: "https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=1200&h=400&fit=crop",
    ownerName: "Jessica Da Silva",
    services: [
      { name: "Manucure simple", duration: 30, price: 2000, description: "Limage et vernis classique" },
      { name: "Pose gel", duration: 75, price: 5000, description: "Pose complète en gel" },
      { name: "Pose acrylique", duration: 90, price: 5500, description: "Pose complète acrylique" },
      { name: "Nail art", duration: 30, price: 1500, description: "Décorations personnalisées (en plus)" },
      { name: "Dépose + soin", duration: 45, price: 2500, description: "Dépose et soin réparateur" },
    ],
  },
];

export const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  "Paris": { latitude: 48.8566, longitude: 2.3522 },
  "Lyon": { latitude: 45.7640, longitude: 4.8357 },
  "Bordeaux": { latitude: 44.8378, longitude: -0.5792 },
  "Marseille": { latitude: 43.2965, longitude: 5.3698 },
  "Toulouse": { latitude: 43.6047, longitude: 1.4442 },
  "Nantes": { latitude: 47.2184, longitude: -1.5536 },
  "Nice": { latitude: 43.7102, longitude: 7.2620 },
  "Lille": { latitude: 50.6292, longitude: 3.0573 },
  "Strasbourg": { latitude: 48.5734, longitude: 7.7521 },
  "Montpellier": { latitude: 43.6108, longitude: 3.8767 },
};

export const WEEK_SCHEDULE = [
  { dayOfWeek: 0, isOpen: false, slots: [] }, // Dimanche
  { dayOfWeek: 1, isOpen: true, slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  { dayOfWeek: 2, isOpen: true, slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  { dayOfWeek: 3, isOpen: true, slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  { dayOfWeek: 4, isOpen: true, slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  { dayOfWeek: 5, isOpen: true, slots: [{ start: "09:00", end: "12:00" }, { start: "14:00", end: "18:00" }] },
  { dayOfWeek: 6, isOpen: true, slots: [{ start: "09:00", end: "13:00" }] }, // Samedi matin
];
