import { NextRequest, NextResponse } from 'next/server';
import {
  resend,
  emailConfig,
  appConfig,
  formatDateFr,
  formatTimeFr,
  isValidEmail,
} from '@/lib/resend';

interface CancelEmailRequest {
  bookingId: string;
  clientEmail: string;
  clientName: string;
  serviceName: string;
  datetime: string | Date;
  reason?: string;
  providerName?: string;
  providerSlug?: string;
  locationName?: string;
}

export async function POST(request: NextRequest) {
  console.log('[CANCEL-EMAIL] ========== START ==========');

  try {
    const body: CancelEmailRequest = await request.json();
    console.log('[CANCEL-EMAIL] Request body received:', {
      bookingId: body.bookingId,
      clientEmail: body.clientEmail,
      clientName: body.clientName,
      serviceName: body.serviceName,
      reason: body.reason || 'NOT PROVIDED',
    });

    const { clientEmail, clientName, serviceName, datetime, reason, providerName, providerSlug, locationName } = body;

    // Validate required fields
    if (!clientEmail || !clientName || !serviceName || !datetime) {
      console.log('[CANCEL-EMAIL] ERROR: Missing required fields');
      return NextResponse.json(
        { message: 'Donnees manquantes' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(clientEmail)) {
      console.log('[CANCEL-EMAIL] ERROR: Invalid email format');
      return NextResponse.json(
        { message: 'Email invalide' },
        { status: 400 }
      );
    }

    // Format date
    const formattedDate = formatDateFr(datetime);
    const formattedTime = formatTimeFr(datetime);

    const businessName = providerName || appConfig.name;
    const rebookUrl = providerSlug ? `${appConfig.url}/p/${providerSlug}` : appConfig.url;
    console.log('[CANCEL-EMAIL] Sending cancellation email to:', clientEmail);

    // Send email via Resend
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: clientEmail,
      subject: `Annulation de votre rendez-vous - ${serviceName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Annulation de votre rendez-vous</title>
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
                        Nous vous informons que votre rendez-vous a ete <strong style="color: #dc2626;">annule</strong>.
                      </p>

                      <!-- Booking details box -->
                      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                        <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">
                          Rendez-vous annule
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
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime}</td>
                          </tr>
                          ${locationName ? `
                          <tr>
                            <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Lieu</td>
                            <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${locationName}</td>
                          </tr>
                          ` : ''}
                          ${reason ? `
                          <tr>
                            <td style="padding: 8px 0 4px; font-size: 14px; color: #71717a; vertical-align: top;">Motif</td>
                            <td style="padding: 8px 0 4px; font-size: 14px; color: #18181b;">${reason}</td>
                          </tr>
                          ` : ''}
                        </table>
                      </div>

                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                        Si vous souhaitez reprendre un nouveau rendez-vous, n'hesitez pas a nous contacter ou a reserver en ligne.
                      </p>

                      <!-- CTA Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="${rebookUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                              Reprendre rendez-vous
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                      <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
                        Nous nous excusons pour la gene occasionnee.<br>
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

Nous vous informons que votre rendez-vous a ete annule.

Details du rendez-vous annule :
- Prestation : ${serviceName}
- Date : ${formattedDate}
- Heure : ${formattedTime}
${locationName ? `- Lieu : ${locationName}` : ''}
${reason ? `- Motif : ${reason}` : ''}

Si vous souhaitez reprendre un nouveau rendez-vous, n'hesitez pas a nous contacter ou a reserver en ligne sur ${rebookUrl}

Nous nous excusons pour la gene occasionnee.

${businessName}
      `.trim(),
    });

    if (error) {
      console.error('[CANCEL-EMAIL] ERROR from Resend:', error);
      return NextResponse.json(
        { message: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    console.log('[CANCEL-EMAIL] SUCCESS - Cancellation email sent to:', clientEmail);
    console.log('[CANCEL-EMAIL] ========== END ==========');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CANCEL-EMAIL] EXCEPTION:', error);
    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
