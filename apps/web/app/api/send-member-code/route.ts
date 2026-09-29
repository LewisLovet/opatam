/**
 * Envoie au membre son code d'accès au planning.
 *
 * AVANT : la route prenait dans le corps de la requête le destinataire, le
 * nom, le salon ET le code, sans vérifier qui appelait — un relais d'e-mails
 * ouvert, au nom d'Opatam, vers n'importe quelle adresse et avec n'importe
 * quel contenu. MAINTENANT : jeton Firebase obligatoire, l'appelant doit
 * être le gérant du salon, et tout ce que contient l'e-mail est relu en
 * base (Admin SDK). Le corps ne désigne plus que le membre.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  resend,
  emailConfig,
  appConfig,
  isValidEmail,
} from '@/lib/resend';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { codeDuMembre } from '@/lib/member-access-code';

interface SendCodeRequest {
  providerId: string;
  memberId: string;
}

/** Les valeurs relues en base sont réinjectées dans le HTML : échappées. */
function echapper(v: unknown, max = 120): string {
  return String(v ?? '')
    .slice(0, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authentification requise' }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await getAdminAuth().verifyIdToken(header.slice('Bearer '.length))).uid;
    } catch {
      return NextResponse.json({ message: 'Session expirée, reconnectez-vous' }, { status: 401 });
    }

    const body: Partial<SendCodeRequest> = await request.json();
    const { providerId, memberId } = body;
    if (!providerId || !memberId || typeof providerId !== 'string' || typeof memberId !== 'string') {
      return NextResponse.json({ message: 'Données manquantes' }, { status: 400 });
    }
    // Un gérant n'écrit qu'aux membres de SON salon.
    if (uid !== providerId) {
      return NextResponse.json({ message: 'Accès non autorisé' }, { status: 403 });
    }

    const db = getAdminFirestore();
    const [providerSnap, memberSnap, accessCode] = await Promise.all([
      db.collection('providers').doc(providerId).get(),
      db.collection('providers').doc(providerId).collection('members').doc(memberId).get(),
      codeDuMembre(providerId, memberId),
    ]);
    if (!memberSnap.exists) {
      return NextResponse.json({ message: 'Membre introuvable' }, { status: 404 });
    }
    if (!accessCode) {
      return NextResponse.json({ message: "Ce membre n'a pas encore de code : régénérez-le d'abord" }, { status: 409 });
    }
    const memberEmail = String(memberSnap.get('email') ?? '');
    if (!isValidEmail(memberEmail)) {
      return NextResponse.json({ message: 'Email invalide' }, { status: 400 });
    }
    const memberName = echapper(memberSnap.get('name'));
    const businessName = echapper(providerSnap.get('businessName') || 'Votre salon');
    const nomTexte = String(memberSnap.get('name') ?? '').slice(0, 120);
    const salonTexte = String(providerSnap.get('businessName') || 'Votre salon').slice(0, 120);

    // Send email via Resend
    const { error } = await resend.emails.send({
      from: emailConfig.from,
      to: memberEmail,
      subject: `Votre code d'accès planning - ${salonTexte}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Votre code d'accès</title>
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
                          Votre code d'accès
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
                              Accéder à mon planning
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
Bonjour ${nomTexte},

Vous pouvez consulter votre planning sur ${appConfig.name}.

Votre code d'accès : ${accessCode}

Rendez-vous sur : ${appConfig.url}/planning

À bientôt,
${salonTexte}
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
