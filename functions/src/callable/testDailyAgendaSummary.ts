/**
 * Callable: testDailyAgendaSummary
 *
 * Wrapper callable to manually trigger the daily agenda summary.
 * For testing purposes only — the real function runs on schedule at 20:00.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';
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

interface AgendaSummaryResult {
  success: boolean;
  date: string;
  providersProcessed: number;
  emailsSent: number;
  errors: number;
  details: Array<{
    businessName: string;
    bookingsCount: number;
    providerEmailSent: boolean;
    memberEmails: Array<{ name: string; bookingsCount: number; sent: boolean }>;
  }>;
  executionTimeMs: number;
  message: string;
}

export const testDailyAgendaSummary = onCall(
  { timeoutSeconds: 300 },
  async (request: CallableRequest<{ providerId?: string }>): Promise<AgendaSummaryResult> => {
    if (!request.auth) {
      throw new Error('Authentification requise');
    }

    const targetProviderId = request.data?.providerId?.trim() || null;

    const startTime = Date.now();
    serverTracker.startContext('testDailyAgendaSummary');
    console.log(`=== testDailyAgendaSummary started ${targetProviderId ? `for provider ${targetProviderId}` : '(all providers)'} ===`);

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

    const details: AgendaSummaryResult['details'] = [];
    let emailsSent = 0;
    let providersProcessed = 0;
    let errors = 0;

    try {
      let providerDocs: FirebaseFirestore.QueryDocumentSnapshot[];

      if (targetProviderId) {
        // Single provider mode
        const providerDoc = await db.collection('providers').doc(targetProviderId).get();
        serverTracker.trackRead('providers', 1);
        if (!providerDoc.exists) {
          serverTracker.endContext();
          return {
            success: false,
            date: formattedTomorrow,
            providersProcessed: 0,
            emailsSent: 0,
            errors: 1,
            details: [],
            executionTimeMs: Date.now() - startTime,
            message: `Provider ${targetProviderId} non trouvé`,
          };
        }
        providerDocs = [providerDoc as unknown as FirebaseFirestore.QueryDocumentSnapshot];
      } else {
        // All published providers
        const providersSnapshot = await db
          .collection('providers')
          .where('isPublished', '==', true)
          .get();
        serverTracker.trackRead('providers', providersSnapshot.size);
        providerDocs = providersSnapshot.docs;
      }

      for (const providerDoc of providerDocs) {
        const providerId = providerDoc.id;
        const providerData = providerDoc.data();
        const businessName = providerData.businessName || 'Mon entreprise';

        const detail: AgendaSummaryResult['details'][0] = {
          businessName,
          bookingsCount: 0,
          providerEmailSent: false,
          memberEmails: [],
        };

        try {
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
            details.push(detail);
            continue;
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

          detail.bookingsCount = bookings.length;

          // Send to provider
          const userDoc = await db.collection('users').doc(providerId).get();
          serverTracker.trackRead('users', 1);
          const providerEmail = userDoc.data()?.email;

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
              detail.providerEmailSent = true;
              emailsSent++;
            }
          }

          // Send to members
          const membersSnapshot = await db
            .collection('providers')
            .doc(providerId)
            .collection('members')
            .where('isActive', '==', true)
            .get();
          serverTracker.trackRead('providers/*/members', membersSnapshot.size);

          for (const memberDoc of membersSnapshot.docs) {
            // Only send member emails if there are multiple members
            if (membersSnapshot.size <= 1) break;

            const member = memberDoc.data();
            const memberId = memberDoc.id;

            if (!member.email || !isValidEmail(member.email)) continue;

            const memberBookings = bookings.filter(b => b.memberId === memberId);
            if (memberBookings.length === 0) {
              detail.memberEmails.push({ name: member.name, bookingsCount: 0, sent: false });
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
              detail.memberEmails.push({ name: member.name, bookingsCount: memberBookings.length, sent: false });
              errors++;
            } else {
              detail.memberEmails.push({ name: member.name, bookingsCount: memberBookings.length, sent: true });
              emailsSent++;
            }
          }

          providersProcessed++;
          details.push(detail);
        } catch (err) {
          console.error(`[${businessName}] Error:`, err);
          errors++;
          details.push(detail);
        }
      }

      const executionTimeMs = Date.now() - startTime;
      serverTracker.endContext();

      return {
        success: true,
        date: formattedTomorrow,
        providersProcessed,
        emailsSent,
        errors,
        details,
        executionTimeMs,
        message: `${providersProcessed} providers traités, ${emailsSent} emails envoyés, ${errors} erreurs`,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      serverTracker.endContext();

      return {
        success: false,
        date: formattedTomorrow,
        providersProcessed: 0,
        emailsSent: 0,
        errors: 1,
        details: [],
        executionTimeMs,
        message: `Erreur: ${errorMessage}`,
      };
    }
  }
);

// ─── Templates (same as scheduled version) ───────────────────────────────────

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
                      <tbody>${bookingRows}</tbody>
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
                      <tbody>${bookingRows}</tbody>
                    </table>
                  </div>
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
