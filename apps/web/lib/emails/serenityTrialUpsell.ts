import { resend, emailConfig, appConfig, getEmailWrapperHtml } from '@/lib/resend';

interface SerenityTrialUpsellParams {
  to: string;
  /** Provider business name, for the greeting. */
  businessName: string;
}

/**
 * Sent ONCE, right after a provider converts their free trial into a paid
 * base plan, IF they used the deposits feature during the trial (signal:
 * an active Stripe Connect account — Connect only exists for deposits).
 *
 * Deposits were included for free during the trial; the base plan alone
 * doesn't cover them. Without Sérénité the next bookings simply won't
 * collect deposits — this email tells the pro before they find out the
 * hard way, and gives them the one-click path to keep the feature.
 *
 * Best-effort: returns { success } and never throws, so the webhook that
 * triggers it can't fail on email delivery.
 */
export async function sendSerenityTrialUpsellEmail(
  params: SerenityTrialUpsellParams,
): Promise<{ success: boolean; error?: string }> {
  const { to, businessName } = params;

  if (!process.env.RESEND_API_KEY) {
    console.warn('[serenityTrialUpsell] RESEND_API_KEY not set — email skipped');
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  const ctaUrl = `${appConfig.url}/pro/parametres?tab=paiements`;

  const content = `
    <tr>
      <td style="padding: 32px 40px;">
        <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">
          Bonjour ${businessName},
        </p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
          Merci pour votre abonnement — et bienvenue parmi les pros Opatam&nbsp;! 🎉
        </p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
          Pendant votre essai, vous avez utilisé les <strong>acomptes</strong> pour
          sécuriser vos réservations. Cette fonctionnalité fait partie de
          l'abonnement <strong>Sérénité</strong> (5&nbsp;€/mois), qui n'est pas
          inclus dans votre plan de base.
        </p>
        <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 18px 20px; margin: 24px 0;">
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #92400e;">
            Sans Sérénité, vos prochaines réservations seront confirmées
            <strong>sans acompte</strong>. Votre configuration (pourcentages,
            délais de remboursement) est conservée — elle se réactivera dès
            votre souscription.
          </p>
        </div>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
          Réactivez les acomptes en une minute&nbsp;:
        </p>
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                Activer Sérénité — 5&nbsp;€/mois
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: #71717a;">
          Sans engagement, annulable à tout moment. Une question&nbsp;?
          Répondez simplement à cet email.
        </p>
        <p style="margin: 16px 0 0; font-size: 15px; color: #3f3f46;">
          À très vite,<br />
          <strong>L'équipe Opatam</strong>
        </p>
      </td>
    </tr>
  `;

  try {
    await resend.emails.send({
      from: emailConfig.from,
      to,
      replyTo: emailConfig.replyTo,
      subject: 'Continuez à encaisser des acomptes — activez Sérénité',
      html: getEmailWrapperHtml(content),
    });
    return { success: true };
  } catch (err) {
    console.error('[serenityTrialUpsell] send error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
