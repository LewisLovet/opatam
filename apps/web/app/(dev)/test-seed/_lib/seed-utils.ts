/**
 * Utilitaires pour le seed de données de test
 */

/**
 * Génère un slug à partir d'un texte
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Génère un code d'accès pour un membre
 * Format: PRENOM-XXXX (ex: MARIE-A7X2)
 */
export function generateAccessCode(name: string): string {
  const prefix = name.split(' ')[0].toUpperCase().substring(0, 5);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

/**
 * Génère une chaîne aléatoire
 */
export function generateRandomString(length: number): string {
  return Math.random().toString(36).substring(2, 2 + length);
}

/**
 * Ajoute des minutes à une date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Obtient demain à une heure donnée
 */
export function getTomorrowAt(hour: number, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Obtient après-demain à une heure donnée
 */
export function getAfterTomorrowAt(hour: number, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Génère un numéro de téléphone français fictif
 */
export function generatePhoneNumber(): string {
  return "06" + Math.floor(10000000 + Math.random() * 90000000).toString();
}

/**
 * Génère un rating réaliste
 */
export function generateRating(): {
  average: number;
  count: number;
  distribution: Record<number, number>;
} {
  const count = Math.floor(10 + Math.random() * 90);
  const average = 4.0 + Math.random() * 1; // Entre 4.0 et 5.0

  // Distribution approximative basée sur la moyenne
  const fiveStars = Math.floor(count * (average - 4) / 1.2);
  const fourStars = Math.floor(count * 0.25);
  const threeStars = Math.floor(count * 0.08);
  const twoStars = Math.floor(count * 0.03);
  const oneStar = count - fiveStars - fourStars - threeStars - twoStars;

  return {
    average: Math.round(average * 10) / 10,
    count,
    distribution: {
      1: Math.max(0, oneStar),
      2: twoStars,
      3: threeStars,
      4: fourStars,
      5: Math.max(0, fiveStars),
    },
  };
}

/**
 * Formate un timestamp pour l'affichage dans les logs
 */
export function formatLogTime(): string {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
