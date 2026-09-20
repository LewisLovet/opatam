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
 * `lieuxActifs` — les identifiants des lieux actifs. Désactiver un lieu ne
 * détache personne et le tunnel ne lit que les lieux actifs, si bien que
 * ces membres affichaient « prêt » sans être joignables nulle part.
 *
 * Trois états DISTINCTS, à ne pas confondre :
 *  - absent (`undefined` / `null`) → contrôle désactivé. C'est ce que
 *    l'appelant passe tant que ses lieux ne sont pas chargés ;
 *  - tableau VIDE → aucun lieu utilisable, donc personne n'est joignable.
 *    Un lieu est créé à l'inscription et `locationId` est obligatoire à la
 *    création d'un membre : en vraie donnée, une liste vide veut dire que
 *    le pro a désactivé tous ses lieux, pas qu'on ne sait pas ;
 *  - membre sans lieu, ou rattaché à un lieu inconnu (supprimé) → bloqué
 *    aussi : il n'apparaît sous aucun lieu.
 */
export function diagnostiquerMembre(
  member: MembreVerifiable,
  services: PrestationVerifiable[],
  availabilities: HoraireVerifiable[],
  lieuxActifs?: string[] | null,
): EtatMembre {
  const blocages: BlocageMembre[] = [];

  if (member.isActive === false) blocages.push('inactif');

  if (lieuxActifs && (!member.locationId || !lieuxActifs.includes(member.locationId))) {
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
