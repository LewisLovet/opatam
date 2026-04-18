/**
 * Shared HTML template for the two affiliate welcome emails:
 *   - mode: 'new'      → user has no Opatam account yet, include a
 *                        password-reset link as the primary CTA
 *   - mode: 'existing' → user already has an Opatam account, tell them
 *                        to use the same credentials
 *
 * The template stays short and commercial: it shows the earning potential
 * at 50 and 100 active referrals given the affiliate's commission rate,
 * plus their sharing link and next-step CTA.
 *
 * Used both by `/api/admin/affiliates` (prod) and `/api/dev/emails`
 * (preview) so there's one source of truth.
 */

const APP_NAME = 'Opatam';
const APP_URL = 'https://opatam.com';
const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';
const BASE_PRICE_TTC = 19.9;
const TVA_RATE = 0.2;

export interface AffiliateWelcomeArgs {
  name: string;
  code: string;
  /** Commission rate as a percentage (e.g. 20 for 20%) */
  commission: number;
  /** Discount for referrals as a percentage, or null if none */
  discount: number | null;
  mode: 'new' | 'existing';
  /** Required when mode === 'new' */
  resetLink?: string;
}

export interface AffiliateWelcomeEmail {
  subject: string;
  html: string;
}

function eur(value: number): string {
  return `${Math.round(value)} €`;
}

/** French-formatted euro amount with 2 decimals, e.g. "3,32 €" */
function eurPrecise(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

export function generateAffiliateWelcomeEmail(
  args: AffiliateWelcomeArgs,
): AffiliateWelcomeEmail {
  const { name, code, commission, discount, mode, resetLink } = args;

  // Net HT commission per active referral, and scaled examples
  const perSubMonthly = (BASE_PRICE_TTC / (1 + TVA_RATE)) * (commission / 100);
  const at10 = perSubMonthly * 10;
  const at100 = perSubMonthly * 100;

  const shareLink = `${APP_URL}/register?ref=${code}`;
  const dashboardLink = `${APP_URL}/affiliation/login`;
  const primaryCtaHref = mode === 'new' ? resetLink ?? dashboardLink : dashboardLink;
  const primaryCtaLabel =
    mode === 'new' ? 'Créer mon mot de passe' : 'Accéder à mon dashboard';

  // Login hint — differs between new and existing users
  const loginHint =
    mode === 'new'
      ? `Créez votre mot de passe pour accéder à votre espace affilié.`
      : `Connectez-vous avec <strong>vos identifiants habituels Opatam</strong> — c'est le même compte que celui que vous utilisez déjà.`;

  const subject =
    mode === 'new'
      ? `Bienvenue dans le programme d'affiliation ${APP_NAME}`
      : `Vous êtes maintenant affilié ${APP_NAME} !`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <tr>
                <td style="padding: 32px 32px 24px; text-align: center;">
                  <img src="${LOGO_URL}" alt="${APP_NAME}" style="max-height: 48px; max-width: 200px;" />
                </td>
              </tr>
              <tr>
                <td style="padding: 0 32px 24px;">
                  <p style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #18181b;">Bienvenue ${name} !</p>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                    Vous faites désormais partie du programme d'affiliation ${APP_NAME}. Chaque abonnement actif que vous parrainez vous rapporte <strong>${eurPrecise(perSubMonthly)}</strong> par mois (${commission}% du montant HT), <strong>à vie</strong>, tant que l'abonné reste client.
                  </p>

                  <!-- Earning potential card -->
                  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px; color: #ffffff;">
                    <p style="margin: 0 0 14px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.85;">Votre potentiel de revenus</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; opacity: 0.9;">Avec <strong>10 abonnés</strong> actifs</td>
                        <td style="padding: 8px 0; font-size: 20px; font-weight: 700; text-align: right;">${eur(at10)}<span style="font-size: 12px; font-weight: 400; opacity: 0.7;">/mois</span></td>
                      </tr>
                      <tr><td colspan="2" style="border-top: 1px solid rgba(255,255,255,0.15);"></td></tr>
                      <tr>
                        <td style="padding: 8px 0; font-size: 14px; opacity: 0.9;">Avec <strong>100 abonnés</strong> actifs</td>
                        <td style="padding: 8px 0; font-size: 20px; font-weight: 700; text-align: right;">${eur(at100)}<span style="font-size: 12px; font-weight: 400; opacity: 0.7;">/mois</span></td>
                      </tr>
                    </table>
                    <p style="margin: 12px 0 0; font-size: 12px; opacity: 0.75; line-height: 1.5;">
                      Et bien plus au-delà. Vos revenus s'additionnent mois après mois grâce aux abonnements récurrents.
                    </p>
                  </div>

                  <!-- Code + link card -->
                  <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                    <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Votre code parrain</p>
                    <p style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #6366f1; letter-spacing: 1px;">${code}</p>
                    <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Votre lien de partage</p>
                    <p style="margin: 0; font-size: 13px; color: #3f3f46; font-family: ui-monospace, SFMono-Regular, monospace; word-break: break-all;">${shareLink}</p>
                    ${discount ? `<p style="margin: 12px 0 0; font-size: 12px; color: #3f3f46;">Bonus : vos filleuls bénéficient d'une réduction de <strong>-${discount}%</strong> sur leur abonnement.</p>` : ''}
                  </div>

                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                    ${loginHint}
                  </p>

                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${primaryCtaHref}" style="display: inline-block; padding: 14px 32px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${primaryCtaLabel}</a></td></tr></table>

                  <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px; margin-top: 24px;">
                    <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;">
                      <strong>Important :</strong> pour recevoir vos commissions, pensez à configurer votre compte Stripe depuis votre dashboard.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">À très vite,<br><strong>L'équipe ${APP_NAME}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé par ${APP_NAME}.<br>Si vous n'êtes pas concerné, vous pouvez ignorer ce message.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { subject, html };
}
