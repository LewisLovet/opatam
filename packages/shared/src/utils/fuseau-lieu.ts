/**
 * Quel fuseau pour ce lieu ? — résolution SANS réseau.
 *
 * ── Pourquoi le code pays ne suffit pas ─────────────────────────────────
 * Le code existant fait `FR → Europe/Paris`. La Réunion est en `FR`. Le
 * récapitulatif quotidien de M.A Barber part donc déjà à la mauvaise heure,
 * indépendamment des créneaux. La France compte une dizaine de fuseaux
 * outre-mer, les États-Unis six : il faut les COORDONNÉES.
 *
 * ── Ce que ce module fait, et surtout ce qu'il ne fait pas ──────────────
 * Il tranche les cas qu'on peut trancher sûrement : les neuf pays servis,
 * et les territoires français d'outre-mer par leur boîte englobante. Pour
 * tout le reste — États-Unis compris, où la frontière Indiana/Arizona ne
 * se déduit pas d'une longitude — il rend `null`.
 *
 * `null` n'est PAS un échec, c'est une réponse : « je ne sais pas, demande
 * à l'API ou au professionnel ». Le remplacer par un fuseau plausible
 * serait exactement le réflexe qui a mis « Europe/Paris » sur les
 * prestataires portugais.
 */

/** Une boîte englobante, en degrés décimaux. */
interface Boite {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  fuseau: string;
  /** Pour les messages : « La Réunion », « Martinique »… */
  libelle: string;
}

/**
 * Territoires français hors métropole, par boîte englobante.
 *
 * Les boîtes sont volontairement LARGES : une île isolée de plusieurs
 * centaines de kilomètres n'a pas de voisine avec qui se confondre, et une
 * boîte trop serrée raterait un salon en périphérie.
 */
const TERRITOIRES_FR: Boite[] = [
  { libelle: 'Guadeloupe', fuseau: 'America/Guadeloupe', latMin: 15.7, latMax: 16.6, lonMin: -61.9, lonMax: -60.8 },
  { libelle: 'Martinique', fuseau: 'America/Martinique', latMin: 14.2, latMax: 15.0, lonMin: -61.3, lonMax: -60.7 },
  { libelle: 'Guyane', fuseau: 'America/Cayenne', latMin: 2.0, latMax: 6.0, lonMin: -55.0, lonMax: -51.0 },
  { libelle: 'La Réunion', fuseau: 'Indian/Reunion', latMin: -21.5, latMax: -20.7, lonMin: 55.1, lonMax: 56.0 },
  { libelle: 'Mayotte', fuseau: 'Indian/Mayotte', latMin: -13.2, latMax: -12.5, lonMin: 44.9, lonMax: 45.4 },
  { libelle: 'Saint-Pierre-et-Miquelon', fuseau: 'America/Miquelon', latMin: 46.7, latMax: 47.2, lonMin: -56.5, lonMax: -56.1 },
  { libelle: 'Saint-Martin / Saint-Barthélemy', fuseau: 'America/Guadeloupe', latMin: 17.8, latMax: 18.2, lonMin: -63.2, lonMax: -62.7 },
  { libelle: 'Polynésie française', fuseau: 'Pacific/Tahiti', latMin: -28.0, latMax: -7.0, lonMin: -155.0, lonMax: -134.0 },
  { libelle: 'Nouvelle-Calédonie', fuseau: 'Pacific/Noumea', latMin: -23.0, latMax: -19.5, lonMin: 163.5, lonMax: 168.5 },
  { libelle: 'Wallis-et-Futuna', fuseau: 'Pacific/Wallis', latMin: -14.5, latMax: -13.1, lonMin: -178.5, lonMax: -176.0 },
];

/**
 * Fuseau principal des pays servis. Aucun n'a de second fuseau habité sur
 * son territoire continental — sauf la France, traitée juste au-dessus.
 */
const FUSEAU_PRINCIPAL: Record<string, string> = {
  FR: 'Europe/Paris',
  BE: 'Europe/Brussels',
  LU: 'Europe/Luxembourg',
  CH: 'Europe/Zurich',
  DE: 'Europe/Berlin',
  ES: 'Europe/Madrid',
  IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam',
  PT: 'Europe/Lisbon',
};

/**
 * L'Espagne et le Portugal ont eux aussi des archipels à l'heure d'un autre
 * fuseau. Un salon aux Canaries ou aux Açores est rare, mais il serait
 * décalé d'une heure toute l'année.
 */
const ARCHIPELS: Boite[] = [
  { libelle: 'Îles Canaries', fuseau: 'Atlantic/Canary', latMin: 27.5, latMax: 29.5, lonMin: -18.3, lonMax: -13.3 },
  { libelle: 'Açores', fuseau: 'Atlantic/Azores', latMin: 36.9, latMax: 39.8, lonMin: -31.3, lonMax: -24.9 },
  { libelle: 'Madère', fuseau: 'Atlantic/Madeira', latMin: 32.4, latMax: 33.2, lonMin: -17.3, lonMax: -16.2 },
];

export interface Coordonnees {
  latitude: number;
  longitude: number;
}

export interface ResolutionFuseau {
  /** L'identifiant IANA, ou `null` quand on ne peut pas trancher sûrement. */
  fuseau: string | null;
  /** Comment on est arrivé là — pour l'expliquer dans un rapport. */
  motif: 'territoire' | 'archipel' | 'pays' | 'inconnu';
  /** « La Réunion », « France métropolitaine »… */
  libelle: string;
}

function dansLaBoite(c: Coordonnees, b: Boite): boolean {
  return (
    c.latitude >= b.latMin &&
    c.latitude <= b.latMax &&
    c.longitude >= b.lonMin &&
    c.longitude <= b.lonMax
  );
}

/**
 * Le fuseau d'un lieu, d'après ses coordonnées et son pays.
 *
 * Les coordonnées priment sur le pays : c'est tout l'objet du module. Le
 * pays ne sert qu'à choisir le fuseau principal quand aucun territoire
 * particulier ne correspond, et à ne pas placer en Guyane un salon dont les
 * coordonnées sont absentes.
 *
 * `null` pour un pays non servi — États-Unis compris. Mieux vaut demander
 * que se tromper : six fuseaux, des exceptions par comté, et une erreur
 * d'une heure passerait inaperçue jusqu'à la première cliente fâchée.
 */
export function resoudreFuseauDeLieu(
  coordonnees: Coordonnees | null | undefined,
  countryCode: string | null | undefined,
): ResolutionFuseau {
  const pays = (countryCode ?? '').toUpperCase();

  if (coordonnees && Number.isFinite(coordonnees.latitude) && Number.isFinite(coordonnees.longitude)) {
    for (const boite of [...TERRITOIRES_FR, ...ARCHIPELS]) {
      if (dansLaBoite(coordonnees, boite)) {
        return {
          fuseau: boite.fuseau,
          motif: TERRITOIRES_FR.includes(boite) ? 'territoire' : 'archipel',
          libelle: boite.libelle,
        };
      }
    }
  }

  const principal = FUSEAU_PRINCIPAL[pays];
  if (principal) {
    // Sans coordonnées, on n'a que le pays. C'est juste pour la métropole
    // et faux pour l'outre-mer : le rapport doit le dire, d'où le libellé.
    return {
      fuseau: principal,
      motif: 'pays',
      libelle: coordonnees ? `${pays} (continental)` : `${pays} (sans coordonnées)`,
    };
  }

  return { fuseau: null, motif: 'inconnu', libelle: pays || 'pays inconnu' };
}

/**
 * Un lieu a-t-il besoin d'une résolution ?
 *
 * On ne refait jamais le calcul d'un fuseau posé À LA MAIN : une correction
 * manuelle existe précisément parce que l'automatique s'était trompé.
 */
export function aBesoinDeResolution(lieu: {
  timezone?: string | null;
  timezoneSource?: 'automatic' | 'manual' | null;
}): boolean {
  if (lieu.timezoneSource === 'manual') return false;
  return !lieu.timezone;
}
