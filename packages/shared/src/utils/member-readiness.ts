/**
 * « Ce membre peut-il recevoir des réservations ? » — LE calcul unique.
 *
 * Trois réglages doivent concorder pour qu'un créneau existe : le membre
 * est actif, il a des horaires ENREGISTRÉS, et au moins une prestation le
 * désigne. Rien ne le disait à l'écran : sur le compte Studio du
 * 2026-09-18, deux membres paraissaient configurés — l'éditeur d'horaires
 * affiche « lun–ven 9 h–18 h » même quand RIEN n'est en base — et leurs
 * prestations n'étaient réservables aucun jour.
 *
 * Cette fonction est la source de vérité partagée : la pastille de
 * l'espace pro, et demain tout contrôle de santé, doivent l'appeler plutôt
 * que réécrire la règle une troisième fois.
 */

/** Ce dont on a besoin d'un membre — pas le type complet, pour rester utilisable partout. */
export interface MembreVerifiable {
  id: string;
  isActive?: boolean | null;
  locationId?: string | null;
}

/** Ce dont on a besoin d'une prestation. */
export interface PrestationVerifiable {
  id: string;
  isActive?: boolean | null;
  isAvailable?: boolean | null;
  memberIds?: string[] | null;
  locationIds?: string[] | null;
}

/** Ce dont on a besoin d'un horaire hebdomadaire. */
export interface HoraireVerifiable {
  memberId?: string | null;
  isOpen?: boolean | null;
  slots?: { start: string; end: string }[] | null;
}

export type BlocageMembre = 'inactif' | 'sansHoraires' | 'sansPrestation' | 'lieuInactif';

export interface EtatMembre {
  /** Vrai seulement si AUCUN blocage : des créneaux peuvent exister. */
  reservable: boolean;
  blocages: BlocageMembre[];
  /** Prestations que ce membre réalise effectivement (identifiants). */
  prestations: string[];
}

/**
 * Un membre réalise-t-il cette prestation ? Cascade RECOPIÉE du tunnel de
 * réservation (`BookingFlow.availableMembers`), et c'est elle qui fait foi :
 *
 *   1. des membres sont désignés → seule cette liste compte, les lieux de
 *      la prestation ne sont PLUS regardés ;
 *   2. sinon des lieux sont désignés → le lieu du membre doit en faire partie ;
 *   3. sinon → tout le monde la réalise.
 *
 * Le point 1 est contre-intuitif : une prestation limitée au lieu A mais
 * attribuée à un membre du lieu B reste réservable en B.
 */
export function membreRealisePrestation(
  service: PrestationVerifiable,
  memberId: string,
  memberLocationId?: string | null,
): boolean {
  if (service.memberIds && service.memberIds.length > 0) {
    return service.memberIds.includes(memberId);
  }
  if (service.locationIds && service.locationIds.length > 0) {
    return memberLocationId ? service.locationIds.includes(memberLocationId) : false;
  }
  return true;
}

/**
 * Diagnostic d'un membre. `availabilities` peut contenir les horaires de
 * TOUTE l'équipe : on filtre sur `memberId`.
 *
 * `lieuxActifs` est facultatif — les identifiants des lieux actifs. Quand
 * il est fourni, un membre rattaché à un lieu désactivé est signalé :
 * désactiver un lieu ne détache personne, et le tunnel de réservation ne
 * lit que les lieux actifs, si bien que ces membres n'étaient joignables
 * nulle part tout en affichant « prêt ».
 */
export function diagnostiquerMembre(
  member: MembreVerifiable,
  services: PrestationVerifiable[],
  availabilities: HoraireVerifiable[],
  lieuxActifs?: string[] | null,
): EtatMembre {
  const blocages: BlocageMembre[] = [];

  if (member.isActive === false) blocages.push('inactif');

  // Liste VIDE = « on ne sait pas », comme partout ailleurs ici : c'est
  // aussi l'état de l'écran tant que les lieux ne sont pas chargés, et
  // signaler toute l'équipe en « lieu désactivé » pendant une seconde
  // ferait plus de mal qu'un blocage manqué.
  if (lieuxActifs?.length && member.locationId && !lieuxActifs.includes(member.locationId)) {
    blocages.push('lieuInactif');
  }

  // Un jour ouvert SANS plage horaire ne produit aucun créneau : on exige
  // les deux, comme le moteur de disponibilités.
  const aDesHoraires = availabilities.some(
    (a) => a.memberId === member.id && a.isOpen === true && (a.slots?.length ?? 0) > 0,
  );
  if (!aDesHoraires) blocages.push('sansHoraires');

  // Une prestation suspendue ou désactivée ne rend personne réservable.
  const prestations = services
    .filter((s) => s.isActive !== false && s.isAvailable !== false)
    .filter((s) => membreRealisePrestation(s, member.id, member.locationId))
    .map((s) => s.id);
  if (prestations.length === 0) blocages.push('sansPrestation');

  return { reservable: blocages.length === 0, blocages, prestations };
}
