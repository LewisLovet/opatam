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

const isBooked = (s, e, bookings) =>
  bookings.some((b) => {
    const bs = b.date?.toDate ? b.date.toDate() : new Date(b.date);
    const be = new Date(bs.getTime() + (b.duration ?? 0) * 60000);
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
        const d = b.date?.toDate ? b.date.toDate() : new Date(b.date);
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
    const d = b.date?.toDate ? b.date.toDate() : new Date(b.date);
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
        const a = legacy(ctx, m.id, duration, interval, earliest, start, days);
        const b = batched(ctx, m.id, duration, interval, earliest, start, days);
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

console.log(`\n${checks} comparaisons · ${diffs} écart(s)`);
process.exit(diffs ? 1 : 0);
