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
}

export async function POST(request: NextRequest) {
  try {
    const body: ConfirmationEmailRequest = await request.json();

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
    } = body;

    // Validate required fields
    if (!clientEmail || !clientName || !serviceName || !datetime) {
      return NextResponse.json(
        { message: 'Donnees manquantes' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(clientEmail)) {
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

    // Generate Google Calendar URL
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };
    const eventTitle = encodeURIComponent(`RDV - ${serviceName} chez ${businessName}`);
    const eventLocation = encodeURIComponent(locationAddress || '');
    const eventDescription = encodeURIComponent(memberName ? `Avec ${memberName}` : `Chez ${businessName}`);
    const eventDates = `${formatGoogleDate(dateObj)}/${formatGoogleDate(endDate)}`;
    const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${eventDates}&location=${eventLocation}&details=${eventDescription}`;

    // Generate ICS file URL (base64 encoded)
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BookingApp//FR
BEGIN:VEVENT
DTSTAMP:${formatGoogleDate(new Date())}
DTSTART:${formatGoogleDate(dateObj)}
DTEND:${formatGoogleDate(endDate)}
SUMMARY:RDV - ${serviceName} chez ${businessName}
DESCRIPTION:${memberName ? `Avec ${memberName}` : `Chez ${businessName}`}
LOCATION:${locationAddress || ''}
END:VEVENT
END:VCALENDAR`;
    const icsBase64 = Buffer.from(icsContent).toString('base64');
    const icsDataUrl = `data:text/calendar;base64,${icsBase64}`;

    // Send email via Resend
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: clientEmail,
      subject: `Confirmation de votre rendez-vous - ${serviceName}`,
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
                        Votre rendez-vous a bien ete <strong style="color: #16a34a;">confirme</strong>.
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
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Duree</td>
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

                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                        Nous vous attendons avec impatience. Si vous avez besoin de modifier ou annuler votre rendez-vous, veuillez nous contacter.
                      </p>

                      <!-- Add to Calendar Section -->
                      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #3f3f46;">
                          Ajouter a votre calendrier
                        </p>
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding-right: 8px; width: 50%;">
                              <a href="${googleCalendarUrl}" target="_blank" style="display: block; padding: 10px 16px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">
                                Google Calendar
                              </a>
                            </td>
                            <td style="padding-left: 8px; width: 50%;">
                              <a href="${icsDataUrl}" download="rendez-vous.ics" style="display: block; padding: 10px 16px; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; text-decoration: none; text-align: center; font-size: 13px; font-weight: 500; color: #3f3f46;">
                                Apple / Outlook
                              </a>
                            </td>
                          </tr>
                        </table>
                      </div>

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
                        A bientot,<br>
                        <strong>${businessName}</strong>
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Footer text -->
                <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                  Cet email a ete envoye automatiquement par ${appConfig.name}.<br>
                  Si vous n'etes pas concerne, veuillez ignorer ce message.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      text: `
Bonjour ${clientName},

Votre rendez-vous a bien ete confirme.

Details de votre rendez-vous :
- Prestation : ${serviceName}
- Date : ${formattedDate}
- Heure : ${formattedTime} - ${formattedEndTime}
- Duree : ${duration} min
${locationName ? `- Lieu : ${locationName}` : ''}
${locationAddress ? `- Adresse : ${locationAddress}` : ''}
${memberName ? `- Avec : ${memberName}` : ''}
- Prix : ${formattedPrice}

Ajouter a votre calendrier :
- Google Calendar : ${googleCalendarUrl}

Nous vous attendons avec impatience. Si vous avez besoin de modifier ou annuler votre rendez-vous, veuillez nous contacter.

A bientot,
${businessName}
      `.trim(),
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { message: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send confirmation email error:', error);
    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
