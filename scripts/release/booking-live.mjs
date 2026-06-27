#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import {
  nowIso,
  verdictFromChecks,
  writeReportFiles,
} from './lib/report.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_PROVIDER_ID = 'rgq0JPuTOKPim9xKdjWO3LanDSI3';
const cliProviderId = process.argv.slice(2).find((arg) => arg && arg !== '--');
const providerId = cliProviderId || process.env.RELEASE_PROVIDER_ID || DEFAULT_PROVIDER_ID;
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || 'opatam-da04b';
const baseUrl = (process.env.RELEASE_BASE_URL || process.env.SMOKE_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const clientEmail = process.env.RELEASE_CLIENT_EMAIL || 'bwemba13@gmail.com';
const clientName = process.env.RELEASE_CLIENT_NAME || 'Test Release Opatam';
const clientPhone = process.env.RELEASE_CLIENT_PHONE || '0600000000';
const confirm = process.env.LIVE_BOOKING_CONFIRM === 'yes';
const allowDeposit = process.env.LIVE_BOOKING_ALLOW_DEPOSIT === 'yes';

function initFirebaseAdmin() {
  if (getApps().length) return;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)), projectId });
    return;
  }
  const serviceAccountPath = path.join(rootDir, 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))), projectId });
    return;
  }
  initializeApp({ projectId });
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutes(time) {
  const [hour, minute] = String(time || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function sameDay(dateA, dateB) {
  return dateA.toISOString().slice(0, 10) === dateB.toISOString().slice(0, 10);
}

function withId(doc) {
  return { id: doc.id, ...doc.data() };
}

function bookingBlocks(booking) {
  return ['confirmed', 'pending', 'pending_payment'].includes(booking.status);
}

function serviceCanUseMember(service, member) {
  const memberOk = !Array.isArray(service.memberIds) || service.memberIds.length === 0 || service.memberIds.includes(member.id);
  const locationOk = !Array.isArray(service.locationIds) || service.locationIds.length === 0 || service.locationIds.includes(member.locationId);
  return memberOk && locationOk;
}

function serviceRequiresDeposit(provider, service) {
  const connectReady = provider.depositsAddonActive &&
    provider.stripeConnectStatus === 'active' &&
    provider.stripeConnectAccountId;
  if (!connectReady) return false;
  if (service.deposit?.type === 'none') return false;
  if (service.deposit?.type === 'fixed' || service.deposit?.type === 'percent') return true;
  return Boolean(provider.settings?.depositDefault?.percent);
}

function buildDefaultSelections(service) {
  const selections = {
    variations: {},
    options: {},
    infoValues: {},
  };

  for (const variation of service.variations || []) {
    const first = variation.options?.[0];
    if (!first?.id) return null;
    selections.variations[variation.id] = first.id;
  }

  for (const infoField of service.infoFields || []) {
    if (!infoField.required) continue;
    if (infoField.type === 'boolean') selections.infoValues[infoField.id] = 'Oui';
    else if (infoField.type === 'select') selections.infoValues[infoField.id] = infoField.values?.[0] || 'Test';
    else selections.infoValues[infoField.id] = 'Test release';
  }

  return selections;
}

function blockedSlotBlocks(blockedSlot, start, end, memberId) {
  if (blockedSlot.memberId && blockedSlot.memberId !== memberId) return false;
  const blockStartDate = toDate(blockedSlot.startDate);
  const blockEndDate = toDate(blockedSlot.endDate);
  if (!blockStartDate || !blockEndDate) return false;

  if (blockedSlot.allDay) {
    const dayStart = new Date(start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start);
    dayEnd.setHours(23, 59, 59, 999);
    return overlaps(dayStart, dayEnd, blockStartDate, blockEndDate);
  }

  if (!sameDay(start, blockStartDate)) return false;
  const startTime = minutes(blockedSlot.startTime || '00:00');
  const endTime = minutes(blockedSlot.endTime || '23:59');
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  return overlaps(startMinutes, endMinutes, startTime, endTime);
}

function findLiveCandidate({ provider, services, members, locations, availability, bookings, blockedSlots, now }) {
  const maxAdvanceDays = provider.settings?.maxBookingAdvance ?? 60;
  const minNoticeHours = provider.settings?.minBookingNotice ?? 2;
  const slotInterval = provider.settings?.slotInterval ?? 15;
  const earliest = new Date(now.getTime() + minNoticeHours * 60 * 60 * 1000);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + Math.min(maxAdvanceDays, 30));

  const activeLocationIds = new Set(locations.filter((location) => location.isActive !== false).map((location) => location.id));
  const activeMembers = members.filter((member) => member.isActive !== false && activeLocationIds.has(member.locationId));
  const activeServices = services
    .filter((service) => service.isActive !== false && service.duration > 0)
    .sort((a, b) => {
      const aDeposit = serviceRequiresDeposit(provider, a) ? 1 : 0;
      const bDeposit = serviceRequiresDeposit(provider, b) ? 1 : 0;
      return aDeposit - bDeposit || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });

  const availabilityByMemberDay = new Map(availability.map((item) => [`${item.memberId}_${item.dayOfWeek}`, item]));

  for (const service of activeServices) {
    const requiresDeposit = serviceRequiresDeposit(provider, service);
    if (requiresDeposit && !allowDeposit) continue;

    const selections = buildDefaultSelections(service);
    if (!selections) continue;

    const totalDuration = (service.duration || 0) + (service.bufferTime || provider.settings?.defaultBufferTime || 0);
    for (const member of activeMembers) {
      if (!serviceCanUseMember(service, member)) continue;
      const current = new Date(now);
      current.setHours(0, 0, 0, 0);

      while (current <= horizon) {
        const dayAvailability = availabilityByMemberDay.get(`${member.id}_${current.getDay()}`);
        if (dayAvailability?.isOpen && Array.isArray(dayAvailability.slots)) {
          for (const window of dayAvailability.slots) {
            for (let slotStart = minutes(window.start); slotStart + totalDuration <= minutes(window.end); slotStart += slotInterval) {
              const candidateStart = new Date(current);
              candidateStart.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);
              const candidateEnd = new Date(candidateStart.getTime() + totalDuration * 60 * 1000);
              if (candidateStart <= earliest) continue;

              const bookingConflict = bookings.some((booking) => {
                if (booking.memberId !== member.id || !bookingBlocks(booking)) return false;
                const bookingStart = toDate(booking.datetime);
                const bookingEnd = toDate(booking.endDatetime);
                return bookingStart && bookingEnd && overlaps(candidateStart, candidateEnd, bookingStart, bookingEnd);
              });
              if (bookingConflict) continue;

              const blockedConflict = blockedSlots.some((blockedSlot) =>
                blockedSlotBlocks(blockedSlot, candidateStart, candidateEnd, member.id)
              );
              if (blockedConflict) continue;

              return {
                providerId: provider.id,
                serviceId: service.id,
                serviceName: service.name,
                memberId: member.id,
                memberName: member.name,
                locationId: member.locationId,
                datetime: candidateStart,
                endDatetime: candidateEnd,
                selections,
                requiresDeposit,
                totalDuration,
              };
            }
          }
        }
        current.setDate(current.getDate() + 1);
      }
    }
  }

  return null;
}

async function getCollection(db, collectionPath) {
  const snap = await db.collection(collectionPath).get();
  return snap.docs.map(withId);
}

async function main() {
  const checks = [];
  const warnings = [];

  if (!confirm) {
    checks.push({
      name: 'Garde-fou réservation réelle',
      status: 'fail',
      detail: 'Définis LIVE_BOOKING_CONFIRM=yes pour créer une vraie réservation.',
    });
    const payload = {
      name: 'booking-live',
      generatedAt: nowIso(),
      verdict: 'FAIL',
      summary: 'La réservation réelle n’a pas été créée car le garde-fou de confirmation est absent.',
      impacts: ['live booking'],
      warnings,
      checks,
      changedFiles: [],
      nextSteps: ['Lance : LIVE_BOOKING_CONFIRM=yes pnpm release:booking-live -- <providerId>'],
    };
    writeReportFiles(rootDir, 'booking-live', payload);
    console.log('Verdict réservation réelle : FAIL');
    process.exit(1);
  }

  initFirebaseAdmin();
  const db = getFirestore();
  const now = new Date();
  const providerSnap = await db.collection('providers').doc(providerId).get();
  if (!providerSnap.exists) throw new Error(`Provider not found: ${providerId}`);

  const provider = { id: providerSnap.id, ...providerSnap.data() };
  const [locations, services, members, availability, blockedSlots, bookingsSnap] = await Promise.all([
    getCollection(db, `providers/${providerId}/locations`),
    getCollection(db, `providers/${providerId}/services`),
    getCollection(db, `providers/${providerId}/members`),
    getCollection(db, `providers/${providerId}/availability`),
    getCollection(db, `providers/${providerId}/blockedSlots`),
    db.collection('bookings')
      .where('providerId', '==', providerId)
      .where('datetime', '>=', Timestamp.fromDate(now))
      .limit(250)
      .get(),
  ]);

  let bookingInfo = null;
  const candidate = findLiveCandidate({
    provider,
    services,
    members,
    locations,
    availability,
    blockedSlots,
    bookings: bookingsSnap.docs.map(withId),
    now,
  });

  if (!candidate) {
    checks.push({
      name: 'Find live booking candidate',
      status: 'fail',
      detail: allowDeposit
        ? 'Aucun créneau plausible trouvé.'
        : 'Aucun créneau sans acompte plausible trouvé. Si c’est voulu, relance avec LIVE_BOOKING_ALLOW_DEPOSIT=yes.',
    });
  } else {
    checks.push({
      name: 'Find live booking candidate',
      status: 'pass',
      detail: `${candidate.datetime.toISOString()} - ${candidate.serviceName} with ${candidate.memberName}`,
    });

    const response = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId,
        serviceId: candidate.serviceId,
        memberId: candidate.memberId,
        locationId: candidate.locationId,
        datetime: candidate.datetime.toISOString(),
        clientInfo: {
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
        },
        selections: candidate.selections,
      }),
    });

    const body = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
    const bookingId = body.bookingId || body.id || null;
    const requiresPayment = body.requiresPayment === true;

    checks.push({
      name: 'Création via POST /api/bookings',
      status: response.ok ? 'pass' : 'fail',
      detail: `${response.status} ${baseUrl}/api/bookings${bookingId ? ` - bookingId=${bookingId}` : ''}${body.error ? ` - ${body.error}` : ''}`,
    });

    if (response.ok && bookingId) {
      const bookingSnap = await db.collection('bookings').doc(bookingId).get();
      const booking = bookingSnap.exists ? bookingSnap.data() : null;
      bookingInfo = {
        id: bookingId,
        status: booking?.status ?? null,
        clientEmail,
        serviceName: candidate.serviceName,
        memberName: candidate.memberName,
        datetime: candidate.datetime.toISOString(),
        endpoint: `${baseUrl}/api/bookings`,
      };
      checks.push({
        name: 'Réservation persistée',
        status: booking ? 'pass' : 'fail',
        detail: booking
          ? `statut=${booking.status}, client=${booking.clientInfo?.email}, service=${booking.serviceName}`
          : `réservation ${bookingId} introuvable après la réponse API`,
      });

      if (requiresPayment || booking?.status === 'pending_payment') {
        warnings.push('La réservation nécessite un acompte ; les emails de confirmation sont différés jusqu’au paiement.');
      }
    }
  }

  const verdict = verdictFromChecks(checks);
  const payload = {
    name: 'booking-live',
    generatedAt: nowIso(),
    verdict,
    summary: `Test de réservation réelle contre ${baseUrl}. Crée une vraie réservation uniquement avec LIVE_BOOKING_CONFIRM=yes.`,
    impacts: ['live booking', 'emails', 'notifications', 'provider agenda'],
    warnings,
    checks,
    booking: bookingInfo,
    changedFiles: [],
    nextSteps: verdict === 'PASS'
      ? [
          `Vérifie l’email de confirmation client sur ${clientEmail}.`,
          'Vérifie les notifications prestataire et l’agenda.',
          'Annule manuellement la réservation test si tu ne veux pas la garder dans l’agenda.',
        ]
      : ['Relis les vérifications en échec avant de relancer le test de réservation réelle.'],
  };

  writeReportFiles(rootDir, 'booking-live', payload);

  console.log(`Verdict réservation réelle : ${verdict}`);
  console.log('Reports: reports/release/booking-live.html, .md and .json');
  process.exit(verdict === 'FAIL' ? 1 : 0);
}

main().catch((error) => {
  const payload = {
    name: 'booking-live',
    generatedAt: nowIso(),
    verdict: 'FAIL',
    summary: 'Le script de réservation réelle a planté.',
    impacts: ['live booking'],
    warnings: [],
    checks: [{
      name: 'Exécution du script',
      status: 'fail',
      detail: error?.stack || error?.message || String(error),
    }],
    changedFiles: [],
    nextSteps: ['Vérifie les credentials Firebase, RELEASE_BASE_URL et le prestataire ciblé.'],
  };
  writeReportFiles(rootDir, 'booking-live', payload);
  console.error(error);
  process.exit(1);
});
