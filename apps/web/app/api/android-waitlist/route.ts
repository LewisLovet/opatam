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
            Merci pour votre intérêt !
          </h2>
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            Nous avons bien pris en compte votre demande. L'application <strong>${appConfig.name}</strong> sera bientôt disponible sur <strong>Google Play</strong>.
          </p>
          <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            Vous serez parmi les premiers informés dès que l'application sera disponible au téléchargement sur Android.
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
        subject: `${appConfig.name} sur Android — Bientôt disponible !`,
        html: confirmationHtml,
        text: `Merci pour votre intérêt ! L'application ${appConfig.name} sera bientôt disponible sur Google Play. Vous serez parmi les premiers informés dès que l'application sera disponible au téléchargement sur Android.`,
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
