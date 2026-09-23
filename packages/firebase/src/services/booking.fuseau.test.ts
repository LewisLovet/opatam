/**
 * Ce qu'une réservation FIGE de son heure locale — chantier fuseaux, étapes 4 et 5.
 *
 *   TZ=Europe/Paris npx tsx --test packages/firebase/src/services/booking.fuseau.test.ts
 *
 * Deux règles s'y vérifient, et elles comptent plus que le reste :
 *
 *  1. Le fuseau vient du LIEU, RELU EN BASE. Jamais d'un paramètre envoyé
 *     par le client. Même principe que la garde serveur sur les
 *     `serviceIds` : une vérification qui fait confiance à son appelant ne
 *     vérifie rien.
 *  2. L'heure locale convenue est FIGÉE sur la réservation. `datetime` est
 *     un instant : il ne dit pas à quelle heure la cliente a réservé. Sans
 *     ces champs, un prestataire qui corrige son fuseau ferait changer
 *     d'heure tous ses rendez-vous passés à l'écran.
 *
 * TZ=Europe/Paris est imposé pour la même raison qu'ailleurs : c'est le
 * fuseau du serveur web, et un test qui s'adapterait à la machine ne
 * prouverait rien.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bookingRepository,
  locationRepository,
  memberRepository,
  providerRepository,
  serviceRepository,
} from '../repositories';
import { schedulingService } from './scheduling.service';
import { bookingService } from './booking.service';

const tzMachine = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (tzMachine !== 'Europe/Paris') {
  throw new Error(
    `Ce test suppose le fuseau du serveur web (Europe/Paris) ; la machine est en ${tzMachine}.\n` +
      `  TZ=Europe/Paris npx tsx --test packages/firebase/src/services/booking.fuseau.test.ts`,
  );
}

const anyOf = <T,>(o: T) => o as unknown as Record<string, unknown>;

/** Ce que la réservation écrite contient, capturé au vol. */
interface Capture {
  ecrit: Record<string, unknown> | null;
  fuseauVerifie: string | undefined;
}

function armer(timezoneDuLieu: string | null): Capture {
  const capture: Capture = { ecrit: null, fuseauVerifie: undefined };

  anyOf(providerRepository).getById = async () => ({
    id: 'p1',
    businessName: 'Salon',
    photoURL: null,
    settings: { slotInterval: 30, minBookingNotice: 2, defaultBufferTime: 0 },
  });
  anyOf(locationRepository).getById = async () => ({
    id: 'l1',
    name: 'Salon',
    address: '1 rue',
    postalCode: '97400',
    city: 'Saint-Denis',
    protectAddress: false,
    isActive: true,
    timezone: timezoneDuLieu,
  });
  anyOf(serviceRepository).getById = async () => ({
    id: 's1',
    name: 'Coupe',
    duration: 60,
    bufferTime: 0,
    price: 3000,
    priceMax: null,
    isActive: true,
    isAvailable: true,
    color: null,
    memberIds: null,
    locationIds: [],
    deposit: null,
  });
  anyOf(memberRepository).getById = async () => ({
    id: 'm1', name: 'Anne', photoURL: null, color: null, locationId: 'l1', isActive: true,
  });
  anyOf(memberRepository).getByProvider = async () => [
    { id: 'm1', name: 'Anne', photoURL: null, color: null, locationId: 'l1', isActive: true },
  ];

  // La disponibilité n'est pas le sujet : on l'accepte, mais on NOTE le
  // fuseau que le service lui a transmis.
  anyOf(schedulingService).isSlotAvailable = async (params: { timeZone?: string }) => {
    capture.fuseauVerifie = params.timeZone;
    return true;
  };

  anyOf(bookingRepository).create = async (doc: Record<string, unknown>) => {
    capture.ecrit = doc;
    return 'b1';
  };
  anyOf(bookingRepository).getById = async () => ({ id: 'b1', ...(capture.ecrit ?? {}) });

  return capture;
}

/** 08:00 à La Réunion le 16 novembre 2026 = 04:00 UTC. */
const INSTANT_REUNION = new Date('2026-11-16T04:00:00Z');

const entree = {
  providerId: 'p1',
  memberId: 'm1',
  locationId: 'l1',
  serviceId: 's1',
  datetime: INSTANT_REUNION,
  clientInfo: { name: 'Léa M', email: 'lea@example.com', phone: '+262692000000' },
};

describe('le fuseau vient du LIEU, relu en base', () => {
  it('il est transmis à la vérification de disponibilité', async () => {
    const capture = armer('Indian/Reunion');
    await bookingService.createBooking(entree as never);
    assert.equal(capture.fuseauVerifie, 'Indian/Reunion');
  });

  it('un lieu SANS fuseau ne fabrique pas « Europe/Paris »', async () => {
    // L'absence doit rester une absence : c'est le repli silencieux qui a
    // mis ce fuseau sur les prestataires portugais.
    const capture = armer(null);
    await bookingService.createBooking(entree as never);
    assert.equal(capture.fuseauVerifie, undefined);
    assert.equal(capture.ecrit?.timezone, undefined);
    assert.equal(capture.ecrit?.localStartTime, undefined);
  });
});

describe('l’heure locale convenue est figée sur la réservation', () => {
  it('un rendez-vous réunionnais garde 08:00, pas l’heure de Paris', async () => {
    const capture = armer('Indian/Reunion');
    await bookingService.createBooking(entree as never);
    assert.equal(capture.ecrit?.timezone, 'Indian/Reunion');
    assert.equal(capture.ecrit?.localDate, '2026-11-16');
    assert.equal(capture.ecrit?.localStartTime, '08:00');
    assert.equal(capture.ecrit?.localEndTime, '09:00');
    // Le même instant vaut 05:00 à Paris : c'est ce que l'écran affichait.
    assert.equal((capture.ecrit?.datetime as Date).toISOString(), '2026-11-16T04:00:00.000Z');
  });

  it('la provenance est conservée', async () => {
    // Elle transitait déjà par la route sans jamais être écrite : sans
    // elle, aucune migration des anciens rendez-vous n'est possible.
    const capture = armer('Indian/Reunion');
    await bookingService.createBooking(entree as never, { createdVia: 'pro' });
    assert.equal(capture.ecrit?.createdVia, 'pro');
  });

  it('sans provenance fournie, le champ n’est pas inventé', async () => {
    const capture = armer('Indian/Reunion');
    await bookingService.createBooking(entree as never);
    assert.equal(capture.ecrit?.createdVia, undefined);
  });
});
