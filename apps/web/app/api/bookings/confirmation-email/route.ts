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

interface ConfirmationEmailRequest {
  clientEmail: string;
  clientName: string;
  serviceName: string;
  datetime: string | Date;
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
  console.log('[CONFIRMATION-EMAIL] ========== START ==========');

  try {
    const body: ConfirmationEmailRequest = await request.json();
    console.log('[CONFIRMATION-EMAIL] Request body received:', {
      clientEmail: body.clientEmail,
      clientName: body.clientName,
      serviceName: body.serviceName,
      datetime: body.datetime,
      bookingId: body.bookingId || 'NOT PROVIDED',
      cancelToken: body.cancelToken ? 'PROVIDED' : 'NOT PROVIDED',
      providerSlug: body.providerSlug || 'NOT PROVIDED',
    });

    const {
      clientEmail,
      clientName,
      serviceName,
      datetime,
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
    if (!clientEmail || !clientName || !serviceName || !datetime) {
      console.log('[CONFIRMATION-EMAIL] ERROR: Missing required fields');
      return NextResponse.json(
        { message: 'Données manquantes' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(clientEmail)) {
      console.log('[CONFIRMATION-EMAIL] ERROR: Invalid email format');
      return NextResponse.json(
        { message: 'Email invalide' },
        { status: 400 }
      );
    }

    // Format date
    const dateObj = new Date(datetime);
    const formattedDate = formatDateFr(datetime);
    const formattedTime = formatTimeFr(datetime);

    // Calculate end time
    const endDate = new Date(dateObj.getTime() + duration * 60 * 1000);
    const formattedEndTime = formatTimeFr(endDate);

    // Format price
    const formattedPrice = formatPriceFr(price);

    const businessName = providerName || appConfig.name;

    // Generate URLs
    const cancelUrl = cancelToken ? `${appConfig.url}/reservation/annuler/${cancelToken}` : null;
    const reviewUrl = bookingId ? `${appConfig.url}/avis/${bookingId}` : null;
    const icsUrl = bookingId ? `${appConfig.url}/api/calendar/${bookingId}` : null;

    console.log('[CONFIRMATION-EMAIL] Generated URLs:', {
      cancelUrl: cancelUrl || 'NONE (no cancelToken)',
      reviewUrl: reviewUrl || 'NONE (no bookingId)',
      icsUrl: icsUrl || 'NONE (no bookingId)',
      appConfigUrl: appConfig.url,
    });

    // Generate Google Calendar URL
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    const eventTitle = encodeURIComponent(`RDV - ${serviceName} chez ${businessName}`);
    const eventLocation = encodeURIComponent(locationAddress || '');
    const eventDescription = encodeURIComponent(
      `${memberName ? `Avec ${memberName}` : `Chez ${businessName}`}${cancelUrl ? `\n\nPour annuler : ${cancelUrl}` : ''}`
    );
    const eventDates = `${formatGoogleDate(dateObj)}/${formatGoogleDate(endDate)}`;
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
      `DTSTART:${formatGoogleDate(dateObj)}`,
      `DTEND:${formatGoogleDate(endDate)}`,
      `SUMMARY:${icsSummary}`,
      `DESCRIPTION:${icsDescription}`,
      `LOCATION:${icsLocation}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const icsBuffer = Buffer.from(icsContent, 'utf-8');

    console.log('[CONFIRMATION-EMAIL] ICS file generated:', {
      icsDescription,
      icsLocation,
      hasAttachment: true,
    });

    // Send email via Resend with ICS attachment
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: clientEmail,
      subject: `Confirmation de votre rendez-vous - ${serviceName}`,
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
          <title>Confirmation de votre rendez-vous</title>
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
                        Votre rendez-vous a bien été <strong style="color: #16a34a;">confirmé</strong>.
                      </p>

                      <!-- Booking details box -->
                      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
                          Votre rendez-vous
                        </p>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${serviceName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td>
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
                          <tr>
                            <td></td>
                            <td style="padding: 2px 0 4px;">
                              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationAddress)}" target="_blank" style="display: inline-block; padding: 5px 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 500; color: #2563eb;">
                                &#x1F4CD; Voir l&#39;itin&#233;raire
                              </a>
                            </td>
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
                          Ajouter à votre calendrier
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
                      ${reviewUrl ? `
                      <p style="margin: 16px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">
                        Après votre rendez-vous, <a href="${reviewUrl}" style="color: #6366f1; text-decoration: underline;">donnez-nous votre avis</a>
                      </p>
                      ` : ''}
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

Votre rendez-vous a bien été confirmé.

Détails de votre rendez-vous :
- Prestation : ${serviceName}
- Date : ${formattedDate}
- Heure : ${formattedTime} - ${formattedEndTime}
- Durée : ${duration} min
${locationName ? `- Lieu : ${locationName}` : ''}
${locationAddress ? `- Adresse : ${locationAddress}\n- Itinéraire : https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationAddress)}` : ''}
${memberName ? `- Avec : ${memberName}` : ''}
- Prix : ${formattedPrice}

Ajouter à votre calendrier :
- Google Calendar : ${googleCalendarUrl}
${icsUrl ? `- Apple / Outlook : ${icsUrl}` : ''}

${cancelUrl ? `Annuler le rendez-vous : ${cancelUrl}` : ''}

${reviewUrl ? `Après votre rendez-vous, donnez-nous votre avis : ${reviewUrl}` : ''}

À bientôt,
${businessName}
      `.trim(),
    });

    if (error) {
      console.error('[CONFIRMATION-EMAIL] ERROR from Resend:', error);
      return NextResponse.json(
        { message: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    console.log('[CONFIRMATION-EMAIL] SUCCESS - Email sent to:', clientEmail);
    console.log('[CONFIRMATION-EMAIL] ========== END ==========');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CONFIRMATION-EMAIL] EXCEPTION:', error);
    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
