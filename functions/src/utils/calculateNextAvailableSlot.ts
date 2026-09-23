/**
 * Utility: calculateNextAvailableSlot
 *
 * Calcule la prochaine date disponible pour un provider.
 * Prend en compte les availabilities, blockedSlots et bookings existants.
 */

import * as admin from 'firebase-admin';
import { ajouterJours, jourLocal, jourSemaineCalendaire, minutesLocales, instantDepuisHeureLocale } from '../lib/fuseaux';
import { Timestamp } from 'firebase-admin/firestore';
import { serverTracker } from './serverTracker';

interface TimeSlot {
  start: string;
  end: string;
}

interface Availability {
  memberId: string;
  dayOfWeek: number;
  slots: TimeSlot[];
  isOpen: boolean;
}

interface BlockedSlot {
  memberId: string;
  startDate: admin.firestore.Timestamp;
  endDate: admin.firestore.Timestamp;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  /** Absent = 'continuous'. */
  spanMode?: 'continuous' | 'daily';
}

const MINUTES_PAR_JOUR = 24 * 60;

/** Intervalle en minutes depuis minuit. Fin exclusive. */
interface Tranche {
  debut: number;
  fin: number;
}

const hhmmEnMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** En FIN de fenêtre, « 00:00 » désigne minuit de fin de journée. */
const finEnMinutes = (hhmm: string): number => {
  const m = hhmmEnMinutes(hhmm);
  return m === 0 ? MINUTES_PAR_JOUR : m;
};

/**
 * La journée à laquelle appartient un instant, comme repère comparable.
 * Miroir de `jourRepere` (@booking-app/shared) : avec un fuseau, c'est la
 * date LOCALE DU LIEU — la seule qui ait un sens pour une période bloquée
 * saisie par le professionnel.
 */
const jourRepere = (d: Date, fuseau?: string): string => {
  if (fuseau) return jourLocal(d, fuseau);
  const copie = new Date(d);
  copie.setHours(0, 0, 0, 0);
  return copie.toISOString();
};

/**
 * MIROIR de `blockedWindowForDay` (@booking-app/shared) — ce paquet n'est pas
 * importable ici. Toute correction faite là-bas doit être reportée ici.
 *
 * Ce calcul ne lisait auparavant que `allDay` : une fermeture horaire n'y
 * comptait pour RIEN. Une journée bloquée de 09:00 à 18:00 était donc
 * annoncée disponible par `nextAvailableSlot`, alors que le moteur de
 * réservation, lui, refusait la réservation. Impossible de réserver pour de
 * vrai, mais l'indicateur mentait — le pire des deux mondes pour la cliente
 * qui s'y fie.
 *
 * Exportée pour qu'un contrôle d'équivalence puisse la comparer à la source
 * partagée : un miroir qu'on ne peut pas confronter dérive en silence.
 */
export function fenetreBloquee(bs: BlockedSlot, jour: Date, fuseau?: string): Tranche | null {
  const cible = jourRepere(jour, fuseau);
  const premierJour = jourRepere(bs.startDate.toDate(), fuseau);
  const dernierJour = jourRepere(bs.endDate.toDate(), fuseau);

  if (cible < premierJour || cible > dernierJour) return null;
  if (bs.allDay) return { debut: 0, fin: MINUTES_PAR_JOUR };
  if (!bs.startTime || !bs.endTime) return null;

  const estPremier = cible === premierJour;
  const estDernier = cible === dernierJour;

  if ((estPremier && estDernier) || bs.spanMode === 'daily') {
    return { debut: hhmmEnMinutes(bs.startTime), fin: finEnMinutes(bs.endTime) };
  }
  if (estPremier) return { debut: hhmmEnMinutes(bs.startTime), fin: MINUTES_PAR_JOUR };
  if (estDernier) return { debut: 0, fin: finEnMinutes(bs.endTime) };
  return { debut: 0, fin: MINUTES_PAR_JOUR };
}

/** Fusionne des tranches qui se chevauchent, pour ne rien compter deux fois. */
function fusionner(tranches: Tranche[]): Tranche[] {
  const valides = tranches
    .filter((t) => t.fin > t.debut)
    .sort((a, b) => a.debut - b.debut);
  const sortie: Tranche[] = [];
  for (const t of valides) {
    const derniere = sortie[sortie.length - 1];
    if (derniere && t.debut <= derniere.fin) {
      derniere.fin = Math.max(derniere.fin, t.fin);
    } else {
      sortie.push({ ...t });
    }
  }
  return sortie;
}

/**
 * Minutes réellement libres : l'ouverture, moins ce qui est occupé.
 *
 * L'ancienne version soustrayait bêtement la somme des réservations du total
 * d'ouverture. Un blocage et une réservation qui se recouvrent auraient donc
 * été comptés deux fois, et une occupation hors des heures d'ouverture aurait
 * été retirée alors qu'elle ne prend rien. D'où le passage par des tranches.
 */
function minutesLibres(ouverture: Tranche[], occupe: Tranche[]): number {
  const ouvert = fusionner(ouverture);
  const pris = fusionner(occupe);
  let total = 0;
  for (const o of ouvert) {
    let reste = o.fin - o.debut;
    for (const p of pris) {
      const debut = Math.max(o.debut, p.debut);
      const fin = Math.min(o.fin, p.fin);
      if (fin > debut) reste -= fin - debut;
    }
    total += Math.max(0, reste);
  }
  return total;
}

interface Booking {
  datetime: admin.firestore.Timestamp;
  endDatetime: admin.firestore.Timestamp;
  status: string;
}

export async function calculateNextAvailableSlot(providerId: string): Promise<Date | null> {
  const db = admin.firestore();

  console.log(`Calculating nextAvailableSlot for provider: ${providerId}`);

  // 1. Vérifier que le provider existe
  const providerDoc = await db.collection('providers').doc(providerId).get();
  serverTracker.trackRead('providers', 1);
  if (!providerDoc.exists) {
    console.log('Provider not found');
    return null;
  }

  // 1 bis. Le fuseau du SALON. Tout ce qui suit — jour de la semaine,
  // « est-il tard ? », minutes des rendez-vous — se lisait dans le fuseau
  // de la Cloud Function (UTC). Pour un salon réunionnais, la journée
  // commençait quatre heures trop tard.
  //
  // Absent (lieu pas encore résolu) → Europe/Paris, c'est-à-dire le
  // comportement d'avant : le serveur web force ce fuseau et c'est ce que
  // cet indicateur reflétait.
  let fuseauDuSalon = 'Europe/Paris';
  try {
    const lieux = await db
      .collection('providers')
      .doc(providerId)
      .collection('locations')
      .where('isActive', '==', true)
      .limit(5)
      .get();
    serverTracker.trackRead('providers/*/locations', lieux.size);
    const defaut = lieux.docs.find((d) => d.data().isDefault) ?? lieux.docs[0];
    fuseauDuSalon = defaut?.data().timezone || 'Europe/Paris';
  } catch {
    // Une lecture ratée ne doit pas priver la fiche de son indicateur.
  }

  // 2. Récupérer le premier membre actif
  const membersSnapshot = await db
    .collection('providers')
    .doc(providerId)
    .collection('members')
    .where('isActive', '==', true)
    .where('isDefault', '==', true)
    .limit(1)
    .get();
  serverTracker.trackRead('providers/*/members', membersSnapshot.size);

  // Si pas de membre par défaut, prendre le premier actif
  let memberDoc = membersSnapshot.docs[0];
  if (!memberDoc) {
    const anyMemberSnapshot = await db
      .collection('providers')
      .doc(providerId)
      .collection('members')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    serverTracker.trackRead('providers/*/members', anyMemberSnapshot.size);
    memberDoc = anyMemberSnapshot.docs[0];
  }

  if (!memberDoc) {
    console.log('No active member found');
    return null;
  }

  const memberId = memberDoc.id;
  console.log(`Using member: ${memberId}`);

  // 3. Récupérer les availabilities du membre
  // Note: la collection s'appelle 'availability' (singulier)
  const availabilitiesSnapshot = await db
    .collection('providers')
    .doc(providerId)
    .collection('availability')
    .where('memberId', '==', memberId)
    .get();
  serverTracker.trackRead('providers/*/availability', availabilitiesSnapshot.size);

  const availabilities = new Map<number, Availability>();
  availabilitiesSnapshot.docs.forEach(doc => {
    const data = doc.data() as Availability;
    availabilities.set(data.dayOfWeek, data);
  });

  console.log(`Found ${availabilities.size} availability rules`);

  if (availabilities.size === 0) {
    console.log('No availabilities configured');
    return null;
  }

  // 4. Récupérer les blockedSlots futurs (graceful fallback si index manquant)
  const now = new Date();
  let blockedSlots: BlockedSlot[] = [];
  try {
    const blockedSlotsSnapshot = await db
      .collection('providers')
      .doc(providerId)
      .collection('blockedSlots')
      .where('memberId', '==', memberId)
      .where('endDate', '>=', Timestamp.fromDate(now))
      .get();
    serverTracker.trackRead('providers/*/blockedSlots', blockedSlotsSnapshot.size);
    blockedSlots = blockedSlotsSnapshot.docs.map(doc => doc.data() as BlockedSlot);
  } catch (err) {
    // Index manquant ou autre erreur — on continue sans les blocked slots
    console.warn(`Could not fetch blockedSlots for ${providerId}, continuing without:`, (err as Error).message);
  }
  console.log(`Found ${blockedSlots.length} blocked slots`);

  // 5. Récupérer les bookings futurs (2 requêtes séparées pour éviter le problème d'index)
  const pendingBookingsSnapshot = await db
    .collection('bookings')
    .where('providerId', '==', providerId)
    .where('memberId', '==', memberId)
    .where('status', '==', 'pending')
    .get();
  serverTracker.trackRead('bookings', pendingBookingsSnapshot.size);

  const confirmedBookingsSnapshot = await db
    .collection('bookings')
    .where('providerId', '==', providerId)
    .where('memberId', '==', memberId)
    .where('status', '==', 'confirmed')
    .get();
  serverTracker.trackRead('bookings', confirmedBookingsSnapshot.size);

  // Filtrer pour ne garder que les futurs
  const allBookings = [
    ...pendingBookingsSnapshot.docs,
    ...confirmedBookingsSnapshot.docs,
  ];

  const futureBookings = allBookings
    .map(doc => doc.data() as Booking)
    .filter(b => b.datetime.toDate() >= now);

  console.log(`Found ${futureBookings.length} future bookings`);

  // 6. Parcourir les 60 prochains jours, DANS LE FUSEAU DU SALON.
  //
  // Tout ce bloc lisait l'heure de la Cloud Function (UTC) : le jour de la
  // semaine, l'heure qu'il est, et les minutes des rendez-vous. Pour un
  // salon réunionnais, « aujourd'hui » commençait quatre heures trop tard
  // et le jour de la semaine pouvait être le mauvais.
  const jourAujourdhui = jourLocal(now, fuseauDuSalon);

  // Déjà tard CHEZ LE SALON ? On commence demain.
  const nowHours = Math.floor(minutesLocales(now, fuseauDuSalon) / 60);
  const startOffset = nowHours >= 18 ? 1 : 0;

  for (let i = startOffset; i < 60; i++) {
    const jour = ajouterJours(jourAujourdhui, i);
    const dayOfWeek = jourSemaineCalendaire(jour);
    const availability = availabilities.get(dayOfWeek);

    // Jour fermé ?
    if (!availability || !availability.isOpen || !availability.slots?.length) {
      continue;
    }

    // Ouverture du jour, en tranches de minutes.
    const ouverture: Tranche[] = availability.slots.map(slot => ({
      debut: hhmmEnMinutes(slot.start),
      fin: finEnMinutes(slot.end),
    }));

    // Ce que les blocages retirent — journée entière ET fermetures horaires,
    // continues ou quotidiennes.
    // `fenetreBloquee` compare des journées : on lui donne un instant qui
    // tombe à coup sûr dans CETTE journée locale — midi sur place.
    const midiLocal = instantDepuisHeureLocale(jour, 12 * 60, fuseauDuSalon) ?? new Date();
    const tranchesBloquees = blockedSlots
      .map(bs => fenetreBloquee(bs, midiLocal, fuseauDuSalon))
      .filter((t): t is Tranche => t !== null);

    // Ce que les rendez-vous déjà pris retirent — en minutes LOCALES.
    const tranchesReservees = futureBookings
      .filter(b => jourLocal(b.datetime.toDate(), fuseauDuSalon) === jour)
      .map(b => {
        const debutRdv = b.datetime.toDate();
        const finRdv = b.endDatetime.toDate();
        const debut = minutesLocales(debutRdv, fuseauDuSalon);
        const brut = minutesLocales(finRdv, fuseauDuSalon);
        // Un rendez-vous qui déborde sur le lendemain retombe à une fin plus
        // petite que son début : il prend alors tout le reste de la journée.
        return { debut, fin: brut > debut ? brut : MINUTES_PAR_JOUR };
      });

    const availableMinutes = minutesLibres(ouverture, [
      ...tranchesBloquees,
      ...tranchesReservees,
    ]);
    const minServiceDuration = 30; // Durée minimum d'un service

    if (availableMinutes >= minServiceDuration) {
      // On rend le DÉBUT de cette journée locale, pas minuit chez la
      // Function : c'est la date que la fiche affichera.
      const debutDeLaJournee = instantDepuisHeureLocale(jour, 0, fuseauDuSalon);
      console.log(
        `Found available date: ${jour} (${availableMinutes} minutes available, ${fuseauDuSalon})`,
      );
      return debutDeLaJournee ?? new Date(`${jour}T00:00:00Z`);
    }
  }

  console.log('No available slot found in the next 60 days');
  return null;
}
