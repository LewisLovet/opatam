import { NextRequest, NextResponse } from 'next/server';
import {
  resend,
  emailConfig,
  appConfig,
  formatDateFr,
  formatTimeFr,
  formatPriceFr,
  isValidEmail,
  getEmailWrapperHtml,
} from '@/lib/resend';
import { getAdminFirestore } from '@/lib/firebase-admin';

interface ProviderNotificationRequest {
  providerId: string;
  clientName: string;
  clientPhone?: string;
  serviceName: string;
  datetime: string | Date;
  duration: number;
  price: number;
  locationName?: string;
  locationAddress?: string;
  memberName?: string;
  bookingId?: string;
  type: 'confirmation' | 'cancellation';
  cancelledBy?: 'client' | 'provider';
  cancelReason?: string;
}

async function getProviderEmail(providerId: string): Promise<string | null> {
  const db = getAdminFirestore();
  const providerDoc = await db.collection('providers').doc(providerId).get();
  if (!providerDoc.exists) return null;

  const userId = providerDoc.data()?.userId;
  if (!userId) return null;

  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;

  return userDoc.data()?.email || null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ProviderNotificationRequest = await request.json();
    const {
      providerId,
      clientName,
      clientPhone,
      serviceName,
      datetime,
      duration,
      price,
      locationName,
      locationAddress,
      memberName,
      type,
      cancelledBy,
      cancelReason,
    } = body;

    if (!providerId || !clientName || !serviceName || !datetime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch provider email from Firestore
    const providerEmail = await getProviderEmail(providerId);
    if (!providerEmail || !isValidEmail(providerEmail)) {
      console.log('[PROVIDER-NOTIF] No valid provider email found for:', providerId);
      return NextResponse.json({ error: 'Provider email not found' }, { status: 404 });
    }

    const formattedDate = formatDateFr(datetime);
    const formattedTime = formatTimeFr(datetime);
    const endDate = new Date(new Date(datetime).getTime() + duration * 60 * 1000);
    const formattedEndTime = formatTimeFr(endDate);
    const formattedPrice = formatPriceFr(price);
    const calendarUrl = `${appConfig.url}/pro/calendrier`;

    if (type === 'confirmation') {
      // New booking notification
      const html = getEmailWrapperHtml(`
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
              Bonjour,
            </p>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
              Un nouveau rendez-vous vient d'être <strong style="color: #16a34a;">confirmé</strong>.
            </p>

            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
                Nouveau rendez-vous
              </p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Client</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${clientName}</td>
                </tr>
                ${clientPhone ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Téléphone</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b;">${clientPhone}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Prestation</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${serviceName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Horaire</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td>
                </tr>
                ${locationName ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${locationName}</td>
                </tr>
                ` : ''}
                ${memberName ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Membre</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${memberName}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Prix</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedPrice}</td>
                </tr>
              </table>
            </div>

            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center">
                  <a href="${calendarUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                    Voir mon calendrier
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
            <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
              À bientôt,<br>
              <strong>L'équipe ${appConfig.name}</strong>
            </p>
          </td>
        </tr>
      `);

      const text = `
Bonjour,

Un nouveau rendez-vous vient d'être confirmé.

Détails :
- Client : ${clientName}
${clientPhone ? `- Téléphone : ${clientPhone}` : ''}
- Prestation : ${serviceName}
- Date : ${formattedDate}
- Horaire : ${formattedTime} - ${formattedEndTime}
${locationName ? `- Lieu : ${locationName}` : ''}
${memberName ? `- Membre : ${memberName}` : ''}
- Prix : ${formattedPrice}

Voir mon calendrier : ${calendarUrl}

À bientôt,
L'équipe ${appConfig.name}
      `.trim();

      const { error } = await resend.emails.send({
        from: emailConfig.from,
        to: providerEmail,
        replyTo: emailConfig.replyTo,
        subject: `Nouveau rendez-vous - ${clientName} - ${serviceName}`,
        html,
        text,
      });

      if (error) {
        console.error('[PROVIDER-NOTIF] Resend error:', error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
      }
    } else if (type === 'cancellation') {
      // Cancellation notification
      const cancelledByLabel = cancelledBy === 'client' ? 'le client' : 'vous-même';

      const html = getEmailWrapperHtml(`
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
              Bonjour,
            </p>
            <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
              Un rendez-vous a été <strong style="color: #dc2626;">annulé</strong> par ${cancelledByLabel}.
            </p>

            <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">
                Rendez-vous annulé
              </p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Client</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${clientName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Prestation</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${serviceName}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Horaire</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime}</td>
                </tr>
                ${locationName ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td>
                  <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${locationName}</td>
                </tr>
                ` : ''}
                ${cancelReason ? `
                <tr>
                  <td style="padding: 8px 0 4px; font-size: 14px; color: #71717a; vertical-align: top;">Motif</td>
                  <td style="padding: 8px 0 4px; font-size: 14px; color: #18181b;">${cancelReason}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
              Ce créneau est de nouveau disponible pour d'autres réservations.
            </p>

            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center">
                  <a href="${calendarUrl}" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                    Voir mon calendrier
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
            <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
              À bientôt,<br>
              <strong>L'équipe ${appConfig.name}</strong>
            </p>
          </td>
        </tr>
      `);

      const text = `
Bonjour,

Un rendez-vous a été annulé par ${cancelledByLabel}.

Détails :
- Client : ${clientName}
- Prestation : ${serviceName}
- Date : ${formattedDate}
- Horaire : ${formattedTime}
${locationName ? `- Lieu : ${locationName}` : ''}
${cancelReason ? `- Motif : ${cancelReason}` : ''}

Ce créneau est de nouveau disponible pour d'autres réservations.

Voir mon calendrier : ${calendarUrl}

À bientôt,
L'équipe ${appConfig.name}
      `.trim();

      const { error } = await resend.emails.send({
        from: emailConfig.from,
        to: providerEmail,
        replyTo: emailConfig.replyTo,
        subject: `Rendez-vous annulé - ${clientName} - ${serviceName}`,
        html,
        text,
      });

      if (error) {
        console.error('[PROVIDER-NOTIF] Resend error:', error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[PROVIDER-NOTIF] Exception:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
