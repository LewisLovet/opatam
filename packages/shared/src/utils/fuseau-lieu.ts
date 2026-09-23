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

/**
 * Codes postaux qui tranchent à eux seuls, quand les coordonnées manquent.
 *
 * C'EST LE CAS DE M.A BARBER : lieu en « FR », sans coordonnées. Sans cette
 * table, la résolution répondait « Europe/Paris » — le salon est à
 * Saint-Denis de La Réunion. Un code postal en 974 ne laisse aucun doute.
 *
 * Les préfixes sont donnés du plus long au plus court à la lecture : 97 et
 * 98 couvrent tout l'outre-mer français, 35/38 les Canaries, 90/95/96 les
 * archipels portugais.
 */
const CODES_POSTAUX: Record<string, { prefixes: string[]; fuseau: string; libelle: string }[]> = {
  FR: [
    { prefixes: ['971', '977', '978'], fuseau: 'America/Guadeloupe', libelle: 'Guadeloupe / Saint-Martin' },
    { prefixes: ['972'], fuseau: 'America/Martinique', libelle: 'Martinique' },
    { prefixes: ['973'], fuseau: 'America/Cayenne', libelle: 'Guyane' },
    { prefixes: ['974'], fuseau: 'Indian/Reunion', libelle: 'La Réunion' },
    { prefixes: ['975'], fuseau: 'America/Miquelon', libelle: 'Saint-Pierre-et-Miquelon' },
    { prefixes: ['976'], fuseau: 'Indian/Mayotte', libelle: 'Mayotte' },
    { prefixes: ['986'], fuseau: 'Pacific/Wallis', libelle: 'Wallis-et-Futuna' },
    { prefixes: ['987'], fuseau: 'Pacific/Tahiti', libelle: 'Polynésie française' },
    { prefixes: ['988'], fuseau: 'Pacific/Noumea', libelle: 'Nouvelle-Calédonie' },
  ],
  ES: [
    { prefixes: ['35', '38'], fuseau: 'Atlantic/Canary', libelle: 'Îles Canaries' },
  ],
  PT: [
    { prefixes: ['90'], fuseau: 'Atlantic/Madeira', libelle: 'Madère' },
    { prefixes: ['95', '96'], fuseau: 'Atlantic/Azores', libelle: 'Açores' },
  ],
};

/**
 * Pays où un lieu SANS coordonnées ET sans code postal exploitable ne peut
 * pas être tranché : leur territoire s'étend sur plusieurs fuseaux.
 *
 * Pour les autres — Belgique, Luxembourg, Suisse, Allemagne, Italie,
 * Pays-Bas — le fuseau du pays est le seul possible, coordonnées ou non.
 */
const PLUSIEURS_FUSEAUX = new Set(['FR', 'ES', 'PT']);

export interface Coordonnees {
  latitude: number;
  longitude: number;
}

export interface ResolutionFuseau {
  /** L'identifiant IANA, ou `null` quand on ne peut pas trancher sûrement. */
  fuseau: string | null;
  /** Comment on est arrivé là — pour l'expliquer dans un rapport. */
  motif: 'territoire' | 'archipel' | 'code-postal' | 'pays' | 'inconnu';
  /** « La Réunion », « FR (métropole) »… */
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
  postalCode?: string | null,
): ResolutionFuseau {
  const pays = (countryCode ?? '').toUpperCase();
  const aDesCoordonnees =
    !!coordonnees &&
    Number.isFinite(coordonnees.latitude) &&
    Number.isFinite(coordonnees.longitude) &&
    // (0, 0) est le golfe de Guinée, jamais un salon : c'est la trace
    // d'un géocodage raté. La traiter comme des coordonnées valides
    // ferait passer le lieu pour « métropolitain » sans le moindre doute.
    !(coordonnees.latitude === 0 && coordonnees.longitude === 0);

  // 1. Les coordonnées, quand on les a : c'est le signal le plus précis.
  if (aDesCoordonnees) {
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

  // 2. Le code postal, qui tranche l'outre-mer sans ambiguïté.
  const code = (postalCode ?? '').replace(/\s/g, '');
  const tables = CODES_POSTAUX[pays] ?? [];
  for (const entree of tables) {
    if (entree.prefixes.some((prefixe) => code.startsWith(prefixe))) {
      return { fuseau: entree.fuseau, motif: 'code-postal', libelle: entree.libelle };
    }
  }

  const principal = FUSEAU_PRINCIPAL[pays];

  // 3. Un pays à PLUSIEURS fuseaux, sans coordonnées ni code postal
  //    exploitable : on REFUSE de trancher.
  //
  //    C'est le cas qui a failli passer en production : M.A Barber est un
  //    lieu « FR » sans coordonnées, et répondre « Europe/Paris » aurait
  //    écrit noir sur blanc, dans la base, le bug qu'on est en train de
  //    corriger. Un salon réunionnais n'est pas à Paris parce qu'on manque
  //    d'informations.
  if (principal && PLUSIEURS_FUSEAUX.has(pays) && !aDesCoordonnees && !code) {
    return {
      fuseau: null,
      motif: 'inconnu',
      libelle: `${pays} sans coordonnées ni code postal — à trancher à la main`,
    };
  }

  if (principal) {
    return {
      fuseau: principal,
      motif: 'pays',
      libelle: aDesCoordonnees || code ? `${pays} (métropole)` : `${pays} (fuseau unique)`,
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
