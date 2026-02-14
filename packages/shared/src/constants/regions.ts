/**
 * French metropolitan regions with their major cities
 * Used for progressive search filtering: Region → City → Category
 */

export const REGIONS: Record<string, string[]> = {
  'Île-de-France': [
    'Paris', 'Boulogne-Billancourt', 'Montreuil', 'Saint-Denis', 'Argenteuil',
    'Versailles', 'Nanterre', 'Créteil', 'Vitry-sur-Seine', 'Colombes',
    'Asnières-sur-Seine', 'Aubervilliers', 'Aulnay-sous-Bois', 'Rueil-Malmaison',
    'Champigny-sur-Marne', 'Évry-Courcouronnes', 'Meaux', 'Chilly-Mazarin',
  ],
  'Auvergne-Rhône-Alpes': [
    'Lyon', 'Grenoble', 'Saint-Étienne', 'Clermont-Ferrand', 'Villeurbanne',
    'Annecy', 'Valence', 'Chambéry', 'Bourg-en-Bresse', 'Vienne',
  ],
  'Nouvelle-Aquitaine': [
    'Bordeaux', 'Limoges', 'Poitiers', 'Pau', 'La Rochelle',
    'Angoulême', 'Bayonne', 'Périgueux', 'Biarritz', 'Agen',
  ],
  'Occitanie': [
    'Toulouse', 'Montpellier', 'Nîmes', 'Perpignan', 'Béziers',
    'Narbonne', 'Albi', 'Tarbes', 'Carcassonne', 'Rodez',
  ],
  'Hauts-de-France': [
    'Lille', 'Amiens', 'Roubaix', 'Tourcoing', 'Dunkerque',
    'Calais', 'Valenciennes', 'Beauvais', 'Arras', 'Compiègne',
  ],
  'Provence-Alpes-Côte d\'Azur': [
    'Marseille', 'Nice', 'Toulon', 'Aix-en-Provence', 'Avignon',
    'Cannes', 'Antibes', 'Fréjus', 'Gap', 'Hyères',
  ],
  'Grand Est': [
    'Strasbourg', 'Reims', 'Metz', 'Mulhouse', 'Nancy',
    'Colmar', 'Troyes', 'Charleville-Mézières', 'Épinal', 'Thionville',
  ],
  'Pays de la Loire': [
    'Nantes', 'Angers', 'Le Mans', 'Saint-Nazaire', 'La Roche-sur-Yon',
    'Cholet', 'Laval', 'Saumur',
  ],
  'Bretagne': [
    'Rennes', 'Brest', 'Quimper', 'Lorient', 'Vannes',
    'Saint-Brieuc', 'Saint-Malo', 'Lannion',
  ],
  'Normandie': [
    'Rouen', 'Caen', 'Le Havre', 'Cherbourg', 'Évreux',
    'Dieppe', 'Alençon', 'Lisieux',
  ],
  'Bourgogne-Franche-Comté': [
    'Dijon', 'Besançon', 'Belfort', 'Chalon-sur-Saône', 'Auxerre',
    'Nevers', 'Mâcon', 'Dole',
  ],
  'Centre-Val de Loire': [
    'Tours', 'Orléans', 'Bourges', 'Blois', 'Chartres',
    'Châteauroux', 'Dreux', 'Vierzon',
  ],
  'Corse': [
    'Ajaccio', 'Bastia', 'Porto-Vecchio', 'Corte', 'Calvi',
  ],
};

export const REGION_NAMES = Object.keys(REGIONS);

/**
 * Normalize a string for comparison (lowercase, remove accents, trim)
 */
function normalizeForComparison(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

// Build a reverse lookup map: normalized city name → region name
const cityToRegionMap: Map<string, string> = new Map();
for (const [region, cities] of Object.entries(REGIONS)) {
  for (const city of cities) {
    cityToRegionMap.set(normalizeForComparison(city), region);
  }
}

/**
 * Find the region for a given city name (accent-insensitive comparison)
 * Returns null if the city is not found in any region
 */
export function getCityRegion(city: string): string | null {
  return cityToRegionMap.get(normalizeForComparison(city)) ?? null;
}

/**
 * Approximate bounding boxes for French metropolitan regions
 * Used to determine region from GPS coordinates
 * Format: [minLat, maxLat, minLon, maxLon]
 */
const REGION_BOUNDS: Record<string, [number, number, number, number]> = {
  'Île-de-France': [48.12, 49.24, 1.45, 3.56],
  'Auvergne-Rhône-Alpes': [44.07, 46.80, 2.06, 7.19],
  'Nouvelle-Aquitaine': [42.78, 46.86, -1.80, 2.62],
  'Occitanie': [42.33, 44.97, -0.33, 4.85],
  'Hauts-de-France': [48.84, 51.09, 1.38, 4.25],
  'Provence-Alpes-Côte d\'Azur': [43.07, 45.13, 4.23, 7.72],
  'Grand Est': [47.42, 50.17, 3.38, 8.23],
  'Pays de la Loire': [46.27, 48.56, -2.56, 0.92],
  'Bretagne': [47.28, 48.90, -5.15, -1.01],
  'Normandie': [48.18, 49.73, -1.95, 1.80],
  'Bourgogne-Franche-Comté': [46.15, 48.40, 2.84, 7.15],
  'Centre-Val de Loire': [46.35, 48.94, 0.05, 3.13],
  'Corse': [41.37, 43.03, 8.57, 9.57],
};

/**
 * Determine region from GPS coordinates using bounding box lookup
 * Returns the first matching region, or null if no match
 */
export function getRegionFromCoords(lat: number, lon: number): string | null {
  for (const [region, [minLat, maxLat, minLon, maxLon]] of Object.entries(REGION_BOUNDS)) {
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      return region;
    }
  }
  return null;
}
