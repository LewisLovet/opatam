/**
 * Resend Email Service
 * Handles sending emails via Resend API
 */

import { Resend } from 'resend';
import { defineString } from 'firebase-functions/params';
import type {
  BookingSelectedVariation,
  BookingSelectedOption,
  BookingSelectedInfo,
} from '@booking-app/shared';
import {
  EMAIL_TEXTS,
  resolveEmailLocale,
  formatEmailDate,
  formatEmailTime,
  formatEmailPrice,
  formatEmailTimeUntil,
  type EmailLocale,
} from './emailI18n';

// Define the Resend API key as a Firebase parameter
const resendApiKey = defineString('RESEND_API_KEY');

// Lazy singleton instance
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(resendApiKey.value());
  }
  return resendInstance;
}

// Email configuration
export const emailConfig = {
  from: 'Opatam <noreply@kamerleontech.com>',
  replyTo: 'support@kamerleontech.com',
} as const;

// App configuration
// Note: Keep in sync with @booking-app/shared/constants APP_CONFIG
export const appConfig = {
  name: 'Opatam',
  url: 'https://opatam.com',
} as const;

// Firebase Storage assets
// Note: Keep in sync with @booking-app/shared/constants ASSETS
const STORAGE_BUCKET = 'opatam-da04b.firebasestorage.app';
const ASSETS_BASE_URL = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o`;

export const assets = {
  logos: {
    default: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-default.png?alt=media`,
    light: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-light.png?alt=media`,
    dark: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-dark.png?alt=media`,
    email: `${ASSETS_BASE_URL}/assets%2Flogos%2Flogo-email.png?alt=media`,
  },
} as const;

// Helper to format date in French
export function formatDateFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
}

// Helper to format time in French
export function formatTimeFr(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
}

// Helper to format price (centimes to euros)
export function formatPriceFr(priceInCentimes: number, priceMaxInCentimes?: number | null): string {
  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(v / 100);
  if (priceMaxInCentimes && priceMaxInCentimes > priceInCentimes) {
    return `De ${fmt(priceInCentimes)} à ${fmt(priceMaxInCentimes)}`;
  }
  return fmt(priceInCentimes);
}

/**
 * Promotion note appended after the price when a discount was applied
 * (originalPrice > price). HTML version: crossed-out original + "−X%".
 * Returns '' when there's no promo.
 */
function promoNoteHtml(price: number, originalPrice?: number | null, locale: EmailLocale = 'fr'): string {
  if (!originalPrice || originalPrice <= price) return '';
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
  return ` <span style="color: #a1a1aa; text-decoration: line-through; font-weight: 400;">${formatEmailPrice(originalPrice, locale)}</span> <span style="color: #e11d48; font-weight: 700;">−${pct}%</span>`;
}

/** Plain-text version of the promo note: " (au lieu de 50 €, −20 %)". */
function promoNoteText(price: number, originalPrice?: number | null, locale: EmailLocale = 'fr'): string {
  if (!originalPrice || originalPrice <= price) return '';
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
  return EMAIL_TEXTS.common[locale].promoWas(formatEmailPrice(originalPrice, locale), pct);
}

// Helper to format a duration in minutes ("45 min", "1h", "1h30")
export function formatDurationFr(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h${mins.toString().padStart(2, '0')}`;
}

/** The client's denormalised choices for one prestation (or, in the mono
 *  case, the booking as a whole). All fields optional / back-compat: legacy
 *  bookings without choices render exactly as before. */
export interface EmailSelections {
  selectedVariations?: BookingSelectedVariation[];
  selectedOptions?: BookingSelectedOption[];
  selectedInfo?: BookingSelectedInfo[];
}

/** One prestation line in the email, with its denormalised choices. */
export interface EmailServiceItem extends EmailSelections {
  serviceName: string;
  duration: number;
  price: number;
  /** Pre-discount price (cents) when a promo was applied to this line. */
  originalPrice?: number | null;
}

/** True when the given selections carry at least one choice to render. */
function hasSelections(s: EmailSelections): boolean {
  return (
    (s.selectedVariations?.length ?? 0) > 0 ||
    (s.selectedOptions?.length ?? 0) > 0 ||
    (s.selectedInfo?.length ?? 0) > 0
  );
}

/** Render the client's choices as small muted HTML lines, indented under
 *  the prestation they belong to. Returns '' when there's nothing to show. */
function renderSelectionsHtml(s: EmailSelections, locale: EmailLocale = 'fr'): string {
  const colon = EMAIL_TEXTS.common[locale].colon;
  const lines: string[] = [];
  const muted = (html: string) =>
    `<div style="font-size: 13px; color: #71717a; margin-left: 12px;">${html}</div>`;

  for (const v of s.selectedVariations ?? []) {
    lines.push(muted(`${v.variationName}${colon} <strong>${v.optionName}</strong>`));
  }
  for (const o of s.selectedOptions ?? []) {
    const extra = o.price > 0 ? ` (+${formatEmailPrice(o.price, locale)})` : '';
    lines.push(muted(`+ <strong>${o.optionName}</strong>${extra}`));
    for (const nv of o.nestedVariations ?? []) {
      lines.push(muted(`${nv.variationName}${colon} <strong>${nv.optionName}</strong>`));
    }
    for (const ni of o.info ?? []) {
      lines.push(muted(`${ni.label}${colon} <strong>${ni.value}</strong>`));
    }
  }
  for (const i of s.selectedInfo ?? []) {
    lines.push(muted(`${i.label}${colon} <strong>${i.value}</strong>`));
  }
  return lines.join('');
}

/** Render the client's choices as indented plain-text lines, under the
 *  prestation they belong to. Returns '' when there's nothing to show. */
function renderSelectionsText(s: EmailSelections, locale: EmailLocale = 'fr'): string {
  const colon = EMAIL_TEXTS.common[locale].colon;
  const lines: string[] = [];

  for (const v of s.selectedVariations ?? []) {
    lines.push(`  - ${v.variationName}${colon} ${v.optionName}`);
  }
  for (const o of s.selectedOptions ?? []) {
    const extra = o.price > 0 ? ` (+${formatEmailPrice(o.price, locale)})` : '';
    lines.push(`  - + ${o.optionName}${extra}`);
    for (const nv of o.nestedVariations ?? []) {
      lines.push(`    ${nv.variationName}${colon} ${nv.optionName}`);
    }
    for (const ni of o.info ?? []) {
      lines.push(`    ${ni.label}${colon} ${ni.value}`);
    }
  }
  for (const i of s.selectedInfo ?? []) {
    lines.push(`  - ${i.label}${colon} ${i.value}`);
  }
  return lines.join('\n');
}

// Helper to format relative time in French ("dans 30 minutes", "dans 1h30", "demain")
export function formatTimeUntilFr(minutesUntil: number): string {
  // Round to the nearest 5 minutes — "dans 3h46" reads like a glitch; clean
  // multiples ("dans 3h45", "dans 5 heures") feel intentional.
  minutesUntil = Math.round(minutesUntil / 5) * 5;
  if (minutesUntil < 60) {
    const mins = minutesUntil;
    return mins <= 1 ? 'dans 1 minute' : `dans ${mins} minutes`;
  }
  const hours = Math.floor(minutesUntil / 60);
  const mins = Math.round(minutesUntil % 60);
  if (hours >= 24) return 'demain';
  if (mins === 0) {
    return hours === 1 ? 'dans 1 heure' : `dans ${hours} heures`;
  }
  return `dans ${hours}h${mins.toString().padStart(2, '0')}`;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Format Google Calendar date
function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// RFC 5545 escaping for ICS files
function escapeIcs(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

export interface BookingEmailData {
  clientEmail: string;
  clientName: string;
  /** Client's booking language (booking.clientLocale, 'fr' | 'en').
   *  Anything that isn't 'en' falls back to French. Optional so every
   *  existing call site keeps working unchanged. */
  locale?: string;
  serviceName: string;
  datetime: Date;
  duration: number;
  price: number;
  priceMax?: number | null;
  /** Pre-discount total (cents) when a promo was applied. null = no promo. */
  originalPrice?: number | null;
  providerName: string;
  providerSlug?: string;
  locationName?: string;
  locationAddress?: string;
  /** True when the location is address-protected and not yet revealed: the
   *  `locationAddress` holds only the approximate area, and the email must say
   *  the exact address comes later. */
  addressPending?: boolean;
  /** Access details (interphone, floor, door code…) — only set when the exact
   *  address is revealed (reminder, or confirmation ≤48h). */
  accessInstructions?: string | null;
  /** When the exact address will reach the client (their reminder send time),
   *  shown in the "address coming later" notice. Only set when addressPending. */
  addressAvailableAt?: Date | null;
  memberName?: string;
  cancelToken?: string;
  bookingId?: string;
  bookingNotice?: string | null;
  /**
   * Multi-prestation breakdown. Present only for "panier" bookings holding
   * several back-to-back services. When length >= 2, each item is rendered
   * on its own line; the top-level serviceName/duration/price stay as the
   * joined name / totals.
   */
  items?: EmailServiceItem[];
  /**
   * Mono-booking choices (no items[] breakdown). Rendered under the single
   * service line. Absent on legacy bookings / bookings without choices.
   */
  selectedVariations?: BookingSelectedVariation[];
  selectedOptions?: BookingSelectedOption[];
  selectedInfo?: BookingSelectedInfo[];
  /**
   * Deposit info — present only when this booking required one and it has
   * been paid. The amount is in cents. Confirmation emails surface this so
   * the client knows exactly what's already settled vs. what's left to pay
   * on-site.
   */
  depositPaid?: {
    amount: number;
    refundDeadlineHours: number;
  } | null;
  /**
   * When this confirmation is actually an UPDATE — a prestation was added to
   * or removed from an existing booking — describe the change so the email
   * states what happened instead of a plain "confirmé".
   */
  updateContext?: { type: 'added' | 'removed'; serviceName: string };
}

/**
 * Send confirmation email to client
 */
/** Escape user-provided text before injecting it into email HTML, so a value
 *  containing `<`, `>`, `&`, `"` or `'` can't break the layout or inject markup. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Address-privacy aware location rows. Protected-but-not-revealed → "Secteur"
 *  with only the approximate area and no map link. Otherwise the usual address. */
function locationAddressRowsHtml(data: { locationAddress?: string; addressPending?: boolean; accessInstructions?: string | null }, locale: EmailLocale = 'fr'): string {
  if (!data.locationAddress) return '';
  const c = EMAIL_TEXTS.common[locale];
  const row = (label: string, value: string, extra = '') =>
    `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; vertical-align: top;">${label}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;${extra}">${value}</td></tr>`;
  if (data.addressPending) return row(c.labels.area, escapeHtml(data.locationAddress));
  const maps = data.locationAddress.includes(',')
    ? `<tr><td></td><td style="padding: 2px 0 4px;"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.locationAddress)}" target="_blank" style="display: inline-block; padding: 5px 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500; color: #2563eb;">&#x1F4CD; ${c.directionsCta}</a></td></tr>`
    : '';
  return row(c.labels.address, escapeHtml(data.locationAddress)) + maps;
}

/** Separate, highlighted block for the access details — shown only once the
 *  address is revealed. Kept out of the recap table so it stands out. */
function accessInstructionsBlockHtml(data: { accessInstructions?: string | null }, locale: EmailLocale = 'fr'): string {
  if (!data.accessInstructions) return '';
  const c = EMAIL_TEXTS.common[locale];
  return `<div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;"><p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #1e3a8a;">&#x1F511; ${c.accessInfoTitleHtml}</p><p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5; white-space: pre-line;">${escapeHtml(data.accessInstructions)}</p></div>`;
}

function accessInstructionsBlockText(data: { accessInstructions?: string | null }, locale: EmailLocale = 'fr'): string {
  const c = EMAIL_TEXTS.common[locale];
  return data.accessInstructions
    ? `\n\n${c.accessInfoTitleText}${c.colon}\n${data.accessInstructions}`
    : '';
}

/** Prominent notice telling the client when the exact address will arrive. */
function addressPendingNoticeHtml(data: { addressPending?: boolean; addressAvailableAt?: Date | null }, locale: EmailLocale = 'fr'): string {
  if (!data.addressPending) return '';
  const c = EMAIL_TEXTS.common[locale];
  const when = data.addressAvailableAt ? c.onDate(formatEmailDate(data.addressAvailableAt, locale)) : '';
  return `<div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;"><p style="margin: 0; font-size: 14px; color: #1e40af; line-height: 1.5;">&#x1F4CD; <strong>${c.addressPendingHtml(when)}</strong></p></div>`;
}

function addressPendingNoticeText(data: { addressPending?: boolean; addressAvailableAt?: Date | null }, locale: EmailLocale = 'fr'): string {
  if (!data.addressPending) return '';
  const c = EMAIL_TEXTS.common[locale];
  const when = data.addressAvailableAt ? c.onDate(formatEmailDate(data.addressAvailableAt, locale)) : '';
  return `\n\n${c.addressPendingText(when)}`;
}

function locationAddressLineText(data: { locationAddress?: string; addressPending?: boolean; accessInstructions?: string | null }, locale: EmailLocale = 'fr'): string {
  if (!data.locationAddress) return '';
  const c = EMAIL_TEXTS.common[locale];
  if (data.addressPending) return `- ${c.labels.area}${c.colon} ${data.locationAddress}`;
  const itin = data.locationAddress.includes(',')
    ? `\n- ${c.labels.directions}${c.colon} https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.locationAddress)}`
    : '';
  return `- ${c.labels.address}${c.colon} ${data.locationAddress}${itin}`;
}

export async function sendConfirmationEmail(data: BookingEmailData): Promise<EmailResult> {
  console.log('[EMAIL] Sending confirmation email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const l = resolveEmailLocale(data.locale);
    const t = EMAIL_TEXTS.confirmation[l];
    const ics = EMAIL_TEXTS.common[l].ics;
    const formattedDate = formatEmailDate(data.datetime, l);
    const formattedTime = formatEmailTime(data.datetime, l);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedEndTime = formatEmailTime(endDate, l);
    const formattedPrice = formatEmailPrice(data.price, l, data.priceMax);
    const businessName = data.providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = data.cancelToken ? `${appConfig.url}/reservation/annuler/${data.cancelToken}` : null;
    const reviewUrl = data.bookingId ? `${appConfig.url}/avis/${data.bookingId}` : null;
    const icsUrl = data.bookingId ? `${appConfig.url}/api/calendar/${data.bookingId}` : null;

    // Google Calendar URL
    const eventTitle = encodeURIComponent(ics.summary(data.serviceName, businessName));
    const eventLocation = encodeURIComponent(data.locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${data.memberName ? ics.withMember(data.memberName) : ics.atBusiness(businessName)}${cancelUrl ? `\n\n${ics.cancelLine(cancelUrl)}` : ''}`
    );
    const eventDates = `${formatGoogleDate(data.datetime)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // Generate ICS content
    const icsDescriptionParts = [data.memberName ? ics.withMember(data.memberName) : ics.atBusiness(businessName)];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(ics.cancelLine(cancelUrl));
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(ics.summary(data.serviceName, businessName));
    const icsLocation = escapeIcs(data.locationAddress || '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Opatam//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${data.bookingId || Date.now()}@opatam.com`,
      `DTSTAMP:${formatGoogleDate(new Date())}`,
      `DTSTART:${formatGoogleDate(data.datetime)}`,
      `DTEND:${formatGoogleDate(endDate)}`,
      `SUMMARY:${icsSummary}`,
      `DESCRIPTION:${icsDescription}`,
      `LOCATION:${icsLocation}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const icsBuffer = Buffer.from(icsContent, 'utf-8');

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject: data.updateContext
        ? t.subjectUpdated(businessName)
        : t.subject(data.serviceName),
      attachments: [
        {
          filename: ics.filename,
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: generateConfirmationHtml({
        ...data,
        emailLocale: l,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        reviewUrl,
        icsUrl,
        googleCalendarUrl,
      }),
      text: generateConfirmationText({
        ...data,
        emailLocale: l,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        reviewUrl,
        icsUrl,
        googleCalendarUrl,
      }),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Confirmation email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send a "finish your payment" reminder. Triggered ~15 min after a
 * deposit booking is created and is still in pending_payment — the
 * client probably closed the Stripe Checkout tab and forgot.
 *
 * The Checkout URL is the SAME one given at creation time and remains
 * valid until the session expires (~30 min). After that the cron
 * deletes the booking entirely.
 */
export interface DepositReminderEmailData {
  clientEmail: string;
  clientName: string;
  /** Client's booking language ('fr' | 'en', anything else → fr). */
  locale?: string;
  serviceName: string;
  datetime: Date;
  duration: number;
  depositAmount: number;
  providerName: string;
  checkoutUrl: string;
  /** Minutes left before the slot is auto-released. Used in the body. */
  minutesLeft: number;
  /** When set, the email shows a "Annuler la réservation" link so the
   *  client can release the slot proactively rather than waiting out
   *  the timeout. */
  cancelToken?: string | null;
}

export async function sendDepositReminderEmail(
  data: DepositReminderEmailData,
): Promise<EmailResult> {
  console.log('[EMAIL] Sending deposit reminder to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const l = resolveEmailLocale(data.locale);
    const t = EMAIL_TEXTS.depositReminder[l];
    const c = EMAIL_TEXTS.common[l];
    const formattedDate = formatEmailDate(data.datetime, l);
    const formattedTime = formatEmailTime(data.datetime, l);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedEndTime = formatEmailTime(endDate, l);
    const formattedDeposit = formatEmailPrice(data.depositAmount, l);
    const cancelUrl = data.cancelToken
      ? `${appConfig.url}/reservation/annuler/${data.cancelToken}`
      : null;

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr><td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr><td style="padding: 32px 32px 24px; text-align: center;">
                <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
              </td></tr>
              <tr><td style="padding: 0 32px 24px;">
                <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${c.greeting(data.clientName)}</p>
                <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.introHtml(data.providerName)}</p>
                <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                  <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px;">${t.boxTitle}</p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${c.labels.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                    <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                    <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td></tr>
                    <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">${c.labels.deposit}</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedDeposit}</td></tr>
                  </table>
                </div>
                <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">${t.deadlineHtml(data.minutesLeft)}</p>
                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.checkoutUrl}" style="display: inline-block; padding: 14px 32px; background-color: #d97706; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${t.payCta}</a></td></tr></table>
                ${cancelUrl ? `<p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">${t.cancelQuestionHtml(cancelUrl)}</p>` : ''}
              </td></tr>
              <tr><td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">${t.signoff}<br><strong>${data.providerName}</strong></p>
              </td></tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">${c.footerAuto(appConfig.name)}</p>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    const text = `
${c.greeting(data.clientName)}

${t.introText(data.providerName)}

- ${c.labels.service}${c.colon} ${data.serviceName}
- ${c.labels.date}${c.colon} ${formattedDate}
- ${c.labels.time}${c.colon} ${formattedTime} - ${formattedEndTime}
- ${c.labels.deposit}${c.colon} ${formattedDeposit}

${t.deadlineText(data.minutesLeft)}

${t.payLineText(data.checkoutUrl)}
${cancelUrl ? `\n${t.cancelLineText(cancelUrl)}` : ''}

${t.signoff}
${data.providerName}
    `.trim();

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject: t.subject(data.serviceName, data.providerName),
      html,
      text,
    });

    if (error) {
      console.error('[EMAIL] Resend deposit reminder error:', error);
      return { success: false, error: String(error) };
    }
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send email notification to provider about a new booking
 */
export interface ProviderNewBookingEmailData {
  providerEmail: string;
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  datetime: Date;
  duration: number;
  price: number;
  priceMax?: number | null;
  /** Pre-discount total (cents) when a promo was applied. null = no promo. */
  originalPrice?: number | null;
  providerName: string;
  locationName?: string;
  locationAddress?: string;
  memberName?: string;
  /** Multi-prestation breakdown (see BookingEmailData.items). */
  items?: EmailServiceItem[];
  /** Mono-booking choices (see BookingEmailData). Rendered under the single
   *  service line. */
  selectedVariations?: BookingSelectedVariation[];
  selectedOptions?: BookingSelectedOption[];
  selectedInfo?: BookingSelectedInfo[];
  /** Deposit info — present only when the booking required a deposit
   *  and it has been paid. Surfaces "+ Acompte X€ déjà perçu" in the
   *  notification so the pro knows what's already settled. */
  depositPaid?: {
    amount: number;
  } | null;
}

export async function sendProviderNewBookingEmail(data: ProviderNewBookingEmailData): Promise<EmailResult> {
  console.log('[EMAIL] Sending provider new booking email to:', data.providerEmail);

  if (!isValidEmail(data.providerEmail)) {
    console.log('[EMAIL] Invalid provider email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const formattedDate = formatDateFr(data.datetime);
    const formattedTime = formatTimeFr(data.datetime);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedEndTime = formatTimeFr(endDate);
    const formattedPrice = formatPriceFr(data.price, data.priceMax);
    const calendarUrl = `${appConfig.url}/pro/calendrier`;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.providerEmail,
      replyTo: emailConfig.replyTo,
      subject: `Nouveau rendez-vous - ${data.clientName} - ${data.serviceName}`,
      html: generateProviderNewBookingHtml({
        ...data,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        calendarUrl,
      }),
      text: generateProviderNewBookingText({
        ...data,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        calendarUrl,
      }),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Provider new booking email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

interface ProviderNewBookingTemplateData extends ProviderNewBookingEmailData {
  formattedDate: string;
  formattedTime: string;
  formattedEndTime: string;
  formattedPrice: string;
  calendarUrl: string;
}

function generateProviderNewBookingHtml(data: ProviderNewBookingTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour,</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Un nouveau rendez-vous vient d'être <strong style="color: #16a34a;">confirmé</strong>.</p>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Nouveau rendez-vous</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Client</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.clientName}</td></tr>
                      ${data.clientPhone ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Téléphone</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${data.clientPhone}</td></tr>` : ''}
                      ${data.items && data.items.length >= 2
                        ? `<tr><td colspan="2" style="padding: 8px 0 4px;"><p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Prestations</p>${data.items.map((item, idx) => `
                            <div style="padding: 8px 0;${idx > 0 ? ' border-top: 1px solid #e4e4e7;' : ''}">
                              <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr>
                                <td style="font-size: 14px; color: #18181b; font-weight: 600;">${idx + 1}. ${item.serviceName}</td>
                                <td style="font-size: 14px; color: #18181b; font-weight: 700; text-align: right; white-space: nowrap;">${formatPriceFr(item.price)}${promoNoteHtml(item.price, item.originalPrice)}</td>
                              </tr></table>
                              <div style="font-size: 12px; color: #71717a; margin-top: 2px;">${formatDurationFr(item.duration)}</div>
                              ${hasSelections(item) ? renderSelectionsHtml(item) : ''}
                            </div>`).join('')}</td></tr>`
                        : `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}${hasSelections(data) ? renderSelectionsHtml(data) : ''}</td></tr>`}
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Horaire</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime} - ${data.formattedEndTime}</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Membre</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedPrice}${promoNoteHtml(data.price, data.originalPrice)}</td></tr>
                      ${data.depositPaid ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Acompte perçu</td><td style="padding: 4px 0; font-size: 14px; color: #16a34a; font-weight: 600;">${formatPriceFr(data.depositPaid.amount)}</td></tr>` : ''}
                    </table>
                  </div>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr><td align="center"><a href="${data.calendarUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Voir mon calendrier</a></td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>L'équipe ${appConfig.name}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${appConfig.name}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateProviderNewBookingText(data: ProviderNewBookingTemplateData): string {
  return `
Bonjour,

Un nouveau rendez-vous vient d'être confirmé.

Détails :
- Client : ${data.clientName}
${data.clientPhone ? `- Téléphone : ${data.clientPhone}` : ''}
${data.items && data.items.length >= 2
  ? data.items.map((item) => `- Prestation : ${item.serviceName} — ${formatDurationFr(item.duration)} · ${formatPriceFr(item.price)}${promoNoteText(item.price, item.originalPrice)}${hasSelections(item) ? `\n${renderSelectionsText(item)}` : ''}`).join('\n')
  : `- Prestation : ${data.serviceName}${hasSelections(data) ? `\n${renderSelectionsText(data)}` : ''}`}
- Date : ${data.formattedDate}
- Horaire : ${data.formattedTime} - ${data.formattedEndTime}
${data.locationName ? `- Lieu : ${data.locationName}` : ''}
${data.memberName ? `- Membre : ${data.memberName}` : ''}
- Prix : ${data.formattedPrice}${promoNoteText(data.price, data.originalPrice)}
${data.depositPaid ? `- Acompte perçu : ${formatPriceFr(data.depositPaid.amount)}` : ''}

Voir mon calendrier : ${data.calendarUrl}

À bientôt,
L'équipe ${appConfig.name}
  `.trim();
}

/**
 * Send cancellation email to client
 */
export async function sendCancellationEmail(data: {
  clientEmail: string;
  clientName: string;
  /** Client's booking language ('fr' | 'en', anything else → fr). */
  locale?: string;
  serviceName: string;
  datetime: Date;
  reason?: string;
  providerName: string;
  providerSlug?: string;
  locationName?: string;
  /** When set, the email tells the client a refund of this amount
   *  (in cents) is on its way. Mutually exclusive with `unrefundedAmount`. */
  refundedAmount?: number | null;
  /** When set, the email warns the client that the deposit of this
   *  amount (in cents) is NOT being refunded — typically because the
   *  cancellation happened past the refund deadline. */
  unrefundedAmount?: number | null;
}): Promise<EmailResult> {
  console.log('[EMAIL] Sending cancellation email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const l = resolveEmailLocale(data.locale);
    const formattedDate = formatEmailDate(data.datetime, l);
    const formattedTime = formatEmailTime(data.datetime, l);
    const businessName = data.providerName || appConfig.name;
    const rebookUrl = data.providerSlug ? `${appConfig.url}/p/${data.providerSlug}` : appConfig.url;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject: EMAIL_TEXTS.cancellation[l].subject(data.serviceName),
      html: generateCancellationHtml({
        ...data,
        emailLocale: l,
        formattedDate,
        formattedTime,
        businessName,
        rebookUrl,
      }),
      text: generateCancellationText({
        ...data,
        emailLocale: l,
        formattedDate,
        formattedTime,
        businessName,
        rebookUrl,
      }),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Cancellation email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send cancellation email to provider when client cancels
 */
export async function sendProviderCancellationEmail(data: {
  providerEmail: string;
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  datetime: Date;
  reason?: string;
  providerName: string;
  locationName?: string;
  memberName?: string;
  cancelledBy: 'client' | 'provider';
  /** When the deposit was refunded as part of this cancellation. */
  refundedAmount?: number | null;
  /** When a deposit was paid but NOT refunded (delay expired and pro
   *  did not override). The pro keeps the funds. */
  unrefundedAmount?: number | null;
}): Promise<EmailResult> {
  console.log('[EMAIL] Sending provider cancellation email to:', data.providerEmail);

  if (!isValidEmail(data.providerEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const formattedDate = formatDateFr(data.datetime);
    const formattedTime = formatTimeFr(data.datetime);
    const calendarUrl = `${appConfig.url}/pro/calendrier`;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.providerEmail,
      replyTo: emailConfig.replyTo,
      subject: `Rendez-vous annulé - ${data.clientName} - ${data.serviceName}`,
      html: generateProviderCancellationHtml({
        ...data,
        formattedDate,
        formattedTime,
        calendarUrl,
      }),
      text: generateProviderCancellationText({
        ...data,
        formattedDate,
        formattedTime,
        calendarUrl,
      }),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Provider cancellation email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

interface ProviderCancellationTemplateData {
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  formattedDate: string;
  formattedTime: string;
  reason?: string;
  providerName: string;
  locationName?: string;
  memberName?: string;
  cancelledBy: 'client' | 'provider';
  calendarUrl: string;
  refundedAmount?: number | null;
  unrefundedAmount?: number | null;
}

function generateProviderCancellationHtml(data: ProviderCancellationTemplateData): string {
  const cancelledByLabel = data.cancelledBy === 'client' ? 'par le client' : 'par vous';
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour,</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Un rendez-vous a été <strong style="color: #dc2626;">annulé</strong> ${cancelledByLabel}.</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Rendez-vous annulé</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Client</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.clientName}</td></tr>
                      ${data.clientPhone ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Téléphone</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${data.clientPhone}</td></tr>` : ''}
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime}</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Membre</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      ${data.reason ? `<tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a; vertical-align: top;">Motif</td><td style="padding: 8px 0 4px; font-size: 14px; color: #18181b;">${data.reason}</td></tr>` : ''}
                    </table>
                  </div>
                  ${data.refundedAmount ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Acompte remboursé</p>
                    <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">L'acompte de <strong>${formatPriceFr(data.refundedAmount)}</strong> a été remboursé au client. Le montant sera prélevé sur votre prochain virement Stripe.</p>
                  </div>` : ''}
                  ${data.unrefundedAmount ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Acompte conservé</p>
                    <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">L'acompte de <strong>${formatPriceFr(data.unrefundedAmount)}</strong> reste acquis (annulation hors délai de remboursement).</p>
                  </div>` : ''}
                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr><td align="center"><a href="${data.calendarUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Voir mon calendrier</a></td></tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>L'équipe ${appConfig.name}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${appConfig.name}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateProviderCancellationText(data: ProviderCancellationTemplateData): string {
  const cancelledByLabel = data.cancelledBy === 'client' ? 'par le client' : 'par vous';
  return `
Bonjour,

Un rendez-vous a été annulé ${cancelledByLabel}.

Détails :
- Client : ${data.clientName}
${data.clientPhone ? `- Téléphone : ${data.clientPhone}` : ''}
- Prestation : ${data.serviceName}
- Date : ${data.formattedDate}
- Heure : ${data.formattedTime}
${data.locationName ? `- Lieu : ${data.locationName}` : ''}
${data.memberName ? `- Membre : ${data.memberName}` : ''}
${data.reason ? `- Motif : ${data.reason}` : ''}
${data.refundedAmount ? `\nAcompte remboursé au client : ${formatPriceFr(data.refundedAmount)} (sera prélevé sur votre prochain virement Stripe).` : ''}
${data.unrefundedAmount ? `\nAcompte conservé : ${formatPriceFr(data.unrefundedAmount)} (annulation hors délai).` : ''}

Voir mon calendrier : ${data.calendarUrl}

À bientôt,
L'équipe ${appConfig.name}
  `.trim();
}

/**
 * Send reschedule email to client
 */
export async function sendRescheduleEmail(data: BookingEmailData & { oldDatetime: Date }): Promise<EmailResult> {
  console.log('[EMAIL] Sending reschedule email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const l = resolveEmailLocale(data.locale);
    const ics = EMAIL_TEXTS.common[l].ics;
    const formattedOldDate = formatEmailDate(data.oldDatetime, l);
    const formattedOldTime = formatEmailTime(data.oldDatetime, l);
    const formattedNewDate = formatEmailDate(data.datetime, l);
    const formattedNewTime = formatEmailTime(data.datetime, l);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedNewEndTime = formatEmailTime(endDate, l);
    const formattedPrice = formatEmailPrice(data.price, l, data.priceMax);
    const businessName = data.providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = data.cancelToken ? `${appConfig.url}/reservation/annuler/${data.cancelToken}` : null;
    const icsUrl = data.bookingId ? `${appConfig.url}/api/calendar/${data.bookingId}` : null;

    // Google Calendar URL
    const eventTitle = encodeURIComponent(ics.summary(data.serviceName, businessName));
    const eventLocation = encodeURIComponent(data.locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${data.memberName ? ics.withMember(data.memberName) : ics.atBusiness(businessName)}${cancelUrl ? `\n\n${ics.cancelLine(cancelUrl)}` : ''}`
    );
    const eventDates = `${formatGoogleDate(data.datetime)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // ICS content
    const icsDescriptionParts = [data.memberName ? ics.withMember(data.memberName) : ics.atBusiness(businessName)];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(ics.cancelLine(cancelUrl));
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(ics.summary(data.serviceName, businessName));
    const icsLocation = escapeIcs(data.locationAddress || '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Opatam//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${data.bookingId || Date.now()}@opatam.com`,
      `DTSTAMP:${formatGoogleDate(new Date())}`,
      `DTSTART:${formatGoogleDate(data.datetime)}`,
      `DTEND:${formatGoogleDate(endDate)}`,
      `SUMMARY:${icsSummary}`,
      `DESCRIPTION:${icsDescription}`,
      `LOCATION:${icsLocation}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const icsBuffer = Buffer.from(icsContent, 'utf-8');

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject: EMAIL_TEXTS.reschedule[l].subject(data.serviceName),
      attachments: [
        {
          filename: ics.filename,
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: generateRescheduleHtml({
        ...data,
        emailLocale: l,
        formattedOldDate,
        formattedOldTime,
        formattedNewDate,
        formattedNewTime,
        formattedNewEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        icsUrl,
        googleCalendarUrl,
      }),
      text: generateRescheduleText({
        ...data,
        emailLocale: l,
        formattedOldDate,
        formattedOldTime,
        formattedNewDate,
        formattedNewTime,
        formattedNewEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        icsUrl,
        googleCalendarUrl,
      }),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Reschedule email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send reminder email to client
 */
export async function sendReminderEmail(
  data: BookingEmailData,
  reminderType: '2h' | '24h' | '48h',
  minutesUntil?: number
): Promise<EmailResult> {
  console.log('[EMAIL] Sending reminder email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const l = resolveEmailLocale(data.locale);
    const t = EMAIL_TEXTS.reminder[l];
    const ics = EMAIL_TEXTS.common[l].ics;
    const formattedDate = formatEmailDate(data.datetime, l);
    const formattedTime = formatEmailTime(data.datetime, l);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedEndTime = formatEmailTime(endDate, l);
    const formattedPrice = formatEmailPrice(data.price, l, data.priceMax);
    const businessName = data.providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = data.cancelToken ? `${appConfig.url}/reservation/annuler/${data.cancelToken}` : null;
    const icsUrl = data.bookingId ? `${appConfig.url}/api/calendar/${data.bookingId}` : null;

    // Google Calendar URL
    const eventTitle = encodeURIComponent(ics.summary(data.serviceName, businessName));
    const eventLocation = encodeURIComponent(data.locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${data.memberName ? ics.withMember(data.memberName) : ics.atBusiness(businessName)}${cancelUrl ? `\n\n${ics.cancelLine(cancelUrl)}` : ''}`
    );
    const eventDates = `${formatGoogleDate(data.datetime)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // ICS content
    const icsDescriptionParts = [data.memberName ? ics.withMember(data.memberName) : ics.atBusiness(businessName)];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(ics.cancelLine(cancelUrl));
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(ics.summary(data.serviceName, businessName));
    const icsLocation = escapeIcs(data.locationAddress || '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Opatam//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${data.bookingId || Date.now()}@opatam.com`,
      `DTSTAMP:${formatGoogleDate(new Date())}`,
      `DTSTART:${formatGoogleDate(data.datetime)}`,
      `DTEND:${formatGoogleDate(endDate)}`,
      `SUMMARY:${icsSummary}`,
      `DESCRIPTION:${icsDescription}`,
      `LOCATION:${icsLocation}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const icsBuffer = Buffer.from(icsContent, 'utf-8');

    // 24h reminder = "demain"/"tomorrow" (no need for exact hours count)
    // 2h reminder = dynamic "dans X heures/minutes" / "in X hours/minutes"
    const timeLabel = reminderType === '24h'
      ? t.tomorrow
      : reminderType === '48h'
        ? t.inTwoDays
        : (minutesUntil != null ? formatEmailTimeUntil(minutesUntil, l) : t.inTwoHours);
    const subject = t.subject(timeLabel, data.serviceName);

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject,
      attachments: [
        {
          filename: ics.filename,
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: generateReminderHtml({
        ...data,
        emailLocale: l,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        icsUrl,
        googleCalendarUrl,
        reminderType,
        timeLabel,
      }),
      text: generateReminderText({
        ...data,
        emailLocale: l,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        icsUrl,
        googleCalendarUrl,
        reminderType,
        timeLabel,
      }),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Reminder email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

// HTML Template generators
interface ConfirmationTemplateData extends BookingEmailData {
  emailLocale: EmailLocale;
  formattedDate: string;
  formattedTime: string;
  formattedEndTime: string;
  formattedPrice: string;
  businessName: string;
  cancelUrl: string | null;
  reviewUrl: string | null;
  icsUrl: string | null;
  googleCalendarUrl: string;
}

function generateConfirmationHtml(data: ConfirmationTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.confirmation[l];
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${c.greeting(data.clientName)}</p>
                  ${data.updateContext
                    ? `<p style="margin: 0 0 6px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${data.updateContext.type === 'added'
                        ? t.updateAddedHtml(data.updateContext.serviceName)
                        : t.updateRemovedHtml(data.updateContext.serviceName)}</p>
                       <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #71717a;">${t.updatedSub}</p>`
                    : `<p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.introHtml}</p>`}
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">${data.items && data.items.length >= 2 ? t.boxTitleMulti : t.boxTitleSingle}</p>
                    ${data.items && data.items.length >= 2
                      ? `<div style="margin-bottom: 16px;">${data.items.map((item, idx) => `
                          <div style="padding: 10px 0;${idx > 0 ? ' border-top: 1px solid #bbf7d0;' : ''}">
                            <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr>
                              <td style="font-size: 15px; color: #18181b; font-weight: 600;">${idx + 1}. ${item.serviceName}</td>
                              <td style="font-size: 15px; color: #18181b; font-weight: 700; text-align: right; white-space: nowrap;">${formatEmailPrice(item.price, l)}${promoNoteHtml(item.price, item.originalPrice, l)}</td>
                            </tr></table>
                            <div style="font-size: 13px; color: #71717a; margin-top: 2px;">${formatDurationFr(item.duration)}</div>
                            ${hasSelections(item) ? renderSelectionsHtml(item, l) : ''}
                          </div>`).join('')}</div>`
                      : ''}
                    <table style="width: 100%; border-collapse: collapse;">
                      ${data.items && data.items.length >= 2
                        ? ''
                        : `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${c.labels.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}${hasSelections(data) ? renderSelectionsHtml(data, l) : ''}</td></tr>`}
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime} - ${data.formattedEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.duration}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.duration} min</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.location}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${locationAddressRowsHtml(data, l)}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.with}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">${c.labels.price}</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${data.formattedPrice}${promoNoteHtml(data.price, data.originalPrice, l)}</td></tr>
                      ${data.depositPaid ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.depositPaid}</td><td style="padding: 4px 0; font-size: 14px; color: #16a34a; font-weight: 600;">${formatEmailPrice(data.depositPaid.amount, l)}</td></tr>` : ''}
                      ${data.depositPaid ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.remaining}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formatEmailPrice(Math.max(0, data.price - data.depositPaid.amount), l, data.priceMax != null ? Math.max(0, data.priceMax - data.depositPaid.amount) : null)} ${c.onSite}</td></tr>` : ''}
                    </table>
                  </div>
                  ${addressPendingNoticeHtml(data, l)}
                  ${accessInstructionsBlockHtml(data, l)}
                  ${data.bookingNotice ? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #92400e;">&#x26A0;&#xFE0F; ${c.providerNoticeTitle(data.businessName)}</p>
                    <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.5;">${data.bookingNotice}</p>
                  </div>` : ''}
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">${c.addToCalendar}</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">${c.calendarGoogle}</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${data.icsUrl || data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">${c.calendarApple}</a></td>
                      </tr>
                    </table>
                  </div>
                  ${data.cancelUrl ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">${c.cancelCta}</a></td></tr></table>` : ''}
                  ${data.providerSlug ? `<table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${appConfig.url}/p/${data.providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${c.rebookCta}</a></td></tr></table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">${c.signoff}<br><strong>${data.businessName}</strong></p>
                  ${data.reviewUrl ? `<p style="margin: 16px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">${t.reviewFooterHtml(data.reviewUrl)}</p>` : ''}
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">${c.footerAuto(appConfig.name)}<br>${c.footerIgnore}</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateConfirmationText(data: ConfirmationTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.confirmation[l];
  return `
${c.greeting(data.clientName)}

${data.updateContext
  ? `${data.updateContext.type === 'added' ? t.updateAddedText(data.updateContext.serviceName) : t.updateRemovedText(data.updateContext.serviceName)}\n${t.updatedSub}`
  : t.introText}

${t.detailsHeading}
${data.items && data.items.length >= 2
  ? data.items.map((item) => `- ${c.labels.service}${c.colon} ${item.serviceName} — ${formatDurationFr(item.duration)} · ${formatEmailPrice(item.price, l)}${promoNoteText(item.price, item.originalPrice, l)}${hasSelections(item) ? `\n${renderSelectionsText(item, l)}` : ''}`).join('\n')
  : `- ${c.labels.service}${c.colon} ${data.serviceName}${hasSelections(data) ? `\n${renderSelectionsText(data, l)}` : ''}`}
- ${c.labels.date}${c.colon} ${data.formattedDate}
- ${c.labels.time}${c.colon} ${data.formattedTime} - ${data.formattedEndTime}
- ${c.labels.duration}${c.colon} ${data.duration} min
${data.locationName ? `- ${c.labels.location}${c.colon} ${data.locationName}` : ''}
${locationAddressLineText(data, l)}${addressPendingNoticeText(data, l)}${accessInstructionsBlockText(data, l)}
${data.memberName ? `- ${c.labels.with}${c.colon} ${data.memberName}` : ''}
- ${c.labels.price}${c.colon} ${data.formattedPrice}${promoNoteText(data.price, data.originalPrice, l)}
${data.depositPaid ? `- ${c.labels.depositPaid}${c.colon} ${formatEmailPrice(data.depositPaid.amount, l)}` : ''}
${data.depositPaid ? `- ${c.labels.remainingOnSite}${c.colon} ${formatEmailPrice(Math.max(0, data.price - data.depositPaid.amount), l, data.priceMax != null ? Math.max(0, data.priceMax - data.depositPaid.amount) : null)}` : ''}

${c.addToCalendarText}
- ${c.calendarGoogleText}${c.colon} ${data.googleCalendarUrl}
${data.icsUrl ? `- ${c.calendarApple}${c.colon} ${data.icsUrl}` : ''}

${data.cancelUrl ? c.cancelLineText(data.cancelUrl) : ''}

${data.reviewUrl ? t.reviewFooterText(data.reviewUrl) : ''}

${c.signoff}
${data.businessName}
  `.trim();
}

interface CancellationTemplateData {
  emailLocale: EmailLocale;
  clientName: string;
  serviceName: string;
  formattedDate: string;
  formattedTime: string;
  reason?: string;
  locationName?: string;
  businessName: string;
  rebookUrl: string;
  refundedAmount?: number | null;
  unrefundedAmount?: number | null;
}

function generateCancellationHtml(data: CancellationTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.cancellation[l];
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${c.greeting(data.clientName)}</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.introHtml}</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">${t.boxTitle}</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${c.labels.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime}</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.location}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.reason ? `<tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a; vertical-align: top;">${c.labels.reason}</td><td style="padding: 8px 0 4px; font-size: 14px; color: #18181b;">${data.reason}</td></tr>` : ''}
                    </table>
                  </div>
                  ${data.refundedAmount ? `<div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">${t.refundedTitle}</p>
                    <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.5;">${t.refundedBodyHtml(formatEmailPrice(data.refundedAmount, l))}</p>
                  </div>` : ''}
                  ${data.unrefundedAmount ? `<div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">${t.unrefundedTitle}</p>
                    <p style="margin: 0 0 4px; font-size: 14px; color: #991b1b; line-height: 1.5;">${t.unrefundedBodyHtml(formatEmailPrice(data.unrefundedAmount, l), data.businessName)}</p>
                    <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">${t.unrefundedContactHtml(data.businessName)}</p>
                  </div>` : ''}
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.rebookPromptHtml}</p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${data.rebookUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${c.rebookCta}</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">${t.apology}<br><strong>${data.businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">${c.footerAuto(appConfig.name)}<br>${c.footerIgnore}</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateCancellationText(data: CancellationTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.cancellation[l];
  return `
${c.greeting(data.clientName)}

${t.introText}

${t.detailsHeading}
- ${c.labels.service}${c.colon} ${data.serviceName}
- ${c.labels.date}${c.colon} ${data.formattedDate}
- ${c.labels.time}${c.colon} ${data.formattedTime}
${data.locationName ? `- ${c.labels.location}${c.colon} ${data.locationName}` : ''}
${data.reason ? `- ${c.labels.reason}${c.colon} ${data.reason}` : ''}
${data.refundedAmount ? `\n${t.refundedText(formatEmailPrice(data.refundedAmount, l))}` : ''}
${data.unrefundedAmount ? `\n${t.unrefundedText(formatEmailPrice(data.unrefundedAmount, l), data.businessName)}` : ''}

${t.rebookPromptText(data.rebookUrl)}

${t.apology}

${data.businessName}
  `.trim();
}

interface RescheduleTemplateData extends BookingEmailData {
  emailLocale: EmailLocale;
  formattedOldDate: string;
  formattedOldTime: string;
  formattedNewDate: string;
  formattedNewTime: string;
  formattedNewEndTime: string;
  formattedPrice: string;
  businessName: string;
  cancelUrl: string | null;
  icsUrl: string | null;
  googleCalendarUrl: string;
}

function generateRescheduleHtml(data: RescheduleTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.reschedule[l];
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${c.greeting(data.clientName)}</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.introHtml}</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 16px; opacity: 0.8;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">${t.oldSlotTitle}</p>
                    <p style="margin: 0; font-size: 14px; color: #71717a; text-decoration: line-through;"><span style="text-transform: capitalize;">${data.formattedOldDate}</span> ${t.atJoiner} ${data.formattedOldTime}</p>
                  </div>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">${t.newSlotTitle}</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${c.labels.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedNewDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedNewTime} - ${data.formattedNewEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.duration}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.duration} min</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.location}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${locationAddressRowsHtml(data, l)}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.with}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">${c.labels.price}</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${data.formattedPrice}${promoNoteHtml(data.price, data.originalPrice, l)}</td></tr>
                    </table>
                  </div>
                  ${addressPendingNoticeHtml(data, l)}
                  ${accessInstructionsBlockHtml(data, l)}
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">${c.updateCalendar}</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">${c.calendarGoogle}</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${data.icsUrl || data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">${c.calendarApple}</a></td>
                      </tr>
                    </table>
                  </div>
                  ${data.cancelUrl ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">${c.cancelCta}</a></td></tr></table>` : ''}
                  ${data.providerSlug ? `<table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${appConfig.url}/p/${data.providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${c.rebookCta}</a></td></tr></table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">${c.signoff}<br><strong>${data.businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">${c.footerAuto(appConfig.name)}<br>${c.footerIgnore}</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateRescheduleText(data: RescheduleTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.reschedule[l];
  return `
${c.greeting(data.clientName)}

${t.introText}

${t.oldSlotLineText(data.formattedOldDate, data.formattedOldTime)}

${t.newSlotHeadingText}
- ${c.labels.service}${c.colon} ${data.serviceName}
- ${c.labels.date}${c.colon} ${data.formattedNewDate}
- ${c.labels.time}${c.colon} ${data.formattedNewTime} - ${data.formattedNewEndTime}
- ${c.labels.duration}${c.colon} ${data.duration} min
${data.locationName ? `- ${c.labels.location}${c.colon} ${data.locationName}` : ''}
${locationAddressLineText(data, l)}${addressPendingNoticeText(data, l)}${accessInstructionsBlockText(data, l)}
${data.memberName ? `- ${c.labels.with}${c.colon} ${data.memberName}` : ''}
- ${c.labels.price}${c.colon} ${data.formattedPrice}${promoNoteText(data.price, data.originalPrice, l)}

${c.updateCalendarText}
- ${c.calendarGoogleText}${c.colon} ${data.googleCalendarUrl}
${data.icsUrl ? `- ${c.calendarApple}${c.colon} ${data.icsUrl}` : ''}

${data.cancelUrl ? c.cancelLineText(data.cancelUrl) : ''}

${c.signoff}
${data.businessName}
  `.trim();
}

interface ReminderTemplateData extends BookingEmailData {
  emailLocale: EmailLocale;
  formattedDate: string;
  formattedTime: string;
  formattedEndTime: string;
  formattedPrice: string;
  businessName: string;
  cancelUrl: string | null;
  icsUrl: string | null;
  googleCalendarUrl: string;
  reminderType: '2h' | '24h' | '48h';
  timeLabel: string;
}

function generateReminderHtml(data: ReminderTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.reminder[l];
  const introText = t.introHtml(data.timeLabel);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${c.greeting(data.clientName)}</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${introText}</p>
                  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">${t.boxTitle}</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${c.labels.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime} - ${data.formattedEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.duration}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.duration} min</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.location}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${locationAddressRowsHtml(data, l)}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.with}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">${c.labels.price}</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${data.formattedPrice}${promoNoteHtml(data.price, data.originalPrice, l)}</td></tr>
                      ${data.depositPaid ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.depositPaid}</td><td style="padding: 4px 0; font-size: 14px; color: #16a34a; font-weight: 600;">${formatEmailPrice(data.depositPaid.amount, l)}</td></tr>` : ''}
                      ${data.depositPaid ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.remaining}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formatEmailPrice(Math.max(0, data.price - data.depositPaid.amount), l, data.priceMax != null ? Math.max(0, data.priceMax - data.depositPaid.amount) : null)} ${c.onSite}</td></tr>` : ''}
                    </table>
                  </div>
                  ${addressPendingNoticeHtml(data, l)}
                  ${accessInstructionsBlockHtml(data, l)}
                  ${data.bookingNotice ? `<div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 600; color: #92400e;">&#x26A0;&#xFE0F; ${c.providerNoticeTitle(data.businessName)}</p>
                    <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.5;">${data.bookingNotice}</p>
                  </div>` : ''}
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">${c.addToCalendar}</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">${c.calendarGoogle}</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${data.icsUrl || data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">${c.calendarApple}</a></td>
                      </tr>
                    </table>
                  </div>
                  ${data.cancelUrl ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">${c.cancelCta}</a></td></tr></table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">${c.signoff}<br><strong>${data.businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">${c.footerAuto(appConfig.name)}<br>${c.footerIgnore}</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateReminderText(data: ReminderTemplateData): string {
  const l = data.emailLocale;
  const c = EMAIL_TEXTS.common[l];
  const t = EMAIL_TEXTS.reminder[l];
  const introText = t.introText(data.timeLabel);

  return `
${c.greeting(data.clientName)}

${introText}

${t.detailsHeading}
- ${c.labels.service}${c.colon} ${data.serviceName}
- ${c.labels.date}${c.colon} ${data.formattedDate}
- ${c.labels.time}${c.colon} ${data.formattedTime} - ${data.formattedEndTime}
- ${c.labels.duration}${c.colon} ${data.duration} min
${data.locationName ? `- ${c.labels.location}${c.colon} ${data.locationName}` : ''}
${locationAddressLineText(data, l)}${addressPendingNoticeText(data, l)}${accessInstructionsBlockText(data, l)}
${data.memberName ? `- ${c.labels.with}${c.colon} ${data.memberName}` : ''}
- ${c.labels.price}${c.colon} ${data.formattedPrice}${promoNoteText(data.price, data.originalPrice, l)}

${c.addToCalendarText}
- ${c.calendarGoogleText}${c.colon} ${data.googleCalendarUrl}
${data.icsUrl ? `- ${c.calendarApple}${c.colon} ${data.icsUrl}` : ''}

${data.cancelUrl ? c.cancelLineText(data.cancelUrl) : ''}

${c.signoff}
${data.businessName}
  `.trim();
}

// ---------------------------------------------------------------------------
// Welcome / Subscription Email
// ---------------------------------------------------------------------------

/**
 * Send welcome email to provider after subscribing to a plan
 */
export async function sendWelcomeEmail(data: {
  providerEmail: string;
  providerName: string;
  planName: string; // 'Pro' or 'Studio'
  planFeatures: string[];
}): Promise<EmailResult> {
  console.log('[EMAIL] Sending welcome email to:', data.providerEmail);

  if (!isValidEmail(data.providerEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const isPro = data.planName === 'Pro';
    const themeColor = isPro ? '#3b82f6' : '#8b5cf6';
    const themeBg = isPro ? '#eff6ff' : '#f5f3ff';
    const themeBorder = isPro ? '#bfdbfe' : '#c4b5fd';
    const tierLabel = isPro ? 'Indépendant' : 'Équipe';

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.providerEmail,
      subject: `Bienvenue chez ${appConfig.name} — Plan ${data.planName} activé !`,
      html: generateWelcomeHtml({ ...data, isPro, themeColor, themeBg, themeBorder, tierLabel }),
      text: generateWelcomeText(data),
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Welcome email sent successfully');
    return { success: true };
  } catch (err) {
    console.error('[EMAIL] Exception sending welcome email:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

interface WelcomeTemplateData {
  providerName: string;
  planName: string;
  planFeatures: string[];
  isPro: boolean;
  themeColor: string;
  themeBg: string;
  themeBorder: string;
  tierLabel: string;
}

function generateWelcomeHtml(data: WelcomeTemplateData): string {
  const featuresHtml = data.planFeatures
    .map(f => `<tr><td style="padding: 6px 0; font-size: 14px; color: #18181b;"><span style="color: #16a34a; font-weight: bold; margin-right: 8px;">&#10003;</span> ${f}</td></tr>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.providerName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Merci d'avoir choisi <strong>${appConfig.name}</strong> ! Votre abonnement <strong style="color: ${data.themeColor};">${data.planName}</strong> est désormais actif.</p>
                  <div style="background-color: ${data.themeBg}; border: 1px solid ${data.themeBorder}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: ${data.themeColor}; text-transform: uppercase; letter-spacing: 0.5px;">Votre plan</p>
                    <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #18181b;">${data.planName} <span style="font-size: 14px; font-weight: 400; color: #71717a;">&mdash; ${data.tierLabel}</span></p>
                    <table style="width: 100%; border-collapse: collapse;">
                      ${featuresHtml}
                    </table>
                  </div>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">Tout est prêt pour accueillir vos premiers clients. Configurez vos disponibilités, ajoutez vos prestations et partagez votre page de réservation.</p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${appConfig.url}/pro/calendrier" style="display: inline-block; padding: 14px 32px; background-color: ${data.themeColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Accéder à mon espace</a></td></tr></table>
                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;"><a href="${appConfig.url}/pro/parametres?tab=abonnement" style="color: ${data.themeColor}; text-decoration: underline;">Gérer mon abonnement</a></p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>L'équipe ${appConfig.name}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${appConfig.name}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateWelcomeText(data: {
  providerName: string;
  planName: string;
  planFeatures: string[];
}): string {
  const isPro = data.planName === 'Pro';
  const tierLabel = isPro ? 'Indépendant' : 'Équipe';
  const featuresText = data.planFeatures.map(f => `- ${f}`).join('\n');

  return `
Bonjour ${data.providerName},

Merci d'avoir choisi ${appConfig.name} ! Votre abonnement ${data.planName} est désormais actif.

Votre plan : ${data.planName} — ${tierLabel}
${featuresText}

Tout est prêt pour accueillir vos premiers clients.

Accéder à mon espace : ${appConfig.url}/pro/calendrier
Gérer mon abonnement : ${appConfig.url}/pro/parametres?tab=abonnement

À bientôt,
L'équipe ${appConfig.name}
  `.trim();
}

// ─── Password Reset Email ─────────────────────────────────────────────────

export interface PasswordResetEmailData {
  email: string;
  resetLink: string;
  name?: string;
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<EmailResult> {
  console.log('[EMAIL] Sending password reset email to:', data.email);

  if (!isValidEmail(data.email)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const greeting = data.name ? `Bonjour ${data.name},` : 'Bonjour,';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:480px;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height:48px;max-width:200px;" />
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td align="center">
              <a href="${data.resetLink}" style="display:inline-block;padding:14px 32px;background-color:#1a6daf;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">Réinitialiser mon mot de passe</a>
            </td></tr>
          </table>
          <div style="background-color:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#71717a;text-align:center;">Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
          </div>
          <p style="margin:0;font-size:13px;color:#a1a1aa;">Si le bouton ne fonctionne pas, copiez ce lien :</p>
          <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;word-break:break-all;">${data.resetLink}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:14px;color:#71717a;text-align:center;">L'équipe <strong>${appConfig.name}</strong></p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">Cet email a été envoyé automatiquement par ${appConfig.name}.</p>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `${greeting}

Vous avez demandé à réinitialiser votre mot de passe.
Cliquez sur le lien ci-dessous pour en choisir un nouveau :

${data.resetLink}

Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.

L'équipe ${appConfig.name}`;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.email,
      replyTo: emailConfig.replyTo,
      subject: 'Réinitialisez votre mot de passe Opatam',
      html,
      text,
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Password reset email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

// ─── Email Change Verification ────────────────────────────────────────────

export interface EmailChangeEmailData {
  email: string; // the NEW address (recipient)
  changeLink: string;
  name?: string;
}

/**
 * Sent server-side (callable requestEmailChange) when a pro changes their
 * login email. We generate the verify-and-change link with the Admin SDK and
 * deliver it via Resend — avoiding the client-side reCAPTCHA path that
 * `verifyBeforeUpdateEmail` requires (which fails with auth/error-code:-26
 * when reCAPTCHA isn't wired up for the web app). Same pattern as the
 * password-reset email.
 */
export async function sendEmailChangeEmail(data: EmailChangeEmailData): Promise<EmailResult> {
  console.log('[EMAIL] Sending email-change verification to:', data.email);

  if (!isValidEmail(data.email)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const greeting = data.name ? `Bonjour ${data.name},` : 'Bonjour,';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:480px;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
        <tr><td style="padding:32px 32px 24px;text-align:center;">
          <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height:48px;max-width:200px;" />
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#3f3f46;">${greeting}</p>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#3f3f46;">Vous avez demandé à utiliser cette adresse email pour votre compte ${appConfig.name}. Cliquez sur le bouton ci-dessous pour confirmer le changement.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr><td align="center">
              <a href="${data.changeLink}" style="display:inline-block;padding:14px 32px;background-color:#1a6daf;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;">Confirmer ma nouvelle adresse</a>
            </td></tr>
          </table>
          <div style="background-color:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="margin:0;font-size:13px;color:#71717a;text-align:center;">Tant que vous n'avez pas cliqué, votre adresse actuelle reste active. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
          </div>
          <p style="margin:0;font-size:13px;color:#a1a1aa;">Si le bouton ne fonctionne pas, copiez ce lien :</p>
          <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;word-break:break-all;">${data.changeLink}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:14px;color:#71717a;text-align:center;">L'équipe <strong>${appConfig.name}</strong></p>
        </td></tr>
      </table>
      <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;text-align:center;">Cet email a été envoyé automatiquement par ${appConfig.name}.</p>
    </td></tr>
  </table>
</body>
</html>`;

    const text = `${greeting}

Vous avez demandé à utiliser cette adresse email pour votre compte ${appConfig.name}.
Cliquez sur le lien ci-dessous pour confirmer le changement :

${data.changeLink}

Tant que vous n'avez pas cliqué, votre adresse actuelle reste active.
Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.

L'équipe ${appConfig.name}`;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.email,
      replyTo: emailConfig.replyTo,
      subject: 'Confirmez votre nouvelle adresse email Opatam',
      html,
      text,
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Email-change verification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

// ──────────────────────────────────────────────────────────────────────
// Review request email
// ──────────────────────────────────────────────────────────────────────

export interface ReviewRequestEmailData {
  bookingId: string;
  clientEmail: string;
  clientName: string;
  /** Client's booking language ('fr' | 'en', anything else → fr). */
  locale?: string;
  serviceName: string;
  datetime: Date;
  providerName: string;
}

/**
 * Sent automatically by `sendReviewRequests` to every confirmed
 * past booking that hasn't received a request yet (and whose
 * provider hasn't disabled auto reminders). Mirrors the manual
 * "Demander un avis" email at apps/web/app/api/bookings/
 * review-request-email so the look stays consistent regardless
 * of how the request was triggered.
 */
export async function sendReviewRequestEmail(
  data: ReviewRequestEmailData,
): Promise<EmailResult> {
  console.log('[EMAIL] Sending review request to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const l = resolveEmailLocale(data.locale);
    const c = EMAIL_TEXTS.common[l];
    const t = EMAIL_TEXTS.review[l];
    const reviewUrl = `${appConfig.url}/avis/${data.bookingId}`;
    const formattedDate = formatEmailDate(data.datetime, l);
    const formattedTime = formatEmailTime(data.datetime, l);

    const subject = t.subject(data.serviceName);

    const html = `<!DOCTYPE html>
<html lang="${t.htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #fafafa;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #fafafa;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" style="width: 100%; max-width: 560px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding: 32px 32px 8px;">
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.6px;">${t.eyebrow}</p>
              <h1 style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #18181b;">${t.heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${c.greeting(data.clientName)}</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.body}</p>
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px;">${t.boxTitle}</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${c.labels.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${c.labels.at}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.providerName}</td></tr>
                </table>
              </div>
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${reviewUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${t.cta}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">${t.visibleNote(data.providerName)}</p>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa;">${t.sentBy} <a href="${appConfig.url}" style="color: #6366f1; text-decoration: none;">${appConfig.name}</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = [
      c.greeting(data.clientName),
      '',
      t.body,
      '',
      t.boxTitleText,
      `- ${c.labels.service}${c.colon} ${data.serviceName}`,
      `- ${c.labels.date}${c.colon} ${formattedDate}`,
      `- ${c.labels.time}${c.colon} ${formattedTime}`,
      `- ${c.labels.at}${c.colon} ${data.providerName}`,
      '',
      t.ctaLineText,
      reviewUrl,
      '',
      t.visibleNote(data.providerName),
    ].join('\n');

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject,
      html,
      text,
    });

    if (error) {
      console.error('[EMAIL] Resend review-request error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Review request sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[EMAIL] Exception:', error);
    return { success: false, error: String(error) };
  }
}

// ---------------------------------------------------------------------------
// Sérénité — Trial ending warning (J-3)
// ---------------------------------------------------------------------------

export interface SerenityTrialEndingEmailData {
  providerEmail: string;
  businessName: string;
  /** Base trial end date — deposits stop working past it without Sérénité. */
  trialEndsAt: Date;
}

/**
 * Warns a trial provider ~3 days before their trial ends that the deposits
 * they are using (included for free during the trial) will STOP being
 * collected unless they subscribe to the Sérénité add-on after converting.
 * Sent once per provider (guarded by `serenityTrialWarnAt` on the doc).
 */
export async function sendSerenityTrialEndingEmail(
  data: SerenityTrialEndingEmailData,
): Promise<EmailResult> {
  console.log('[EMAIL] Sending Sérénité trial-ending warning to:', data.providerEmail);

  if (!isValidEmail(data.providerEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  const endDateFr = formatDateFr(data.trialEndsAt);
  const ctaUrl = `${appConfig.url}/pro/parametres?tab=paiements`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.businessName},</p>
                  <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                    Votre période d'essai se termine le <strong>${endDateFr}</strong>.
                    Pendant l'essai, les <strong>acomptes</strong> sont inclus gratuitement —
                    et vous les utilisez pour sécuriser vos réservations. 👏
                  </p>
                  <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px 18px; margin: 0 0 20px;">
                    <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #92400e;">
                      Après cette date, vos réservations seront confirmées
                      <strong>sans acompte</strong>, sauf si vous activez l'abonnement
                      <strong>Sérénité</strong> (5&nbsp;€/mois) en plus de votre plan.
                      Votre configuration est conservée et se réactivera aussitôt.
                    </p>
                  </div>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                    Pour continuer sans interruption&nbsp;: souscrivez votre plan à la fin
                    de l'essai, puis activez Sérénité en un clic.
                  </p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${ctaUrl}" style="display: inline-block; padding: 14px 32px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; border-radius: 8px;">Voir mes options d'acomptes</a></td></tr></table>
                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">Sans engagement, annulable à tout moment.</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #a1a1aa; text-align: center;">
                    Une question&nbsp;? Répondez simplement à cet email.<br />
                    L'équipe ${appConfig.name}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${data.businessName},

Votre période d'essai se termine le ${endDateFr}.
Pendant l'essai, les acomptes sont inclus gratuitement — et vous les utilisez pour sécuriser vos réservations.

Après cette date, vos réservations seront confirmées SANS acompte, sauf si vous activez l'abonnement Sérénité (5 €/mois) en plus de votre plan. Votre configuration est conservée et se réactivera aussitôt.

Pour continuer sans interruption : souscrivez votre plan à la fin de l'essai, puis activez Sérénité en un clic :
${ctaUrl}

Sans engagement, annulable à tout moment.

L'équipe ${appConfig.name}
  `.trim();

  try {
    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.providerEmail,
      subject: "Vos acomptes s'arrêtent à la fin de votre essai — continuez avec Sérénité",
      html,
      text,
    });

    if (error) {
      console.error('[EMAIL] Resend error:', error);
      return { success: false, error: String(error) };
    }

    console.log('[EMAIL] Sérénité trial-ending warning sent successfully');
    return { success: true };
  } catch (err) {
    console.error('[EMAIL] Exception sending Sérénité trial-ending warning:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
