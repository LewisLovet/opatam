/**
 * POST /api/android-waitlist — VESTIGE de la liste d'attente Android.
 *
 * Plus aucune page n'appelle cette route : l'application est publiée sur le
 * Play Store depuis le 29 juillet 2026 et les boutons y renvoient
 * directement. Elle survit uniquement pour les navigateurs qui exécutent
 * encore l'ancien bundle JavaScript (page laissée ouverte, cache) : plutôt
 * qu'un 404 affiché comme une erreur, ils reçoivent le lien de
 * téléchargement. À supprimer une fois ces sessions expirées.
 *
 * Rien n'a jamais été stocké côté serveur : chaque inscription était
 * simplement notifiée à contact@opatam.com. Les adresses collectées vivent
 * donc dans cette boîte, sujet « [Android Waitlist] ».
 */

import { NextResponse } from 'next/server';
import { getResend, emailConfig, appConfig, getEmailWrapperHtml, isValidEmail } from '@/lib/resend';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Adresse email invalide' },
        { status: 400 }
      );
    }

    const resend = getResend();

    // Send confirmation email to user
    const confirmationHtml = getEmailWrapperHtml(`
      <tr>
        <td style="padding: 0 32px 24px;">
          <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">
            Bonne nouvelle : c'est disponible !
          </h2>
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            L'application <strong>${appConfig.name}</strong> est désormais téléchargeable sur <strong>Google Play</strong>.
          </p>
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            <a href="https://play.google.com/store/apps/details?id=com.kamerleontech.opatam" style="color: #dc2626; text-decoration: none; font-weight: 500;">Télécharger Opatam sur Google Play</a>
          </p>
          <p style="margin: 0; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            En attendant, l'application est déjà disponible sur l'<a href="https://apps.apple.com/us/app/opatam-agenda-rendez-vous/id6759246218" style="color: #dc2626; text-decoration: none; font-weight: 500;">App Store</a> pour les utilisateurs iPhone.
          </p>
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

    const trackingHtml = getEmailWrapperHtml(`
      <tr>
        <td style="padding: 0 32px 24px;">
          <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #18181b;">
            Nouvelle demande Android
          </h2>
          <p style="margin: 0 0 8px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            Un utilisateur souhaite être notifié de la disponibilité de l'app Android.
          </p>
          <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 12px;">
            <tr>
              <td style="padding: 8px 12px; font-size: 14px; color: #71717a; border: 1px solid #e4e4e7;">Email</td>
              <td style="padding: 8px 12px; font-size: 14px; color: #18181b; font-weight: 500; border: 1px solid #e4e4e7;">
                <a href="mailto:${email}" style="color: #dc2626; text-decoration: none;">${email}</a>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; font-size: 14px; color: #71717a; border: 1px solid #e4e4e7;">Date</td>
              <td style="padding: 8px 12px; font-size: 14px; color: #18181b; border: 1px solid #e4e4e7;">
                ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `);

    // Send both emails in parallel
    const [confirmResult, trackingResult] = await Promise.all([
      resend.emails.send({
        from: emailConfig.from,
        to: email,
        subject: `${appConfig.name} est disponible sur Google Play`,
        html: confirmationHtml,
        text: `L'application ${appConfig.name} est désormais disponible sur Google Play : https://play.google.com/store/apps/details?id=com.kamerleontech.opatam`,
      }),
      resend.emails.send({
        from: emailConfig.from,
        to: 'contact@opatam.com',
        replyTo: email,
        subject: `[Android Waitlist] Nouvelle demande — ${email}`,
        html: trackingHtml,
        text: `Nouvelle demande Android waitlist: ${email} — ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
      }),
    ]);

    console.log('[ANDROID-WAITLIST] Emails sent:', { confirmResult, trackingResult });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ANDROID-WAITLIST] Error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
