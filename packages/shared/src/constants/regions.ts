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

export const REGION_NAMES = Object.keys(REGIONS).sort((a, b) =>
  a.localeCompare(b, 'fr', { sensitivity: 'base' })
);

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

/**
 * Région à partir du code postal — le repli le plus sûr : le département
 * est dans les deux ou trois premiers chiffres, et il ne dépend ni d'une
 * liste de villes, ni d'un géocodage réussi. Couvre la métropole (Corse
 * incluse) et les cinq départements d'outre-mer.
 */
const DEPARTEMENT_REGION: Record<string, string> = {
  '01': 'Auvergne-Rhône-Alpes', '03': 'Auvergne-Rhône-Alpes', '07': 'Auvergne-Rhône-Alpes', '15': 'Auvergne-Rhône-Alpes', '26': 'Auvergne-Rhône-Alpes', '38': 'Auvergne-Rhône-Alpes', '42': 'Auvergne-Rhône-Alpes', '43': 'Auvergne-Rhône-Alpes', '63': 'Auvergne-Rhône-Alpes', '69': 'Auvergne-Rhône-Alpes', '73': 'Auvergne-Rhône-Alpes', '74': 'Auvergne-Rhône-Alpes',
  '21': 'Bourgogne-Franche-Comté', '25': 'Bourgogne-Franche-Comté', '39': 'Bourgogne-Franche-Comté', '58': 'Bourgogne-Franche-Comté', '70': 'Bourgogne-Franche-Comté', '71': 'Bourgogne-Franche-Comté', '89': 'Bourgogne-Franche-Comté', '90': 'Bourgogne-Franche-Comté',
  '22': 'Bretagne', '29': 'Bretagne', '35': 'Bretagne', '56': 'Bretagne',
  '18': 'Centre-Val de Loire', '28': 'Centre-Val de Loire', '36': 'Centre-Val de Loire', '37': 'Centre-Val de Loire', '41': 'Centre-Val de Loire', '45': 'Centre-Val de Loire',
  '20': 'Corse', '2A': 'Corse', '2B': 'Corse',
  '08': 'Grand Est', '10': 'Grand Est', '51': 'Grand Est', '52': 'Grand Est', '54': 'Grand Est', '55': 'Grand Est', '57': 'Grand Est', '67': 'Grand Est', '68': 'Grand Est', '88': 'Grand Est',
  '02': 'Hauts-de-France', '59': 'Hauts-de-France', '60': 'Hauts-de-France', '62': 'Hauts-de-France', '80': 'Hauts-de-France',
  '75': 'Île-de-France', '77': 'Île-de-France', '78': 'Île-de-France', '91': 'Île-de-France', '92': 'Île-de-France', '93': 'Île-de-France', '94': 'Île-de-France', '95': 'Île-de-France',
  '14': 'Normandie', '27': 'Normandie', '50': 'Normandie', '61': 'Normandie', '76': 'Normandie',
  '16': 'Nouvelle-Aquitaine', '17': 'Nouvelle-Aquitaine', '19': 'Nouvelle-Aquitaine', '23': 'Nouvelle-Aquitaine', '24': 'Nouvelle-Aquitaine', '33': 'Nouvelle-Aquitaine', '40': 'Nouvelle-Aquitaine', '47': 'Nouvelle-Aquitaine', '64': 'Nouvelle-Aquitaine', '79': 'Nouvelle-Aquitaine', '86': 'Nouvelle-Aquitaine', '87': 'Nouvelle-Aquitaine',
  '09': 'Occitanie', '11': 'Occitanie', '12': 'Occitanie', '30': 'Occitanie', '31': 'Occitanie', '32': 'Occitanie', '34': 'Occitanie', '46': 'Occitanie', '48': 'Occitanie', '65': 'Occitanie', '66': 'Occitanie', '81': 'Occitanie', '82': 'Occitanie',
  '44': 'Pays de la Loire', '49': 'Pays de la Loire', '53': 'Pays de la Loire', '72': 'Pays de la Loire', '85': 'Pays de la Loire',
  '04': "Provence-Alpes-Côte d'Azur", '05': "Provence-Alpes-Côte d'Azur", '06': "Provence-Alpes-Côte d'Azur", '13': "Provence-Alpes-Côte d'Azur", '83': "Provence-Alpes-Côte d'Azur", '84': "Provence-Alpes-Côte d'Azur",
  '971': 'Guadeloupe', '972': 'Martinique', '973': 'Guyane', '974': 'La Réunion', '976': 'Mayotte',
};

export function getRegionFromPostalCode(postalCode: string | null | undefined): string | null {
  const cp = (postalCode ?? '').replace(/\s+/g, '');
  if (!/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith('97')) return DEPARTEMENT_REGION[cp.slice(0, 3)] ?? null;
  return DEPARTEMENT_REGION[cp.slice(0, 2)] ?? null;
}
