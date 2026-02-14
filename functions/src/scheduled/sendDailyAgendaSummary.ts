/**
 * Scheduled: sendDailyAgendaSummary
 *
 * Runs every day at 20:00 (Europe/Paris) to send a summary of tomorrow's agenda.
 * - Sends to the provider (main owner) a full summary of all bookings for tomorrow
 * - Sends to each active member their own bookings + their planning link & access code
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  emailConfig,
  appConfig,
  assets,
  formatDateFr,
  formatTimeFr,
  formatPriceFr,
  isValidEmail,
} from '../utils/resendService';
import { serverTracker } from '../utils/serverTracker';
import { Resend } from 'resend';
import { defineString } from 'firebase-functions/params';

const resendApiKey = defineString('RESEND_API_KEY');

let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(resendApiKey.value());
  }
  return resendInstance;
}

const BATCH_SIZE = 10;

interface BookingRow {
  clientName: string;
  serviceName: string;
  datetime: Date;
  duration: number;
  price: number;
  locationName?: string;
  memberName?: string;
  memberId?: string;
}

export const sendDailyAgendaSummary = onSchedule(
  {
    schedule: 'every day 20:00',
    timeZone: 'Europe/Paris',
    timeoutSeconds: 300,
  },
  async () => {
    const startTime = Date.now();
    serverTracker.startContext('sendDailyAgendaSummary');
    console.log('=== sendDailyAgendaSummary started ===');

    const db = admin.firestore();

    // Calculate tomorrow's date range in Europe/Paris
    const nowParis = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const tomorrowStart = new Date(nowParis);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Convert back to UTC for Firestore query
    const offsetMs = nowParis.getTime() - new Date().getTime();
    const tomorrowStartUtc = new Date(tomorrowStart.getTime() - offsetMs);
    const tomorrowEndUtc = new Date(tomorrowEnd.getTime() - offsetMs);

    const formattedTomorrow = formatDateFr(tomorrowStartUtc);

    try {
      // 1. Get all published providers
      const providersSnapshot = await db
        .collection('providers')
        .where('isPublished', '==', true)
        .get();
      serverTracker.trackRead('providers', providersSnapshot.size);

      console.log(`Found ${providersSnapshot.size} published providers`);

      let emailsSent = 0;
      let providersProcessed = 0;
      let errors = 0;

      // 2. Process providers in batches
      const providerDocs = providersSnapshot.docs;
      for (let i = 0; i < providerDocs.length; i += BATCH_SIZE) {
        const batch = providerDocs.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (providerDoc) => {
          const providerId = providerDoc.id;
          const providerData = providerDoc.data();
          const businessName = providerData.businessName || 'Mon entreprise';

          try {
            // 3. Get tomorrow's bookings for this provider
            const bookingsSnapshot = await db
              .collection('bookings')
              .where('providerId', '==', providerId)
              .where('status', 'in', ['confirmed', 'pending'])
              .where('datetime', '>=', Timestamp.fromDate(tomorrowStartUtc))
              .where('datetime', '<=', Timestamp.fromDate(tomorrowEndUtc))
              .orderBy('datetime', 'asc')
              .get();
            serverTracker.trackRead('bookings', bookingsSnapshot.size);

            if (bookingsSnapshot.empty) {
              console.log(`[${businessName}] No bookings tomorrow, skipping`);
              return;
            }

            const bookings: BookingRow[] = bookingsSnapshot.docs.map(doc => {
              const d = doc.data();
              return {
                clientName: d.clientInfo?.name || 'Client',
                serviceName: d.serviceName,
                datetime: d.datetime.toDate(),
                duration: d.duration || 60,
                price: d.price || 0,
                locationName: d.locationName,
                memberName: d.memberName,
                memberId: d.memberId,
              };
            });

            console.log(`[${businessName}] ${bookings.length} bookings tomorrow`);

            // 4. Get provider email (Provider.id === User.id)
            const userDoc = await db.collection('users').doc(providerId).get();
            serverTracker.trackRead('users', 1);
            const providerEmail = userDoc.data()?.email;

            // 5. Send summary to provider
            if (providerEmail && isValidEmail(providerEmail)) {
              const calendarUrl = `${appConfig.url}/pro/calendrier`;
              const { error } = await getResend().emails.send({
                from: emailConfig.from,
                to: providerEmail,
                replyTo: emailConfig.replyTo,
                subject: `Agenda de demain - ${bookings.length} rendez-vous - ${formattedTomorrow}`,
                html: generateProviderSummaryHtml(businessName, bookings, formattedTomorrow, calendarUrl),
                text: generateProviderSummaryText(businessName, bookings, formattedTomorrow, calendarUrl),
              });

              if (error) {
                console.error(`[${businessName}] Provider email error:`, error);
                errors++;
              } else {
                console.log(`[${businessName}] Provider summary sent to ${providerEmail}`);
                emailsSent++;
              }
            }

            // 6. Get active members
            const membersSnapshot = await db
              .collection('providers')
              .doc(providerId)
              .collection('members')
              .where('isActive', '==', true)
              .get();
            serverTracker.trackRead('providers/*/members', membersSnapshot.size);

            // 7. Send to each member their own bookings (only if more than 1 member)
            if (membersSnapshot.size <= 1) {
              console.log(`[${businessName}] Solo provider (${membersSnapshot.size} member), skipping member emails`);
            }

            for (const memberDoc of membersSnapshot.docs) {
              // Only send member emails if there are multiple members
              if (membersSnapshot.size <= 1) break;

              const member = memberDoc.data();
              const memberId = memberDoc.id;

              // Skip members without email
              if (!member.email || !isValidEmail(member.email)) continue;

              // Filter bookings for this member
              const memberBookings = bookings.filter(b => b.memberId === memberId);

              if (memberBookings.length === 0) {
                console.log(`[${businessName}] No bookings for member ${member.name}, skipping`);
                continue;
              }

              const planningUrl = `${appConfig.url}/planning`;

              const { error } = await getResend().emails.send({
                from: emailConfig.from,
                to: member.email,
                replyTo: emailConfig.replyTo,
                subject: `Votre agenda de demain - ${memberBookings.length} rendez-vous - ${formattedTomorrow}`,
                html: generateMemberSummaryHtml(member.name, businessName, memberBookings, formattedTomorrow, planningUrl, member.accessCode),
                text: generateMemberSummaryText(member.name, businessName, memberBookings, formattedTomorrow, planningUrl, member.accessCode),
              });

              if (error) {
                console.error(`[${businessName}] Member ${member.name} email error:`, error);
                errors++;
              } else {
                console.log(`[${businessName}] Member summary sent to ${member.email}`);
                emailsSent++;
              }
            }

            providersProcessed++;
          } catch (err) {
            console.error(`[${businessName}] Error:`, err);
            errors++;
          }
        }));

        console.log(`Processed provider batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(providerDocs.length / BATCH_SIZE)}`);
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`=== sendDailyAgendaSummary completed in ${executionTimeMs}ms ===`);
      console.log(`Results: ${providersProcessed} providers, ${emailsSent} emails sent, ${errors} errors`);

      serverTracker.endContext();
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      console.error('Error in sendDailyAgendaSummary:', error);
      console.log(`Failed after ${executionTimeMs}ms`);

      serverTracker.endContext();
    }
  }
);

// ─── HTML Templates ──────────────────────────────────────────────────────────

function generateBookingRowHtml(booking: BookingRow): string {
  const time = formatTimeFr(booking.datetime);
  const endTime = formatTimeFr(new Date(booking.datetime.getTime() + booking.duration * 60 * 1000));
  const price = formatPriceFr(booking.price);

  return `
    <tr>
      <td style="padding: 10px 12px; font-size: 14px; color: #18181b; font-weight: 500; border-bottom: 1px solid #f4f4f5; white-space: nowrap;">${time} - ${endTime}</td>
      <td style="padding: 10px 12px; font-size: 14px; color: #18181b; border-bottom: 1px solid #f4f4f5;">${booking.clientName}</td>
      <td style="padding: 10px 12px; font-size: 14px; color: #3f3f46; border-bottom: 1px solid #f4f4f5;">${booking.serviceName}</td>
      <td style="padding: 10px 12px; font-size: 14px; color: #3f3f46; border-bottom: 1px solid #f4f4f5; text-align: right;">${price}</td>
    </tr>
  `;
}

function generateProviderSummaryHtml(
  businessName: string,
  bookings: BookingRow[],
  formattedDate: string,
  calendarUrl: string
): string {
  const totalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
  const totalDuration = bookings.reduce((sum, b) => sum + b.duration, 0);
  const bookingRows = bookings.map(generateBookingRowHtml).join('');

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
            <table role="presentation" style="max-width: 560px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour,</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                    Voici le récapitulatif de votre agenda pour <strong style="text-transform: capitalize;">${formattedDate}</strong>.
                  </p>

                  <!-- Stats -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <tr>
                      <td style="width: 33%; text-align: center; padding: 16px 8px; background-color: #f0fdf4; border-radius: 8px 0 0 8px;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #16a34a;">${bookings.length}</p>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">RDV</p>
                      </td>
                      <td style="width: 33%; text-align: center; padding: 16px 8px; background-color: #eff6ff;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #2563eb;">${Math.floor(totalDuration / 60)}h${(totalDuration % 60).toString().padStart(2, '0')}</p>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Durée</p>
                      </td>
                      <td style="width: 33%; text-align: center; padding: 16px 8px; background-color: #f5f3ff; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #7c3aed;">${formatPriceFr(totalRevenue)}</p>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">CA</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Bookings table -->
                  <div style="border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #fafafa;">
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Horaire</th>
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Client</th>
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Prestation</th>
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: right; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Prix</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${bookingRows}
                      </tbody>
                    </table>
                  </div>

                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center">
                        <a href="${calendarUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Voir mon calendrier</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">Bonne journée,<br><strong>L'équipe ${appConfig.name}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${appConfig.name}.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateProviderSummaryText(
  businessName: string,
  bookings: BookingRow[],
  formattedDate: string,
  calendarUrl: string
): string {
  const totalRevenue = bookings.reduce((sum, b) => sum + b.price, 0);
  const lines = bookings.map(b => {
    const time = formatTimeFr(b.datetime);
    const endTime = formatTimeFr(new Date(b.datetime.getTime() + b.duration * 60 * 1000));
    return `- ${time} - ${endTime} | ${b.clientName} | ${b.serviceName} | ${formatPriceFr(b.price)}`;
  });

  return `
Bonjour,

Voici le récapitulatif de votre agenda pour ${formattedDate}.

${bookings.length} rendez-vous | CA estimé : ${formatPriceFr(totalRevenue)}

${lines.join('\n')}

Voir mon calendrier : ${calendarUrl}

Bonne journée,
L'équipe ${appConfig.name}
  `.trim();
}

function generateMemberSummaryHtml(
  memberName: string,
  businessName: string,
  bookings: BookingRow[],
  formattedDate: string,
  planningUrl: string,
  accessCode: string
): string {
  const bookingRows = bookings.map(generateBookingRowHtml).join('');
  const totalDuration = bookings.reduce((sum, b) => sum + b.duration, 0);

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
            <table role="presentation" style="max-width: 560px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${assets.logos.email}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${memberName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                    Voici votre planning pour <strong style="text-transform: capitalize;">${formattedDate}</strong> chez <strong>${businessName}</strong>.
                  </p>

                  <!-- Stats -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                    <tr>
                      <td style="width: 50%; text-align: center; padding: 16px 8px; background-color: #f0fdf4; border-radius: 8px 0 0 8px;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #16a34a;">${bookings.length}</p>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">RDV</p>
                      </td>
                      <td style="width: 50%; text-align: center; padding: 16px 8px; background-color: #eff6ff; border-radius: 0 8px 8px 0;">
                        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #2563eb;">${Math.floor(totalDuration / 60)}h${(totalDuration % 60).toString().padStart(2, '0')}</p>
                        <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Durée</p>
                      </td>
                    </tr>
                  </table>

                  <!-- Bookings table -->
                  <div style="border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <thead>
                        <tr style="background-color: #fafafa;">
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Horaire</th>
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Client</th>
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Prestation</th>
                          <th style="padding: 10px 12px; font-size: 12px; color: #71717a; text-align: right; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Prix</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${bookingRows}
                      </tbody>
                    </table>
                  </div>

                  <!-- Access code box -->
                  <div style="background-color: #f5f3ff; border: 1px solid #c4b5fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #71717a;">Votre code d'accès au planning</p>
                    <p style="margin: 0; font-size: 20px; font-weight: 700; color: #7c3aed; letter-spacing: 1px;">${accessCode}</p>
                  </div>

                  <table role="presentation" style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td align="center">
                        <a href="${planningUrl}" style="display: inline-block; padding: 14px 32px; background-color: #7c3aed; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Voir mon planning</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">Bonne journée,<br><strong>${businessName}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé automatiquement par ${appConfig.name}.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function generateMemberSummaryText(
  memberName: string,
  businessName: string,
  bookings: BookingRow[],
  formattedDate: string,
  planningUrl: string,
  accessCode: string
): string {
  const lines = bookings.map(b => {
    const time = formatTimeFr(b.datetime);
    const endTime = formatTimeFr(new Date(b.datetime.getTime() + b.duration * 60 * 1000));
    return `- ${time} - ${endTime} | ${b.clientName} | ${b.serviceName}`;
  });

  return `
Bonjour ${memberName},

Voici votre planning pour ${formattedDate} chez ${businessName}.

${bookings.length} rendez-vous

${lines.join('\n')}

Votre code d'accès au planning : ${accessCode}
Voir mon planning : ${planningUrl}

Bonne journée,
${businessName}
  `.trim();
}
