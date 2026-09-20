/**
 * Lecture des horaires d'équipe pour la vue Organisation.
 *
 * `availabilityRepository.getByProvider` renvoie TOUS les documents, y
 * compris les changements programmés pour plus tard (`effectiveFrom` dans
 * le futur). Les prendre tels quels ferait dire « a des horaires » à un
 * membre dont les horaires ne commencent que le mois prochain, et
 * mélangerait deux semaines différentes dans le même résumé.
 */

export interface HoraireLu {
  memberId: string;
  dayOfWeek: number;
  isOpen: boolean;
  slots?: { start: string; end: string }[] | null;
  effectiveFrom?: Date | null;
}

/** Lundi en tête : c'est l'ordre dans lequel un professionnel lit sa semaine. */
const ORDRE = [1, 2, 3, 4, 5, 6, 0];
const NOMS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/**
 * Ne garde, pour chaque (membre, jour), que le document réellement en
 * vigueur maintenant : `effectiveFrom` nul vaut « immédiat », et entre
 * deux dates passées la plus récente gagne.
 */
export function horairesEnVigueur<T extends HoraireLu>(horaires: T[], maintenant = new Date()): T[] {
  const retenus = new Map<string, T>();
  for (const h of horaires) {
    const debut = h.effectiveFrom ? new Date(h.effectiveFrom) : null;
    if (debut && debut.getTime() > maintenant.getTime()) continue;
    const cle = `${h.memberId}-${h.dayOfWeek}`;
    const actuel = retenus.get(cle);
    if (!actuel) {
      retenus.set(cle, h);
      continue;
    }
    const debutActuel = actuel.effectiveFrom ? new Date(actuel.effectiveFrom).getTime() : 0;
    if ((debut?.getTime() ?? 0) >= debutActuel) retenus.set(cle, h);
  }
  return [...retenus.values()];
}

function heure(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/**
 * « Lun–Ven · 9h–18h », ou `null` si ce membre n'a aucun horaire
 * enregistré. Les jours contigus sont regroupés en plage à partir de
 * trois, sinon ils sont énumérés : « Lun, Mer, Sam » reste plus clair que
 * trois fausses plages.
 */
export function resumerHoraires(horaires: HoraireLu[], memberId: string): string | null {
  const siens = horaires.filter(
    (h) => h.memberId === memberId && h.isOpen === true && (h.slots?.length ?? 0) > 0,
  );
  if (siens.length === 0) return null;

  const ouverts = ORDRE.filter((jour) => siens.some((h) => h.dayOfWeek === jour));
  if (ouverts.length === 0) return null;

  const groupes: number[][] = [];
  for (const jour of ouverts) {
    const dernier = groupes[groupes.length - 1];
    const contigu =
      dernier && ORDRE.indexOf(jour) === ORDRE.indexOf(dernier[dernier.length - 1]) + 1;
    if (contigu) dernier.push(jour);
    else groupes.push([jour]);
  }
  const jours = groupes
    .map((g) =>
      g.length >= 3 ? `${NOMS[g[0]]}–${NOMS[g[g.length - 1]]}` : g.map((j) => NOMS[j]).join(', '),
    )
    .join(', ');

  const bornes = ouverts.map((jour) => {
    const h = siens.find((x) => x.dayOfWeek === jour)!;
    const slots = [...(h.slots ?? [])].sort((a, b) => a.start.localeCompare(b.start));
    return { debut: slots[0].start, fin: slots[slots.length - 1].end };
  });
  const memeAmplitude =
    bornes.every((b) => b.debut === bornes[0].debut) && bornes.every((b) => b.fin === bornes[0].fin);

  return memeAmplitude
    ? `${jours} · ${heure(bornes[0].debut)}–${heure(bornes[0].fin)}`
    : `${jours} · horaires variables`;
}

/** Une journée telle que `setWeeklySchedule` l'attend. */
export interface JourACopier {
  dayOfWeek: number;
  slots: { start: string; end: string }[];
  isOpen: boolean;
}

/**
 * Prépare la recopie de la semaine d'un collègue sur quelqu'un d'autre.
 *
 * Deux règles que le reste du code ne rattrape pas :
 *  - les changements PROGRAMMÉS de la source ne sont pas copiés — sinon on
 *    poserait chez la cible, comme horaires du jour, une semaine qui ne
 *    commence que plus tard chez la source ;
 *  - le `locationId` écrit est celui de la CIBLE. Ce champ est dénormalisé
 *    depuis le membre ; prendre celui de la source enverrait les créneaux
 *    de la cible sur le lieu de quelqu'un d'autre.
 *
 * Le lieu de la cible est donc obligatoire : sans lui, on ne copie rien.
 *
 * Dès qu'il y a quelque chose à copier, la semaine renvoyée est COMPLÈTE.
 * On annonce au professionnel que les horaires de la cible sont
 * « remplacés » : n'envoyer que les jours présents chez la source laissait
 * en place, chez la cible, les jours que la source ne travaille pas — elle
 * restait ouverte un dimanche que la personne copiée ne travaille jamais.
 *
 * Une source qui n'a AUCUN horaire en vigueur renvoie en revanche une liste
 * vide : c'est « rien à copier », et l'appelant s'arrête là plutôt que de
 * fermer la semaine entière de la cible.
 */
export function preparerCopieHoraires(
  horairesSource: HoraireLu[],
  maintenant = new Date(),
): JourACopier[] {
  const enVigueur = horairesEnVigueur(horairesSource, maintenant);
  if (enVigueur.length === 0) return [];

  const source = new Map(enVigueur.map((h) => [h.dayOfWeek, h]));
  return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => {
    const h = source.get(dayOfWeek);
    return {
      dayOfWeek,
      slots: h ? [...(h.slots ?? [])] : [],
      isOpen: h?.isOpen === true,
    };
  });
}
