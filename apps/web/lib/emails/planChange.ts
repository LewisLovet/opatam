/**
 * Plan change confirmation email.
 *
 * Sent by the Stripe webhook when an `customer.subscription.updated` event
 * actually changes the `plan` metadata (i.e. the user went Pro → Studio
 * or Studio → Pro). Contains the same prorata breakdown that the user
 * saw in the confirmation modal, plus the next invoice date and a CTA
 * back to their dashboard.
 *
 * Used both by the webhook and by /api/dev/emails (preview).
 */

const APP_NAME = 'Opatam';
const APP_URL = 'https://opatam.com';
const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface PlanChangeEmailArgs {
  name: string;
  previousPlanLabel: string;
  newPlanLabel: string;
  /** ISO date string — when the prorata will be billed */
  nextInvoiceDate: string | null;
  /** Net amount in cents — signed; positive = to pay, negative = credit */
  netCents: number;
  /** Credit amount in cents — always <= 0 */
  creditCents: number;
  /** Charge amount in cents — always >= 0 */
  chargeCents: number;
  /** ISO currency code, e.g. "eur" — only "eur" supported in display */
  currency: string;
}

export interface PlanChangeEmail {
  subject: string;
  html: string;
}

function formatEur(cents: number): string {
  const abs = Math.abs(cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${abs} €`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'à la prochaine échéance';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function generatePlanChangeEmail(
  args: PlanChangeEmailArgs,
): PlanChangeEmail {
  const {
    name,
    previousPlanLabel,
    newPlanLabel,
    nextInvoiceDate,
    netCents,
    creditCents,
    chargeCents,
  } = args;

  const isUpgrade = netCents > 0;
  const nextDate = formatDate(nextInvoiceDate);
  const accent = isUpgrade ? '#6366f1' : '#10b981';
  const accentBg = isUpgrade ? '#eef2ff' : '#ecfdf5';
  const accentBorder = isUpgrade ? '#c7d2fe' : '#a7f3d0';

  const subject = `Votre plan Opatam est passé à ${newPlanLabel}`;

  const prorataSummary = isUpgrade
    ? `<strong>${formatEur(netCents)}</strong> seront ajoutés à votre prochaine facture le <strong>${nextDate}</strong>. Aucun paiement immédiat.`
    : `Un <strong>crédit de ${formatEur(Math.abs(netCents))}</strong> sera appliqué à votre prochaine facture le <strong>${nextDate}</strong>.`;

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
                  <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${name},</p>
                  <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                    Votre abonnement a été mis à jour de <strong>${previousPlanLabel}</strong> à <strong style="color: ${accent};">${newPlanLabel}</strong>.
                  </p>

                  <!-- Prorata breakdown -->
                  <div style="background-color: ${accentBg}; border: 1px solid ${accentBorder}; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0 0 12px; font-size: 12px; font-weight: 600; color: ${accent}; text-transform: uppercase; letter-spacing: 0.5px;">Ajusté au prorata</p>
                    <table style="width: 100%; border-collapse: collapse;">
                      ${
                        creditCents < 0
                          ? `<tr>
                              <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Crédit ${previousPlanLabel} non utilisé</td>
                              <td style="padding: 4px 0; font-size: 14px; color: #16a34a; font-weight: 500; text-align: right;">−${formatEur(creditCents)}</td>
                            </tr>`
                          : ''
                      }
                      ${
                        chargeCents > 0
                          ? `<tr>
                              <td style="padding: 4px 0; font-size: 14px; color: #71717a;">Charge ${newPlanLabel} au prorata</td>
                              <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-align: right;">+${formatEur(chargeCents)}</td>
                            </tr>`
                          : ''
                      }
                      <tr>
                        <td colspan="2" style="border-top: 1px solid ${accentBorder}; padding-top: 8px;"></td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 600;">${isUpgrade ? 'À payer' : 'Crédit'}</td>
                        <td style="padding: 4px 0; font-size: 18px; color: ${accent}; font-weight: 700; text-align: right;">${isUpgrade ? '+' : ''}${formatEur(netCents)}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
                    ${prorataSummary}
                  </p>

                  <table role="presentation" style="width: 100%; border-collapse: collapse;"><tr><td align="center"><a href="${APP_URL}/pro/parametres?tab=abonnement" style="display: inline-block; padding: 14px 32px; background-color: ${accent}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Voir mon abonnement</a></td></tr></table>
                </td>
              </tr>
              <tr>
                <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
                  <p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">À bientôt,<br><strong>L'équipe ${APP_NAME}</strong></p>
                </td>
              </tr>
            </table>
            <p style="margin: 24px 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">Cet email a été envoyé par ${APP_NAME}.<br>Pour toute question, répondez simplement à cet email.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { subject, html };
}
