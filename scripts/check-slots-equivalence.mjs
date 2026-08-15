/**
 * Non-régression du batching de `getAvailableSlots`.
 *
 * CE QUI A CHANGÉ dans le service : uniquement la FAÇON DE LIRE. Avant, la
 * boucle rouvrait `availability`, `bookings` et `blockedSlots` à chaque jour ;
 * désormais les trois sont lus une fois sur l'intervalle. La génération et le
 * filtrage des créneaux sont inchangés.
 *
 * CE QUE CE SCRIPT VÉRIFIE : que ces deux façons de lire aboutissent aux mêmes
 * créneaux, sur des données RÉELLES. Il rejoue les deux structures de boucle
 * sur les documents Firestore d'un prestataire, pour chacun de ses membres et
 * sur plusieurs longueurs de plage, puis compare créneau par créneau.
 *
 * Limite assumée : les helpers de génération (generateTimeSlots,
 * isTimeBlocked…) sont recopiés ici. C'est acceptable parce qu'ils n'ont pas
 * été touchés — ce qu'on teste, c'est la structure de lecture autour d'eux.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/check-slots-equivalence.mjs <slug…>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

initializeApp({
  credential: cert(JSON.parse(readFileSync(process.env.SA_PATH ?? 'service-account.json', 'utf-8'))),
  projectId: 'opatam-da04b',
});
const db = getFirestore();

const hhmmToMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const endMin = (t) => (t === '00:00' ? 1440 : hhmmToMinutes(t));

function generateTimeSlots(date, startTime, endTime, slotDuration, slotInterval) {
  const slots = [];
  let cur = hhmmToMinutes(startTime);
  const end = endMin(endTime);
  while (cur + slotDuration <= end) {
    const d = new Date(date);
    d.setHours(Math.floor(cur / 60), cur % 60, 0, 0);
    const e = new Date(date);
    e.setHours(Math.floor((cur + slotDuration) / 60), (cur + slotDuration) % 60, 0, 0);
    slots.push({ datetime: d, endDatetime: e });
    cur += slotInterval;
  }
  return slots;
}

const overlaps = (aS, aE, bS, bE) => aS < bE && aE > bS;

const isBlocked = (s, e, blocks) =>
  blocks.some((b) => {
    const bs = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
    const be = b.endDate?.toDate ? b.endDate.toDate() : new Date(b.endDate);
    if (b.allDay) {
      const d0 = new Date(bs); d0.setHours(0, 0, 0, 0);
      const d1 = new Date(be); d1.setHours(23, 59, 59, 999);
      return overlaps(s, e, d0, d1);
    }
    return overlaps(s, e, bs, be);
  });

/**
 * ATTENTION — le document de réservation porte `datetime` et `endDatetime`,
 * des Timestamp. Il n'a PAS de champ `date` : une première version de ce
 * script le lisait, obtenait `undefined`, et ne détectait donc AUCUN
 * conflit. Le test comparait deux boucles sur un agenda vide et validait
 * tout, y compris ce qu'il aurait dû refuser.
 */
const toDate = (v) => (v?.toDate ? v.toDate() : new Date(v));

const isBooked = (s, e, bookings) =>
  bookings.some((b) => {
    const bs = toDate(b.datetime);
    const be = b.endDatetime
      ? toDate(b.endDatetime)
      : new Date(bs.getTime() + (b.duration ?? 0) * 60000);
    return overlaps(s, e, bs, be);
  });

const key = (s) => s.datetime.toISOString();

async function loadProvider(slug) {
  const snap = await db.collection('providers').where('slug', '==', slug).limit(1).get();
  if (snap.empty) return null;
  const ref = snap.docs[0].ref;
  const provider = snap.docs[0].data();
  const [services, members, availability, bookings, blocked] = await Promise.all([
    ref.collection('services').get(),
    ref.collection('members').get(),
    ref.collection('availability').get(),
    db.collection('bookings').where('providerId', '==', ref.id).get(),
    ref.collection('blockedSlots').get(),
  ]);
  return {
    id: ref.id,
    provider,
    services: services.docs.map((d) => ({ id: d.id, ...d.data() })),
    members: members.docs.map((d) => ({ id: d.id, ...d.data() })),
    availability: availability.docs.map((d) => ({ id: d.id, ...d.data() })),
    bookings: bookings.docs.map((d) => ({ id: d.id, ...d.data() })),
    blocked: blocked.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

/** ANCIENNE structure : on relit par jour (ici : on refiltre par jour). */
function legacy(ctx, memberId, duration, interval, earliest, start, days) {
  const out = [];
  const cur = new Date(start);
  for (let i = 0; i < days; i++) {
    const dow = cur.getDay();
    // `availabilityRepository.get(providerId, memberId, dayOfWeek)` visait le
    // document d'identifiant `${memberId}_${dayOfWeek}`.
    const av = ctx.availability.find((a) => a.id === `${memberId}_${dow}`);
    if (av && av.isOpen && av.slots?.length) {
      const dayStart = new Date(cur); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
      const dayBlocks = ctx.blocked.filter((b) => b.memberId === memberId);
      const dayBookings = ctx.bookings.filter((b) => {
        const d = toDate(b.datetime);
        return (
          d >= dayStart && d < dayEnd &&
          b.memberId === memberId &&
          ['confirmed', 'pending', 'pending_payment'].includes(b.status)
        );
      });
      for (const w of av.slots) {
        for (const g of generateTimeSlots(cur, w.start, w.end, duration, interval)) {
          if (!isBlocked(g.datetime, g.endDatetime, dayBlocks) &&
              !isBooked(g.datetime, g.endDatetime, dayBookings) &&
              !(g.datetime <= earliest)) out.push(g);
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out.sort((a, b) => a.datetime - b.datetime);
}

/** NOUVELLE structure : tout est chargé une fois, on filtre en mémoire. */
function batched(ctx, memberId, duration, interval, earliest, start, days) {
  // `getWeeklySchedule` = tous les documents du membre.
  const byDow = new Map();
  for (const a of ctx.availability.filter((a) => a.memberId === memberId)) byDow.set(a.dayOfWeek, a);
  const blocks = ctx.blocked.filter((b) => b.memberId === memberId);
  const rangeStart = new Date(start); rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeEnd.getDate() + days - 1); rangeEnd.setHours(23, 59, 59, 999);
  const bookings = ctx.bookings.filter((b) => {
    const d = toDate(b.datetime);
    return d >= rangeStart && d <= rangeEnd && b.memberId === memberId &&
      ['confirmed', 'pending', 'pending_payment'].includes(b.status);
  });

  const out = [];
  const cur = new Date(rangeStart);
  for (let i = 0; i < days; i++) {
    const av = byDow.get(cur.getDay());
    if (av && av.isOpen && av.slots?.length) {
      for (const w of av.slots) {
        for (const g of generateTimeSlots(cur, w.start, w.end, duration, interval)) {
          if (!isBlocked(g.datetime, g.endDatetime, blocks) &&
              !isBooked(g.datetime, g.endDatetime, bookings) &&
              !(g.datetime <= earliest)) out.push(g);
        }
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out.sort((a, b) => a.datetime - b.datetime);
}

/**
 * « Prochaine dispo » — l'ancienne recherche testait jour après jour et
 * renvoyait le premier jour non vide ; la nouvelle prend le premier créneau
 * d'un seul appel sur tout l'horizon. Ce bloc vérifie qu'elles désignent la
 * MÊME date, y compris quand le membre n'a aucune disponibilité.
 *
 * C'est le seul changement qui touche une surface CLIENT (la fiche
 * prestataire mobile en plan Studio), d'où sa vérification séparée.
 */
function nextDateLegacy(ctx, memberId, duration, interval, earliest, start, horizonDays) {
  for (let i = 0; i < horizonDays; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    const slots = legacy(ctx, memberId, duration, interval, earliest, day, 1);
    if (slots.length > 0) {
      const d = new Date(day);
      d.setHours(0, 0, 0, 0);
      return d;
    }
  }
  return null;
}

function nextDateBatched(ctx, memberId, duration, interval, earliest, start, horizonDays) {
  const slots = batched(ctx, memberId, duration, interval, earliest, start, horizonDays);
  if (slots.length === 0) return null;
  const d = new Date(slots[0].datetime);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Réservations et blocages SYNTHÉTIQUES, injectés dans la fenêtre testée.
 *
 * POURQUOI : les prestataires réels n'ont aucune réservation à venir — celles
 * du salon de démonstration sont toutes passées. Sans conflit à trancher, les
 * deux boucles comparaient des agendas vides et validaient n'importe quoi.
 * Ces données forcent le test à exercer le filtrage lui-même : chevauchement
 * partiel, journée entière, statut annulé qui NE DOIT PAS bloquer.
 */
function withSyntheticLoad(ctx, memberId, start) {
  const at = (dayOffset, h, durationMin) => {
    const d = new Date(start);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, 0, 0, 0);
    return { datetime: d, endDatetime: new Date(d.getTime() + durationMin * 60000) };
  };
  return {
    ...ctx,
    bookings: [
      { id: 'syn-1', memberId, status: 'confirmed', ...at(3, 11, 90) },
      { id: 'syn-2', memberId, status: 'pending', ...at(3, 15, 60) },
      { id: 'syn-3', memberId, status: 'pending_payment', ...at(10, 9, 240) },
      // Annulée et non-présentation : le moteur doit les IGNORER. Si le test
      // ne les distinguait pas, il masquerait une régression sur les statuts.
      { id: 'syn-4', memberId, status: 'cancelled', ...at(4, 10, 480) },
      { id: 'syn-5', memberId, status: 'noshow', ...at(5, 10, 480) },
      ...ctx.bookings,
    ],
    blocked: [
      {
        id: 'syn-b1',
        memberId,
        allDay: false,
        ...(() => {
          const { datetime, endDatetime } = at(7, 14, 180);
          return { startDate: datetime, endDate: endDatetime };
        })(),
      },
      ...ctx.blocked,
    ],
  };
}

const slugs = process.argv.slice(2);
let checks = 0, diffs = 0;

for (const slug of slugs) {
  const ctx = await loadProvider(slug);
  if (!ctx) { console.log(`  ${slug} : introuvable, ignoré`); continue; }
  const interval = ctx.provider.settings?.slotInterval ?? 15;
  const buffer = ctx.provider.settings?.defaultBufferTime ?? 0;
  const notice = ctx.provider.settings?.minBookingNotice ?? 2;
  const earliest = new Date(Date.now() + notice * 3600e3);
  const start = new Date(); start.setHours(0, 0, 0, 0);

  console.log(`\n${slug} — ${ctx.members.length} membres, ${ctx.services.length} prestations, ${ctx.bookings.length} résas`);

  for (const m of ctx.members) {
    for (const svc of ctx.services) {
      const duration = (svc.duration ?? 0) + (svc.bufferTime || buffer);
      for (const days of [1, 7, 30, 60]) {
        const loaded = withSyntheticLoad(ctx, m.id, start);
        const a = legacy(loaded, m.id, duration, interval, earliest, start, days);
        const b = batched(loaded, m.id, duration, interval, earliest, start, days);
        checks++;
        const ka = a.map(key).join('|'), kb = b.map(key).join('|');
        if (ka !== kb) {
          diffs++;
          console.log(`  ÉCART · ${m.name} · ${svc.name} · ${days}j : ancien ${a.length} créneaux, nouveau ${b.length}`);
          const sa = new Set(a.map(key)), sb = new Set(b.map(key));
          const only = (x, y) => [...x].filter((v) => !y.has(v)).slice(0, 3);
          if (only(sa, sb).length) console.log('    seulement ancien :', only(sa, sb));
          if (only(sb, sa).length) console.log('    seulement nouveau :', only(sb, sa));
        }
      }
    }
  }
}

// Deuxième passe : la « prochaine dispo » par membre.
for (const slug of slugs) {
  const ctx = await loadProvider(slug);
  if (!ctx) continue;
  const interval = ctx.provider.settings?.slotInterval ?? 15;
  const buffer = ctx.provider.settings?.defaultBufferTime ?? 0;
  const notice = ctx.provider.settings?.minBookingNotice ?? 2;
  const earliest = new Date(Date.now() + notice * 3600e3);
  const start = new Date(); start.setHours(0, 0, 0, 0);

  for (const m of ctx.members) {
    for (const svc of ctx.services) {
      const duration = (svc.duration ?? 0) + (svc.bufferTime || buffer);
      const a = nextDateLegacy(ctx, m.id, duration, interval, earliest, start, 60);
      const b = nextDateBatched(ctx, m.id, duration, interval, earliest, start, 60);
      checks++;
      const fa = a ? a.toISOString().slice(0, 10) : 'aucune';
      const fb = b ? b.toISOString().slice(0, 10) : 'aucune';
      if (fa !== fb) {
        diffs++;
        console.log(`  ÉCART prochaine dispo · ${m.name} · ${svc.name} : ancien ${fa}, nouveau ${fb}`);
      }
    }
  }
}

// Contrôle de vivacité : un test qui ne rencontre jamais de conflit
// comparerait deux agendas vides et validerait n'importe quoi. On affiche
// donc combien de créneaux les réservations ont réellement retirés.
for (const slug of slugs) {
  const ctx = await loadProvider(slug);
  if (!ctx) continue;
  const interval = ctx.provider.settings?.slotInterval ?? 15;
  const buffer = ctx.provider.settings?.defaultBufferTime ?? 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const past = new Date(0); // aucun préavis : on veut compter les conflits
  let withBookings = 0, withoutBookings = 0;
  for (const m of ctx.members) {
    for (const svc of ctx.services) {
      const dur = (svc.duration ?? 0) + (svc.bufferTime || buffer);
      const loaded = withSyntheticLoad(ctx, m.id, start);
      withBookings += batched(loaded, m.id, dur, interval, past, start, 60).length;
      withoutBookings += batched(
        { ...loaded, bookings: [], blocked: [] },
        m.id, dur, interval, past, start, 60,
      ).length;
    }
  }
  console.log(
    `  ${slug} : ${withoutBookings - withBookings} créneaux retirés par les réservations ` +
      `(${withBookings} restants sur ${withoutBookings})`,
  );
}

console.log(`\n${checks} comparaisons · ${diffs} écart(s)`);
process.exit(diffs ? 1 : 0);
