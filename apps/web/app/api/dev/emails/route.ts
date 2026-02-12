import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Sample data used across all email previews
// ---------------------------------------------------------------------------
const SAMPLE = {
  clientName: 'Marie Dupont',
  serviceName: 'Coupe Homme',
  duration: 30,
  price: 2500, // centimes
  providerName: 'Salon Élégance',
  providerSlug: 'salon-elegance',
  locationName: 'Paris 11e',
  locationAddress: '45 rue de la Roquette, 75011 Paris',
  memberName: 'Julien',
} as const;

const APP_NAME = 'Opatam';
const APP_URL = 'https://opatam.com';
const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

// Helpers -------------------------------------------------------------------

function getNextMonday14h(): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const d = new Date(now);
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(14, 0, 0, 0);
  return d;
}

function formatDateFr(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTimeFr(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPriceFr(priceInCentimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInCentimes / 100);
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ---------------------------------------------------------------------------
// Email HTML generators (replicate production templates exactly)
// ---------------------------------------------------------------------------

function generateConfirmationHtml(): string {
  const datetime = getNextMonday14h();
  const endDate = new Date(datetime.getTime() + SAMPLE.duration * 60 * 1000);
  const formattedDate = formatDateFr(datetime);
  const formattedTime = formatTimeFr(datetime);
  const formattedEndTime = formatTimeFr(endDate);
  const formattedPrice = formatPriceFr(SAMPLE.price);
  const businessName = SAMPLE.providerName;

  const cancelUrl = `${APP_URL}/reservation/annuler/sample-cancel-token`;
  const reviewUrl = `${APP_URL}/avis/sample-booking-id`;
  const icsUrl = `${APP_URL}/api/calendar/sample-booking-id`;

  const eventTitle = encodeURIComponent(`RDV - ${SAMPLE.serviceName} chez ${businessName}`);
  const eventLocation = encodeURIComponent(SAMPLE.locationAddress);
  const eventDescription = encodeURIComponent(`Avec ${SAMPLE.memberName}\n\nPour annuler : ${cancelUrl}`);
  const eventDates = `${formatGoogleDate(datetime)}/${formatGoogleDate(endDate)}`;
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

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
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${SAMPLE.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Votre rendez-vous a bien été <strong style="color: #16a34a;">confirmé</strong>.</p>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Votre rendez-vous</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Durée</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.duration} min</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.locationName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${SAMPLE.locationAddress}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.memberName}</td></tr>
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedPrice}</td></tr>
                    </table>
                  </div>
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">Ajouter à votre calendrier</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Google</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${icsUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Apple / Outlook</a></td>
                      </tr>
                    </table>
                  </div>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">Annuler le rendez-vous</a></td></tr></table>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${APP_URL}/p/${SAMPLE.providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Reprendre rendez-vous</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>${businessName}</strong></p>
                  <p style="margin: 16px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">Après votre rendez-vous, <a href="${reviewUrl}" style="color: #6366f1; text-decoration: underline;">donnez-nous votre avis</a></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateCancellationHtml(): string {
  const datetime = getNextMonday14h();
  const formattedDate = formatDateFr(datetime);
  const formattedTime = formatTimeFr(datetime);
  const businessName = SAMPLE.providerName;
  const rebookUrl = `${APP_URL}/p/${SAMPLE.providerSlug}`;

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
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${SAMPLE.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Nous vous informons que votre rendez-vous a été <strong style="color: #dc2626;">annulé</strong>.</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Rendez-vous annulé</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.locationName}</td></tr>
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a; vertical-align: top;">Motif</td><td style="padding: 8px 0 4px; font-size: 14px; color: #18181b;">Annulation à la demande du client</td></tr>
                    </table>
                  </div>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Si vous souhaitez reprendre un nouveau rendez-vous, n'hésitez pas à nous contacter ou à réserver en ligne.</p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${rebookUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Reprendre rendez-vous</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">Nous nous excusons pour la gêne occasionnée.<br><strong>${businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateRescheduleHtml(): string {
  const oldDatetime = getNextMonday14h();
  const newDatetime = new Date(oldDatetime.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days = Wednesday
  newDatetime.setHours(16, 0, 0, 0);
  const endDate = new Date(newDatetime.getTime() + SAMPLE.duration * 60 * 1000);

  const formattedOldDate = formatDateFr(oldDatetime);
  const formattedOldTime = formatTimeFr(oldDatetime);
  const formattedNewDate = formatDateFr(newDatetime);
  const formattedNewTime = formatTimeFr(newDatetime);
  const formattedNewEndTime = formatTimeFr(endDate);
  const formattedPrice = formatPriceFr(SAMPLE.price);
  const businessName = SAMPLE.providerName;

  const cancelUrl = `${APP_URL}/reservation/annuler/sample-cancel-token`;
  const icsUrl = `${APP_URL}/api/calendar/sample-booking-id`;

  const eventTitle = encodeURIComponent(`RDV - ${SAMPLE.serviceName} chez ${businessName}`);
  const eventLocation = encodeURIComponent(SAMPLE.locationAddress);
  const eventDescription = encodeURIComponent(`Avec ${SAMPLE.memberName}\n\nPour annuler : ${cancelUrl}`);
  const eventDates = `${formatGoogleDate(newDatetime)}/${formatGoogleDate(endDate)}`;
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

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
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${SAMPLE.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Votre rendez-vous a été <strong style="color: #2563eb;">modifié</strong>.</p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 16px; opacity: 0.8;">
                    <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Ancien créneau</p>
                    <p style="margin: 0; font-size: 14px; color: #71717a; text-decoration: line-through;"><span style="text-transform: capitalize;">${formattedOldDate}</span> à ${formattedOldTime}</p>
                  </div>
                  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Nouveau créneau</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedNewDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedNewTime} - ${formattedNewEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Durée</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.duration} min</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.locationName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${SAMPLE.locationAddress}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.memberName}</td></tr>
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedPrice}</td></tr>
                    </table>
                  </div>
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">Mettre à jour votre calendrier</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Google</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${icsUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Apple / Outlook</a></td>
                      </tr>
                    </table>
                  </div>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">Annuler le rendez-vous</a></td></tr></table>
                  <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${APP_URL}/p/${SAMPLE.providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Reprendre rendez-vous</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>${businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateReminderHtml(reminderType: '24h' | '2h'): string {
  const datetime = getNextMonday14h();
  const endDate = new Date(datetime.getTime() + SAMPLE.duration * 60 * 1000);
  const formattedDate = formatDateFr(datetime);
  const formattedTime = formatTimeFr(datetime);
  const formattedEndTime = formatTimeFr(endDate);
  const formattedPrice = formatPriceFr(SAMPLE.price);
  const businessName = SAMPLE.providerName;

  const timeLabel = reminderType === '24h' ? 'demain' : 'dans 2 heures';
  const cancelUrl = `${APP_URL}/reservation/annuler/sample-cancel-token`;
  const icsUrl = `${APP_URL}/api/calendar/sample-booking-id`;

  const eventTitle = encodeURIComponent(`RDV - ${SAMPLE.serviceName} chez ${businessName}`);
  const eventLocation = encodeURIComponent(SAMPLE.locationAddress);
  const eventDescription = encodeURIComponent(`Avec ${SAMPLE.memberName}\n\nPour annuler : ${cancelUrl}`);
  const eventDates = `${formatGoogleDate(datetime)}/${formatGoogleDate(endDate)}`;
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

  const introText = `Nous vous rappelons que votre rendez-vous a lieu <strong style="color: #2563eb;">${timeLabel}</strong>.`;

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
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${SAMPLE.clientName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${introText}</p>
                  <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">Rappel de rendez-vous</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.serviceName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Durée</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.duration} min</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.locationName}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td><td style="padding: 4px 0; font-size: 14px; color: #18181b;">${SAMPLE.locationAddress}</td></tr>
                      <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${SAMPLE.memberName}</td></tr>
                      <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedPrice}</td></tr>
                    </table>
                  </div>
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">Ajouter à votre calendrier</p>
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding-right: 6px; width: 50%;"><a href="${googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Google</a></td>
                        <td style="padding-left: 6px; width: 50%;"><a href="${icsUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">Apple / Outlook</a></td>
                      </tr>
                    </table>
                  </div>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">Annuler le rendez-vous</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>${businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateWelcomeHtml(planName: 'Pro' | 'Studio'): string {
  const isPro = planName === 'Pro';
  const themeColor = isPro ? '#3b82f6' : '#8b5cf6';
  const themeBg = isPro ? '#eff6ff' : '#f5f3ff';
  const themeBorder = isPro ? '#bfdbfe' : '#c4b5fd';
  const tierLabel = isPro ? 'Indépendant' : 'Équipe';
  const providerName = SAMPLE.providerName;

  const PLAN_FEATURES: Record<string, string[]> = {
    Pro: [
      'Réservations illimitées, 0% de commission',
      'Votre vitrine en ligne professionnelle',
      'Rappels automatiques email et push',
      'Agenda accessible partout, 24h/24',
      'Prêt en 5 minutes, sans formation',
    ],
    Studio: [
      'Jusqu\'à 5 agendas synchronisés',
      '0% de commission, même en équipe',
      'Assignation des prestations par membre',
      'Multi-lieux (jusqu\'à 5 adresses)',
      'Page publique d\'équipe professionnelle',
      'Tout le plan Pro inclus',
    ],
  };

  const features = PLAN_FEATURES[planName];
  const featuresHtml = features
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
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${providerName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Merci d'avoir choisi <strong>${APP_NAME}</strong> ! Votre abonnement <strong style="color: ${themeColor};">${planName}</strong> est désormais actif.</p>
                  <div style="background-color: ${themeBg}; border: 1px solid ${themeBorder}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: ${themeColor}; text-transform: uppercase; letter-spacing: 0.5px;">Votre plan</p>
                    <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #18181b;">${planName} <span style="font-size: 14px; font-weight: 400; color: #71717a;">&mdash; ${tierLabel}</span></p>
                    <table style="width: 100%; border-collapse: collapse;">
                      ${featuresHtml}
                    </table>
                  </div>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">Tout est prêt pour accueillir vos premiers clients. Configurez vos disponibilités, ajoutez vos prestations et partagez votre page de réservation.</p>
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${APP_URL}/pro/calendrier" style="display: inline-block; padding: 14px 32px; background-color: ${themeColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Accéder à mon espace</a></td></tr></table>
                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;"><a href="${APP_URL}/pro/parametres?tab=abonnement" style="color: ${themeColor}; text-decoration: underline;">Gérer mon abonnement</a></p>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À bientôt,<br><strong>L'équipe ${APP_NAME}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${APP_NAME}.<br>Si vous n'êtes pas concerné, veuillez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// Preview dispatcher
// ---------------------------------------------------------------------------

function generatePreview(type: string): string {
  switch (type) {
    case 'confirmation':
      return generateConfirmationHtml();
    case 'cancellation':
      return generateCancellationHtml();
    case 'reschedule':
      return generateRescheduleHtml();
    case 'reminder-24h':
      return generateReminderHtml('24h');
    case 'reminder-2h':
      return generateReminderHtml('2h');
    case 'welcome':
      return generateWelcomeHtml('Pro');
    case 'welcome-studio':
      return generateWelcomeHtml('Studio');
    default:
      return '<p>Type de mail inconnu</p>';
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const { action, type, email } = await request.json();

  if (action === 'preview') {
    const html = generatePreview(type);
    return NextResponse.json({ html });
  }

  if (action === 'send') {
    // Dynamic import so Resend isn't bundled unless needed
    const { Resend } = await import('resend');
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured' },
        { status: 500 },
      );
    }

    const resend = new Resend(resendApiKey);
    const html = generatePreview(type);

    const subjects: Record<string, string> = {
      confirmation: 'Confirmation de votre rendez-vous - Coupe Homme',
      cancellation: 'Annulation de votre rendez-vous - Coupe Homme',
      reschedule: 'Modification de votre rendez-vous - Coupe Homme',
      'reminder-24h': 'Rappel : votre rendez-vous demain - Coupe Homme',
      'reminder-2h': 'Rappel : votre rendez-vous dans 2 heures - Coupe Homme',
      welcome: 'Bienvenue chez Opatam \u2014 Plan Pro activé !',
      'welcome-studio': 'Bienvenue chez Opatam \u2014 Plan Studio activé !',
    };

    try {
      const { error } = await resend.emails.send({
        from: 'Opatam <noreply@kamerleontech.com>',
        to: email,
        subject: `[TEST] ${subjects[type] || 'Email de test'}`,
        html,
      });

      if (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
