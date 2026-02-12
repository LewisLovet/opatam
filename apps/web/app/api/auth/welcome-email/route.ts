import { NextRequest, NextResponse } from 'next/server';
import {
  resend,
  emailConfig,
  appConfig,
  isValidEmail,
  getEmailWrapperHtml,
} from '@/lib/resend';

interface WelcomeEmailRequest {
  email: string;
  displayName: string;
  businessName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: WelcomeEmailRequest = await request.json();
    const { email, displayName, businessName } = body;

    if (!email || !displayName || !businessName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const html = getEmailWrapperHtml(`
      <!-- Content -->
      <tr>
        <td style="padding: 0 32px 24px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
            Bonjour ${displayName},
          </p>
          <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
            Bienvenue sur <strong>${appConfig.name}</strong> ! Votre compte pour <strong>${businessName}</strong> a bien été créé.
          </p>

          <!-- What's next box -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">
              Prochaines étapes
            </p>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #18181b;">
                  <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">1.</span>
                  Connectez-vous à votre espace professionnel
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #18181b;">
                  <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">2.</span>
                  Activez votre essai gratuit de 14 jours
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #18181b;">
                  <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">3.</span>
                  Partagez votre page de réservation à vos clients
                </td>
              </tr>
            </table>
          </div>

          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            Vos disponibilités et votre première prestation sont déjà configurées. Vous pouvez les modifier à tout moment depuis votre espace.
          </p>

          <!-- CTA Button -->
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td align="center">
                <a href="${appConfig.url}/login" style="display: inline-block; padding: 14px 32px; background-color: #18181b; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                  Se connecter
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
            À bientôt,<br>
            <strong>L'équipe ${appConfig.name}</strong>
          </p>
        </td>
      </tr>
    `);

    const text = `
Bonjour ${displayName},

Bienvenue sur ${appConfig.name} ! Votre compte pour ${businessName} a bien été créé.

Prochaines étapes :
1. Connectez-vous à votre espace professionnel
2. Activez votre essai gratuit de 14 jours
3. Partagez votre page de réservation à vos clients

Vos disponibilités et votre première prestation sont déjà configurées. Vous pouvez les modifier à tout moment depuis votre espace.

Se connecter : ${appConfig.url}/login

À bientôt,
L'équipe ${appConfig.name}
    `.trim();

    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      replyTo: emailConfig.replyTo,
      subject: `Bienvenue sur ${appConfig.name}, ${displayName} !`,
      html,
      text,
    });

    if (error) {
      console.error('[WELCOME-EMAIL] Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[WELCOME-EMAIL] Exception:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
