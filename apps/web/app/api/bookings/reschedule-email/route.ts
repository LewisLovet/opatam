import { NextRequest, NextResponse } from 'next/server';
import {
  resend,
  emailConfig,
  appConfig,
  formatDateFr,
  formatTimeFr,
  formatPriceFr,
  isValidEmail,
} from '@/lib/resend';

interface RescheduleEmailRequest {
  clientEmail: string;
  clientName: string;
  serviceName: string;
  oldDatetime: string | Date;
  newDatetime: string | Date;
  duration: number;
  price: number;
  providerName?: string;
  providerSlug?: string;
  locationName?: string;
  locationAddress?: string;
  memberName?: string;
  cancelToken?: string;
  bookingId?: string;
}

export async function POST(request: NextRequest) {
  console.log('[RESCHEDULE-EMAIL] ========== START ==========');

  try {
    const body: RescheduleEmailRequest = await request.json();
    console.log('[RESCHEDULE-EMAIL] Request body received:', {
      clientEmail: body.clientEmail,
      clientName: body.clientName,
      serviceName: body.serviceName,
      oldDatetime: body.oldDatetime,
      newDatetime: body.newDatetime,
      bookingId: body.bookingId || 'NOT PROVIDED',
    });

    const {
      clientEmail,
      clientName,
      serviceName,
      oldDatetime,
      newDatetime,
      duration,
      price,
      providerName,
      providerSlug,
      locationName,
      locationAddress,
      memberName,
      cancelToken,
      bookingId,
    } = body;

    // Validate required fields
    if (!clientEmail || !clientName || !serviceName || !oldDatetime || !newDatetime) {
      console.log('[RESCHEDULE-EMAIL] ERROR: Missing required fields');
      return NextResponse.json(
        { message: 'Données manquantes' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(clientEmail)) {
      console.log('[RESCHEDULE-EMAIL] ERROR: Invalid email format');
      return NextResponse.json(
        { message: 'Email invalide' },
        { status: 400 }
      );
    }

    // Format old date
    const formattedOldDate = formatDateFr(oldDatetime);
    const formattedOldTime = formatTimeFr(oldDatetime);

    // Format new date
    const newDateObj = new Date(newDatetime);
    const formattedNewDate = formatDateFr(newDatetime);
    const formattedNewTime = formatTimeFr(newDatetime);

    // Calculate end time for new booking
    const newEndDate = new Date(newDateObj.getTime() + duration * 60 * 1000);
    const formattedNewEndTime = formatTimeFr(newEndDate);

    // Format price
    const formattedPrice = formatPriceFr(price);

    const businessName = providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = cancelToken ? `${appConfig.url}/reservation/annuler/${cancelToken}` : null;
    const icsUrl = bookingId ? `${appConfig.url}/api/calendar/${bookingId}` : null;

    console.log('[RESCHEDULE-EMAIL] Generated URLs:', {
      cancelUrl: cancelUrl || 'NONE (no cancelToken)',
      icsUrl: icsUrl || 'NONE (no bookingId)',
    });

    // Generate Google Calendar URL for new booking
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    const eventTitle = encodeURIComponent(`RDV - ${serviceName} chez ${businessName}`);
    const eventLocation = encodeURIComponent(locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${memberName ? `Avec ${memberName}` : `Chez ${businessName}`}${cancelUrl ? `\n\nPour annuler : ${cancelUrl}` : ''}`
    );
    const eventDates = `${formatGoogleDate(newDateObj)}/${formatGoogleDate(newEndDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // Generate ICS file content with cancel URL in description
    // RFC 5545 escaping: backslashes, commas, semicolons, and newlines
    const escapeIcs = (str: string) =>
      str
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');

    const icsDescriptionParts = [memberName ? `Avec ${memberName}` : `Chez ${businessName}`];
    if (cancelUrl) {
      icsDescriptionParts.push('');
      icsDescriptionParts.push(`Pour annuler : ${cancelUrl}`);
    }
    const icsDescription = escapeIcs(icsDescriptionParts.join('\n'));
    const icsSummary = escapeIcs(`RDV - ${serviceName} chez ${businessName}`);
    const icsLocation = escapeIcs(locationAddress || '');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Opatam//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${bookingId || Date.now()}@opatam.com`,
      `DTSTAMP:${formatGoogleDate(new Date())}`,
      `DTSTART:${formatGoogleDate(newDateObj)}`,
      `DTEND:${formatGoogleDate(newEndDate)}`,
      `SUMMARY:${icsSummary}`,
      `DESCRIPTION:${icsDescription}`,
      `LOCATION:${icsLocation}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const icsBuffer = Buffer.from(icsContent, 'utf-8');

    console.log('[RESCHEDULE-EMAIL] ICS file generated for new datetime');

    // Send email via Resend with ICS attachment
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: clientEmail,
      subject: `Modification de votre rendez-vous - ${serviceName}`,
      attachments: [
        {
          filename: 'rendez-vous.ics',
          content: icsBuffer,
          contentType: 'text/calendar; method=PUBLISH',
        },
      ],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Modification de votre rendez-vous</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 32px 32px 24px; text-align: center;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #18181b;">
                        ${appConfig.name}
                      </h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 0 32px 24px;">
                      <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                        Bonjour ${clientName},
                      </p>
                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                        Votre rendez-vous a été <strong style="color: #2563eb;">modifié</strong>.
                      </p>

                      <!-- Old booking details box (crossed out) -->
                      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 16px; opacity: 0.8;">
                        <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">
                          Ancien créneau
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #71717a; text-decoration: line-through;">
                          <span style="text-transform: capitalize;">${formattedOldDate}</span> à ${formattedOldTime}
                        </p>
                      </div>

                      <!-- New booking details box -->
                      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
                          Nouveau créneau
                        </p>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${serviceName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedNewDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedNewTime} - ${formattedNewEndTime}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Durée</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${duration} min</td>
                          </tr>
                          ${locationName ? `
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${locationName}</td>
                          </tr>
                          ` : ''}
                          ${locationAddress ? `
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Adresse</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b;">${locationAddress}</td>
                          </tr>
                          ` : ''}
                          ${memberName ? `
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Avec</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${memberName}</td>
                          </tr>
                          ` : ''}
                          <tr>
                            <td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Prix</td>
                            <td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedPrice}</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Add to Calendar Section -->
                      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">
                          Mettre à jour votre calendrier
                        </p>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding-right: 6px; width: 50%;">
                              <a href="${googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">
                                Google
                              </a>
                            </td>
                            <td style="padding-left: 6px; width: 50%;">
                              <a href="${icsUrl || googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 12px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">
                                Apple / Outlook
                              </a>
                            </td>
                          </tr>
                        </table>
                      </div>

                      <!-- Cancel Button -->
                      ${cancelUrl ? `
                      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
                        <tr>
                          <td align="center">
                            <a href="${cancelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #fef2f2; border: 1px solid #fecaca; color: #dc2626; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 8px;">
                              Annuler le rendez-vous
                            </a>
                          </td>
                        </tr>
                      </table>
                      ` : ''}

                      <!-- CTA Button -->
                      ${providerSlug ? `
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="${appConfig.url}/p/${providerSlug}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                              Reprendre rendez-vous
                            </a>
                          </td>
                        </tr>
                      </table>
                      ` : ''}
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                      <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                        À bientôt,<br>
                        <strong>${businessName}</strong>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer text -->
                <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                  Cet email a été envoyé automatiquement par ${appConfig.name}.<br>
                  Si vous n'êtes pas concerné, veuillez ignorer ce message.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
Bonjour ${clientName},

Votre rendez-vous a été modifié.

Ancien créneau : ${formattedOldDate} à ${formattedOldTime}

Nouveau créneau :
- Prestation : ${serviceName}
- Date : ${formattedNewDate}
- Heure : ${formattedNewTime} - ${formattedNewEndTime}
- Durée : ${duration} min
${locationName ? `- Lieu : ${locationName}` : ''}
${locationAddress ? `- Adresse : ${locationAddress}` : ''}
${memberName ? `- Avec : ${memberName}` : ''}
- Prix : ${formattedPrice}

Mettre à jour votre calendrier :
- Google Calendar : ${googleCalendarUrl}
${icsUrl ? `- Apple / Outlook : ${icsUrl}` : ''}

${cancelUrl ? `Annuler le rendez-vous : ${cancelUrl}` : ''}

À bientôt,
${businessName}
      `.trim(),
    });

    if (error) {
      console.error('[RESCHEDULE-EMAIL] ERROR from Resend:', error);
      return NextResponse.json(
        { message: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    console.log('[RESCHEDULE-EMAIL] SUCCESS - Email sent to:', clientEmail);
    console.log('[RESCHEDULE-EMAIL] ========== END ==========');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RESCHEDULE-EMAIL] EXCEPTION:', error);
    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
