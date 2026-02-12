import { NextRequest, NextResponse } from 'next/server';
import { bookingRepository } from '@booking-app/firebase';
import {
  resend,
  emailConfig,
  appConfig,
  formatDateFr,
  formatTimeFr,
  isValidEmail,
  getEmailWrapperHtml,
  getEmailFooterHtml,
} from '@/lib/resend';

interface ReviewRequestEmailRequest {
  bookingId: string;
}

export async function POST(request: NextRequest) {
  console.log('[REVIEW-REQUEST-EMAIL] ========== START ==========');

  try {
    const body: ReviewRequestEmailRequest = await request.json();
    const { bookingId } = body;

    console.log('[REVIEW-REQUEST-EMAIL] Request for bookingId:', bookingId);

    if (!bookingId) {
      console.log('[REVIEW-REQUEST-EMAIL] ERROR: Missing bookingId');
      return NextResponse.json(
        { error: 'L\'identifiant de la réservation est requis' },
        { status: 400 }
      );
    }

    // Get the booking
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      console.log('[REVIEW-REQUEST-EMAIL] ERROR: Booking not found');
      return NextResponse.json(
        { error: 'Réservation non trouvée' },
        { status: 404 }
      );
    }

    console.log('[REVIEW-REQUEST-EMAIL] Booking found:', {
      id: booking.id,
      status: booking.status,
      datetime: booking.datetime,
      reviewRequestSentAt: booking.reviewRequestSentAt || 'NOT SENT',
    });

    // Verify booking is past
    if (booking.datetime > new Date()) {
      console.log('[REVIEW-REQUEST-EMAIL] ERROR: Booking is in the future');
      return NextResponse.json(
        { error: 'Le rendez-vous n\'est pas encore passé' },
        { status: 400 }
      );
    }

    // Verify booking is confirmed
    if (booking.status !== 'confirmed') {
      console.log('[REVIEW-REQUEST-EMAIL] ERROR: Booking is not confirmed');
      return NextResponse.json(
        { error: 'Impossible de demander un avis pour cette réservation' },
        { status: 400 }
      );
    }

    // Verify review request not already sent
    if (booking.reviewRequestSentAt) {
      console.log('[REVIEW-REQUEST-EMAIL] ERROR: Review request already sent');
      return NextResponse.json(
        { error: 'La demande d\'avis a déjà été envoyée' },
        { status: 400 }
      );
    }

    // Validate email
    if (!isValidEmail(booking.clientInfo.email)) {
      console.log('[REVIEW-REQUEST-EMAIL] ERROR: Invalid client email');
      return NextResponse.json(
        { error: 'Email du client invalide' },
        { status: 400 }
      );
    }

    // Build review URL
    const reviewUrl = `${appConfig.url}/avis/${bookingId}`;

    // Format date and time
    const formattedDate = formatDateFr(booking.datetime);
    const formattedTime = formatTimeFr(booking.datetime);

    console.log('[REVIEW-REQUEST-EMAIL] Sending email to:', booking.clientInfo.email);
    console.log('[REVIEW-REQUEST-EMAIL] Review URL:', reviewUrl);

    // Build email content
    const emailContent = `
      <!-- Content -->
      <tr>
        <td style="padding: 0 32px 24px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
            Bonjour ${booking.clientInfo.name},
          </p>
          <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
            Nous espérons que votre rendez-vous s'est bien passé. Votre avis nous aide à améliorer nos services !
          </p>

          <!-- Booking details box -->
          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #6366f1; text-transform: uppercase; letter-spacing: 0.5px;">
              Votre rendez-vous
            </p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td>
                <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${booking.serviceName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td>
                <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td>
                <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Chez</td>
                <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${booking.providerName}</td>
              </tr>
            </table>
          </div>

          <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
            Prenez quelques secondes pour partager votre expérience. Votre commentaire aidera d'autres clients et permettra au prestataire de s'améliorer.
          </p>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center">
                <a href="${reviewUrl}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                  Donner mon avis
                </a>
              </td>
            </tr>
          </table>

          <p style="margin: 24px 0 0; font-size: 13px; color: #a1a1aa; text-align: center;">
            Votre avis sera visible sur la page du prestataire.
          </p>
        </td>
      </tr>
      ${getEmailFooterHtml(booking.providerName)}
    `;

    // Send email
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: booking.clientInfo.email,
      subject: `Donnez votre avis sur votre rendez-vous - ${booking.serviceName}`,
      html: getEmailWrapperHtml(emailContent),
      text: `
Bonjour ${booking.clientInfo.name},

Nous espérons que votre rendez-vous s'est bien passé. Votre avis nous aide à améliorer nos services !

Votre rendez-vous :
- Prestation : ${booking.serviceName}
- Date : ${formattedDate}
- Heure : ${formattedTime}
- Chez : ${booking.providerName}

Prenez quelques secondes pour partager votre expérience :
${reviewUrl}

Votre avis sera visible sur la page du prestataire.

À bientôt,
${booking.providerName}
      `.trim(),
    });

    if (error) {
      console.error('[REVIEW-REQUEST-EMAIL] ERROR from Resend:', error);
      return NextResponse.json(
        { error: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    // Update booking with reviewRequestSentAt
    await bookingRepository.update(bookingId, {
      reviewRequestSentAt: new Date(),
    });

    console.log('[REVIEW-REQUEST-EMAIL] SUCCESS - Email sent and booking updated');
    console.log('[REVIEW-REQUEST-EMAIL] ========== END ==========');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[REVIEW-REQUEST-EMAIL] EXCEPTION:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
