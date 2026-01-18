import { NextRequest, NextResponse } from 'next/server';
import {
  resend,
  emailConfig,
  appConfig,
  isValidEmail,
} from '@/lib/resend';

interface SendCodeRequest {
  providerId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  accessCode: string;
  businessName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SendCodeRequest = await request.json();

    const { memberName, memberEmail, accessCode, businessName } = body;

    // Validate required fields
    if (!memberName || !memberEmail || !accessCode || !businessName) {
      return NextResponse.json(
        { message: 'Donnees manquantes' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!isValidEmail(memberEmail)) {
      return NextResponse.json(
        { message: 'Email invalide' },
        { status: 400 }
      );
    }

    // Send email via Resend
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: memberEmail,
      subject: `Votre code d'acces planning - ${businessName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Votre code d'acces</title>
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
                        Bonjour ${memberName},
                      </p>
                      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                        Vous pouvez consulter votre planning sur ${appConfig.name}.
                      </p>

                      <!-- Code box -->
                      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">
                          Votre code d'acces
                        </p>
                        <p style="margin: 0; font-size: 28px; font-weight: 700; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; letter-spacing: 2px; color: #18181b;">
                          ${accessCode}
                        </p>
                      </div>

                      <!-- CTA Button -->
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="${appConfig.url}/planning" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                              Acceder a mon planning
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
Bonjour ${memberName},

Vous pouvez consulter votre planning sur ${appConfig.name}.

Votre code d'acces : ${accessCode}

Rendez-vous sur : ${appConfig.url}/planning

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
    console.error('Send member code error:', error);
    return NextResponse.json(
      { message: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
