/**
 * Resend Email Service
 * Handles sending emails via Resend API
 */

import { Resend } from 'resend';
import { defineString } from 'firebase-functions/params';

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
const STORAGE_BUCKET = 'opatam-da04b.appspot.com';
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
  });
}

// Helper to format time in French
export function formatTimeFr(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to format price (centimes to euros)
export function formatPriceFr(priceInCentimes: number): string {
  const priceInEuros = priceInCentimes / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInEuros);
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
  serviceName: string;
  datetime: Date;
  duration: number;
  price: number;
  providerName: string;
  providerSlug?: string;
  locationName?: string;
  locationAddress?: string;
  memberName?: string;
  cancelToken?: string;
  bookingId?: string;
}

/**
 * Send confirmation email to client
 */
export async function sendConfirmationEmail(data: BookingEmailData): Promise<EmailResult> {
  console.log('[EMAIL] Sending confirmation email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const formattedDate = formatDateFr(data.datetime);
    const formattedTime = formatTimeFr(data.datetime);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedEndTime = formatTimeFr(endDate);
    const formattedPrice = formatPriceFr(data.price);
    const businessName = data.providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = data.cancelToken ? `${appConfig.url}/reservation/annuler/${data.cancelToken}` : null;
    const reviewUrl = data.bookingId ? `${appConfig.url}/avis/${data.bookingId}` : null;
    const icsUrl = data.bookingId ? `${appConfig.url}/api/calendar/${data.bookingId}` : null;

    // Google Calendar URL
    const eventTitle = encodeURIComponent(`RDV - ${data.serviceName} chez ${businessName}`);
    const eventLocation = encodeURIComponent(data.locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${data.memberName ? `Avec ${data.memberName}` : `Chez ${businessName}`}${cancelUrl ? `\n\nPour annuler : ${cancelUrl}` : ''}`
    );
    const eventDates = `${formatGoogleDate(data.datetime)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // Generate ICS content
    const icsDescriptionParts = [data.memberName ? `Avec ${data.memberName}` : `Chez ${businessName}`];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(`Pour annuler : ${cancelUrl}`);
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(`RDV - ${data.serviceName} chez ${businessName}`);
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
      subject: `Confirmation de votre rendez-vous - ${data.serviceName}`,
      attachments: [
        {
          filename: 'rendez-vous.ics',
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: generateConfirmationHtml({
        ...data,
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
 * Send cancellation email to client
 */
export async function sendCancellationEmail(data: {
  clientEmail: string;
  clientName: string;
  serviceName: string;
  datetime: Date;
  reason?: string;
  providerName: string;
  providerSlug?: string;
  locationName?: string;
}): Promise<EmailResult> {
  console.log('[EMAIL] Sending cancellation email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const formattedDate = formatDateFr(data.datetime);
    const formattedTime = formatTimeFr(data.datetime);
    const businessName = data.providerName || appConfig.name;
    const rebookUrl = data.providerSlug ? `${appConfig.url}/p/${data.providerSlug}` : appConfig.url;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject: `Annulation de votre rendez-vous - ${data.serviceName}`,
      html: generateCancellationHtml({
        ...data,
        formattedDate,
        formattedTime,
        businessName,
        rebookUrl,
      }),
      text: generateCancellationText({
        ...data,
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
 * Send reschedule email to client
 */
export async function sendRescheduleEmail(data: BookingEmailData & { oldDatetime: Date }): Promise<EmailResult> {
  console.log('[EMAIL] Sending reschedule email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const formattedOldDate = formatDateFr(data.oldDatetime);
    const formattedOldTime = formatTimeFr(data.oldDatetime);
    const formattedNewDate = formatDateFr(data.datetime);
    const formattedNewTime = formatTimeFr(data.datetime);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedNewEndTime = formatTimeFr(endDate);
    const formattedPrice = formatPriceFr(data.price);
    const businessName = data.providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = data.cancelToken ? `${appConfig.url}/reservation/annuler/${data.cancelToken}` : null;
    const icsUrl = data.bookingId ? `${appConfig.url}/api/calendar/${data.bookingId}` : null;

    // Google Calendar URL
    const eventTitle = encodeURIComponent(`RDV - ${data.serviceName} chez ${businessName}`);
    const eventLocation = encodeURIComponent(data.locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${data.memberName ? `Avec ${data.memberName}` : `Chez ${businessName}`}${cancelUrl ? `\n\nPour annuler : ${cancelUrl}` : ''}`
    );
    const eventDates = `${formatGoogleDate(data.datetime)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // ICS content
    const icsDescriptionParts = [data.memberName ? `Avec ${data.memberName}` : `Chez ${businessName}`];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(`Pour annuler : ${cancelUrl}`);
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(`RDV - ${data.serviceName} chez ${businessName}`);
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
      subject: `Modification de votre rendez-vous - ${data.serviceName}`,
      attachments: [
        {
          filename: 'rendez-vous.ics',
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: generateRescheduleHtml({
        ...data,
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
  reminderType: '2h' | '24h'
): Promise<EmailResult> {
  console.log('[EMAIL] Sending reminder email to:', data.clientEmail);

  if (!isValidEmail(data.clientEmail)) {
    console.log('[EMAIL] Invalid email format');
    return { success: false, error: 'Invalid email format' };
  }

  try {
    const formattedDate = formatDateFr(data.datetime);
    const formattedTime = formatTimeFr(data.datetime);
    const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
    const formattedEndTime = formatTimeFr(endDate);
    const formattedPrice = formatPriceFr(data.price);
    const businessName = data.providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = data.cancelToken ? `${appConfig.url}/reservation/annuler/${data.cancelToken}` : null;
    const icsUrl = data.bookingId ? `${appConfig.url}/api/calendar/${data.bookingId}` : null;

    // Google Calendar URL
    const eventTitle = encodeURIComponent(`RDV - ${data.serviceName} chez ${businessName}`);
    const eventLocation = encodeURIComponent(data.locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${data.memberName ? `Avec ${data.memberName}` : `Chez ${businessName}`}${cancelUrl ? `\n\nPour annuler : ${cancelUrl}` : ''}`
    );
    const eventDates = `${formatGoogleDate(data.datetime)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // ICS content
    const icsDescriptionParts = [data.memberName ? `Avec ${data.memberName}` : `Chez ${businessName}`];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(`Pour annuler : ${cancelUrl}`);
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(`RDV - ${data.serviceName} chez ${businessName}`);
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

    const subject = reminderType === '24h'
      ? `Rappel : votre rendez-vous demain - ${data.serviceName}`
      : `Rappel : votre rendez-vous dans 2h - ${data.serviceName}`;

    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject,
      attachments: [
        {
          filename: 'rendez-vous.ics',
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: generateReminderHtml({
        ...data,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        icsUrl,
        googleCalendarUrl,
        reminderType,
      }),
      text: generateReminderText({
        ...data,
        formattedDate,
        formattedTime,
        formattedEndTime,
        formattedPrice,
        businessName,
        cancelUrl,
        icsUrl,
        googleCalendarUrl,
        reminderType,
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
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Votre rendez-vous a bien ete <strong style="color: #16a34a;">confirme</strong>.</p>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Votre rendez-vous</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime} - ${data.formattedEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Duree</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.duration} min</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.locationAddress ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${data.locationAddress}</td></tr>` : ''}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${data.formattedPrice}</td></tr>
                    </table>
                  </div>
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">Ajouter a votre calendrier</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Google</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${data.icsUrl || data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Apple / Outlook</a></td>
                      </tr>
                    </table>
                  </div>
                  ${data.cancelUrl ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">Annuler le rendez-vous</a></td></tr></table>` : ''}
                  ${data.providerSlug ? `<table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${appConfig.url}/p/${data.providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Reprendre rendez-vous</a></td></tr></table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">A bientot,<br><strong>${data.businessName}</strong></p>
                  ${data.reviewUrl ? `<p style="margin: 16px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">Apres votre rendez-vous, <a href="${data.reviewUrl}" style="color: #6366f1; text-decoration: underline;">donnez-nous votre avis</a></p>` : ''}
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a ete envoye automatiquement par ${appConfig.name}.<br>Si vous n'etes pas concerne, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateConfirmationText(data: ConfirmationTemplateData): string {
  return `
Bonjour ${data.clientName},

Votre rendez-vous a bien ete confirme.

Details de votre rendez-vous :
- Prestation : ${data.serviceName}
- Date : ${data.formattedDate}
- Heure : ${data.formattedTime} - ${data.formattedEndTime}
- Duree : ${data.duration} min
${data.locationName ? `- Lieu : ${data.locationName}` : ''}
${data.locationAddress ? `- Adresse : ${data.locationAddress}` : ''}
${data.memberName ? `- Avec : ${data.memberName}` : ''}
- Prix : ${data.formattedPrice}

Ajouter a votre calendrier :
- Google Calendar : ${data.googleCalendarUrl}
${data.icsUrl ? `- Apple / Outlook : ${data.icsUrl}` : ''}

${data.cancelUrl ? `Annuler le rendez-vous : ${data.cancelUrl}` : ''}

${data.reviewUrl ? `Apres votre rendez-vous, donnez-nous votre avis : ${data.reviewUrl}` : ''}

A bientot,
${data.businessName}
  `.trim();
}

interface CancellationTemplateData {
  clientName: string;
  serviceName: string;
  formattedDate: string;
  formattedTime: string;
  reason?: string;
  locationName?: string;
  businessName: string;
  rebookUrl: string;
}

function generateCancellationHtml(data: CancellationTemplateData): string {
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
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Nous vous informons que votre rendez-vous a ete <strong style="color: #dc2626;">annule</strong>.</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Rendez-vous annule</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime}</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.reason ? `<tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a; vertical-align: top;">Motif</td><td style="padding: 8px 0 4px; font-size: 14px; color: #18181b;">${data.reason}</td></tr>` : ''}
                    </table>
                  </div>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Si vous souhaitez reprendre un nouveau rendez-vous, n'hesitez pas a nous contacter ou a reserver en ligne.</p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${data.rebookUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Reprendre rendez-vous</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">Nous nous excusons pour la gene occasionnee.<br><strong>${data.businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a ete envoye automatiquement par ${appConfig.name}.<br>Si vous n'etes pas concerne, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateCancellationText(data: CancellationTemplateData): string {
  return `
Bonjour ${data.clientName},

Nous vous informons que votre rendez-vous a ete annule.

Details du rendez-vous annule :
- Prestation : ${data.serviceName}
- Date : ${data.formattedDate}
- Heure : ${data.formattedTime}
${data.locationName ? `- Lieu : ${data.locationName}` : ''}
${data.reason ? `- Motif : ${data.reason}` : ''}

Si vous souhaitez reprendre un nouveau rendez-vous, n'hesitez pas a nous contacter ou a reserver en ligne sur ${data.rebookUrl}

Nous nous excusons pour la gene occasionnee.

${data.businessName}
  `.trim();
}

interface RescheduleTemplateData extends BookingEmailData {
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
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Votre rendez-vous a ete <strong style="color: #2563eb;">modifie</strong>.</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 16px; opacity: 0.8;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Ancien creneau</p>
                    <p style="margin: 0; font-size: 14px; color: #71717a; text-decoration: line-through;"><span style="text-transform: capitalize;">${data.formattedOldDate}</span> a ${data.formattedOldTime}</p>
                  </div>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Nouveau creneau</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedNewDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedNewTime} - ${data.formattedNewEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Duree</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.duration} min</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.locationAddress ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${data.locationAddress}</td></tr>` : ''}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${data.formattedPrice}</td></tr>
                    </table>
                  </div>
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">Mettre a jour votre calendrier</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Google</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${data.icsUrl || data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Apple / Outlook</a></td>
                      </tr>
                    </table>
                  </div>
                  ${data.cancelUrl ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">Annuler le rendez-vous</a></td></tr></table>` : ''}
                  ${data.providerSlug ? `<table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${appConfig.url}/p/${data.providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Reprendre rendez-vous</a></td></tr></table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">A bientot,<br><strong>${data.businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a ete envoye automatiquement par ${appConfig.name}.<br>Si vous n'etes pas concerne, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateRescheduleText(data: RescheduleTemplateData): string {
  return `
Bonjour ${data.clientName},

Votre rendez-vous a ete modifie.

Ancien creneau : ${data.formattedOldDate} a ${data.formattedOldTime}

Nouveau creneau :
- Prestation : ${data.serviceName}
- Date : ${data.formattedNewDate}
- Heure : ${data.formattedNewTime} - ${data.formattedNewEndTime}
- Duree : ${data.duration} min
${data.locationName ? `- Lieu : ${data.locationName}` : ''}
${data.locationAddress ? `- Adresse : ${data.locationAddress}` : ''}
${data.memberName ? `- Avec : ${data.memberName}` : ''}
- Prix : ${data.formattedPrice}

Mettre a jour votre calendrier :
- Google Calendar : ${data.googleCalendarUrl}
${data.icsUrl ? `- Apple / Outlook : ${data.icsUrl}` : ''}

${data.cancelUrl ? `Annuler le rendez-vous : ${data.cancelUrl}` : ''}

A bientot,
${data.businessName}
  `.trim();
}

interface ReminderTemplateData extends BookingEmailData {
  formattedDate: string;
  formattedTime: string;
  formattedEndTime: string;
  formattedPrice: string;
  businessName: string;
  cancelUrl: string | null;
  icsUrl: string | null;
  googleCalendarUrl: string;
  reminderType: '2h' | '24h';
}

function generateReminderHtml(data: ReminderTemplateData): string {
  const introText = data.reminderType === '24h'
    ? `Nous vous rappelons que votre rendez-vous a lieu <strong style="color: #2563eb;">demain</strong>.`
    : `Nous vous rappelons que votre rendez-vous a lieu <strong style="color: #2563eb;">dans 2 heures</strong>.`;

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
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${introText}</p>
                  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">Rappel de rendez-vous</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${data.formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.formattedTime} - ${data.formattedEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Duree</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.duration} min</td></tr>
                      ${data.locationName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.locationName}</td></tr>` : ''}
                      ${data.locationAddress ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${data.locationAddress}</td></tr>` : ''}
                      ${data.memberName ? `<tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.memberName}</td></tr>` : ''}
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${data.formattedPrice}</td></tr>
                    </table>
                  </div>
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">Ajouter a votre calendrier</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Google</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${data.icsUrl || data.googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Apple / Outlook</a></td>
                      </tr>
                    </table>
                  </div>
                  ${data.cancelUrl ? `<table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">Annuler le rendez-vous</a></td></tr></table>` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">A bientot,<br><strong>${data.businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a ete envoye automatiquement par ${appConfig.name}.<br>Si vous n'etes pas concerne, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateReminderText(data: ReminderTemplateData): string {
  const introText = data.reminderType === '24h'
    ? 'Nous vous rappelons que votre rendez-vous a lieu demain.'
    : 'Nous vous rappelons que votre rendez-vous a lieu dans 2 heures.';

  return `
Bonjour ${data.clientName},

${introText}

Details de votre rendez-vous :
- Prestation : ${data.serviceName}
- Date : ${data.formattedDate}
- Heure : ${data.formattedTime} - ${data.formattedEndTime}
- Duree : ${data.duration} min
${data.locationName ? `- Lieu : ${data.locationName}` : ''}
${data.locationAddress ? `- Adresse : ${data.locationAddress}` : ''}
${data.memberName ? `- Avec : ${data.memberName}` : ''}
- Prix : ${data.formattedPrice}

Ajouter a votre calendrier :
- Google Calendar : ${data.googleCalendarUrl}
${data.icsUrl ? `- Apple / Outlook : ${data.icsUrl}` : ''}

${data.cancelUrl ? `Annuler le rendez-vous : ${data.cancelUrl}` : ''}

A bientot,
${data.businessName}
  `.trim();
}
