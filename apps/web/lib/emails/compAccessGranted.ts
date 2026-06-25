import { resend, emailConfig, appConfig, getEmailWrapperHtml } from '@/lib/resend';

interface CompAccessGrantedParams {
  to: string;
  /** Provider business name, for the greeting. */
  businessName: string;
  plan: 'solo' | 'team';
  /** Whether the Sérénité (deposits) add-on was comped too. */
  serenity: boolean;
  /** Grant end date, or null for indefinite. */
  until: Date | null;
}

/**
 * Branded email sent to a provider when an admin grants them free ("comp")
 * access. When Sérénité is included, it spells out that they must connect
 * their Stripe account to actually *receive* the deposits — the feature is
 * unlocked, but the payout rail is theirs to set up.
 *
 * Best-effort: returns { success } and never throws, so granting access
 * doesn't fail if email delivery hiccups.
 */
export async function sendCompAccessGrantedEmail(
  params: CompAccessGrantedParams,
): Promise<{ success: boolean; error?: string }> {
  const { to, businessName, plan, serenity, until } = params;

  if (!process.env.RESEND_API_KEY) {
    console.warn('[compAccessGranted] RESEND_API_KEY not set — email skipped');
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  const planLabel = plan === 'team' ? 'Studio' : 'Solo';
  const durationLine = until
    ? `jusqu'au ${until.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`
    : 'sans limite de durée';

  const serenityBlock = serenity
    ? `
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 18px 20px; margin: 24px 0;">
          <p style="margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #166534;">
            Sérénité est également activé
          </p>
          <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #15803d;">
            Vous pouvez désormais demander un acompte à vos clients au moment de la réservation.
          </p>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #3f3f46;">
            <strong>Une étape indispensable pour être payé :</strong> pour <strong>percevoir</strong> ces acomptes,
            vous devez d'abord <strong>connecter votre compte bancaire via Stripe</strong>, depuis
            <strong>Paramètres&nbsp;→&nbsp;Paiements</strong> de votre espace pro. Tant que ce n'est pas fait, vos
            réservations se confirment normalement mais <strong>aucun acompte n'est prélevé</strong>.
          </p>
        </div>`
    : '';

  const ctaUrl = serenity
    ? `${appConfig.url}/pro/parametres`
    : `${appConfig.url}/pro`;
  const ctaLabel = serenity ? 'Configurer mes paiements' : 'Accéder à mon espace';

  const content = `
    <tr>
      <td style="padding: 8px 32px 32px;">
        <h1 style="margin: 0 0 16px; font-size: 22px; color: #18181b;">Votre accès Opatam est activé</h1>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
          Bonjour ${businessName},
        </p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
          Bonne nouvelle&nbsp;: nous venons d'activer un <strong>accès offert</strong> à votre espace Opatam —
          formule <strong>${planLabel}</strong>, ${durationLine}. Vous profitez dès maintenant de toutes les
          fonctionnalités, <strong>sans abonnement</strong>.
        </p>
        ${serenityBlock}
        <table role="presentation" style="margin: 24px auto 8px;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #71717a;">
          Une question&nbsp;? Répondez simplement à cet email, nous sommes là pour vous aider.
        </p>
        <p style="margin: 16px 0 0; font-size: 15px; color: #3f3f46;">
          À très vite,<br />
          <strong>L'équipe Opatam</strong>
        </p>
      </td>
    </tr>
  `;

  const subject = serenity
    ? 'Votre accès Opatam et Sérénité sont activés'
    : 'Votre accès Opatam est activé';

  try {
    await resend.emails.send({
      from: emailConfig.from,
      to,
      replyTo: emailConfig.replyTo,
      subject,
      html: getEmailWrapperHtml(content),
    });
    return { success: true };
  } catch (err) {
    console.error('[compAccessGranted] send error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
