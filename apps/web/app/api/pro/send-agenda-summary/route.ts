import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  resend,
  emailConfig,
  appConfig,
  formatDateFr,
  formatTimeFr,
  formatPriceFr,
  isValidEmail,
} from '@/lib/resend';

const EMAIL_LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

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

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error('[send-agenda-summary] RESEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Service email non configuré' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { providerId, memberId } = body;

    if (!providerId || typeof providerId !== 'string') {
      return NextResponse.json({ error: 'providerId requis' }, { status: 400 });
    }
    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'memberId requis' }, { status: 400 });
    }

    const db = getAdminFirestore();

    // Verify provider exists
    const providerDoc = await db.collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return NextResponse.json({ error: 'Provider non trouvé' }, { status: 404 });
    }

    const providerData = providerDoc.data()!;
    const businessName = providerData.businessName || 'Mon entreprise';

    // Fetch the target member
    const memberDoc = await db
      .collection('providers')
      .doc(providerId)
      .collection('members')
      .doc(memberId)
      .get();

    if (!memberDoc.exists) {
      return NextResponse.json({ error: 'Membre non trouvé' }, { status: 404 });
    }

    const member = memberDoc.data()!;

    if (!member.email || !isValidEmail(member.email)) {
      return NextResponse.json(
        { error: `${member.name} n'a pas d'adresse email valide` },
        { status: 400 }
      );
    }

    // Calculate tomorrow's date range in Europe/Paris
    const nowParis = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' })
    );
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

    // Query bookings for tomorrow (same index as scheduled CF: providerId + status + datetime)
    // Filter by memberId in memory to avoid needing an extra composite index
    const bookingsSnapshot = await db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('status', 'in', ['confirmed', 'pending'])
      .where('datetime', '>=', Timestamp.fromDate(tomorrowStartUtc))
      .where('datetime', '<=', Timestamp.fromDate(tomorrowEndUtc))
      .orderBy('datetime', 'asc')
      .get();

    const bookings: BookingRow[] = bookingsSnapshot.docs
      .filter((doc) => doc.data().memberId === memberId)
      .map((doc) => {
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

    // Send member email
    const planningUrl = `${appConfig.url}/planning`;
    const accessCode = member.accessCode || '—';

    console.log(`[send-agenda-summary] Sending to ${member.name} (${member.email}), ${bookings.length} bookings`);

    const html = generateMemberSummaryHtml(
      member.name,
      businessName,
      bookings,
      formattedTomorrow,
      planningUrl,
      accessCode
    );
    const text = generateMemberSummaryText(
      member.name,
      businessName,
      bookings,
      formattedTomorrow,
      planningUrl,
      accessCode
    );

    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: member.email,
      replyTo: emailConfig.replyTo,
      subject: bookings.length > 0
        ? `Votre agenda de demain - ${bookings.length} rendez-vous - ${formattedTomorrow}`
        : `Votre agenda de demain - ${formattedTomorrow}`,
      html,
      text,
    });

    if (error) {
      console.error(`[send-agenda-summary] Email error for ${member.name}:`, error);
      return NextResponse.json(
        { error: `Erreur d'envoi à ${member.name}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      date: formattedTomorrow,
      bookingsCount: bookings.length,
      emailsSent: 1,
      message: `Récap envoyé à ${member.name}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[send-agenda-summary] Error:', message, error);
    return NextResponse.json(
      { error: message || 'Erreur lors de l\'envoi du récapitulatif' },
      { status: 500 }
    );
  }
}

// ─── Email Templates ─────────────────────────────────────────────────────────

function generateBookingRowHtml(booking: BookingRow): string {
  const time = formatTimeFr(booking.datetime);
  const endTime = formatTimeFr(
    new Date(booking.datetime.getTime() + booking.duration * 60 * 1000)
  );
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
  const hasBookings = bookings.length > 0;

  const bookingsSection = hasBookings
    ? `
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
                  </div>`
    : `
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; margin-bottom: 24px; text-align: center;">
                    <p style="margin: 0; font-size: 16px; color: #71717a;">Aucun rendez-vous prévu demain</p>
                  </div>`;

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
                  <img src="${EMAIL_LOGO_URL}" alt="${appConfig.name}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${memberName},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                    Voici votre planning pour <strong style="text-transform: capitalize;">${formattedDate}</strong> chez <strong>${businessName}</strong>.
                  </p>
                  ${bookingsSection}
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
  const bookingsText = bookings.length > 0
    ? `${bookings.length} rendez-vous\n\n${bookings.map((b) => {
        const time = formatTimeFr(b.datetime);
        const endTime = formatTimeFr(
          new Date(b.datetime.getTime() + b.duration * 60 * 1000)
        );
        return `- ${time} - ${endTime} | ${b.clientName} | ${b.serviceName}`;
      }).join('\n')}`
    : 'Aucun rendez-vous prévu demain.';

  return `
Bonjour ${memberName},

Voici votre planning pour ${formattedDate} chez ${businessName}.

${bookingsText}

Votre code d'accès au planning : ${accessCode}
Voir mon planning : ${planningUrl}

Bonne journée,
${businessName}
  `.trim();
}
