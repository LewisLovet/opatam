import {
  appConfig,
  formatDateFr,
  formatPriceFr,
  formatTimeFr,
  getResend,
  emailConfig,
  isValidEmail,
} from '../resend';

/**
 * Email sent when a *provider* manually creates a booking that requires
 * a deposit and chose "demander l'acompte au client" in the planning
 * drawer. The client gets a Stripe Checkout link they can pay from
 * their inbox — they were never on the booking page.
 *
 * Distinct from the "you forgot to pay" reminder (`sendDepositReminderEmail`
 * in functions/) which fires from a cron at T+15min. This is the
 * inaugural message.
 */
export interface DepositPaymentRequestEmailData {
  clientEmail: string;
  clientName: string;
  serviceName: string;
  datetime: Date;
  duration: number;
  depositAmount: number;
  providerName: string;
  checkoutUrl: string;
  /** Window during which the slot is held (mirrors the Checkout
   *  expires_at — we tell the client "vous avez X minutes"). */
  minutesToPay: number;
  /** When set, the email shows a "Annuler la réservation" link so the
   *  client can release the slot without waiting for the timeout. */
  cancelToken?: string | null;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

export async function sendDepositPaymentRequestEmail(
  data: DepositPaymentRequestEmailData,
): Promise<SendResult> {
  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  const formattedDate = formatDateFr(data.datetime);
  const formattedTime = formatTimeFr(data.datetime);
  const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
  const formattedEndTime = formatTimeFr(endDate);
  const formattedDeposit = formatPriceFr(data.depositAmount);
  const cancelUrl = data.cancelToken
    ? `${appConfig.url}/reservation/annuler/${data.cancelToken}`
    : null;

  const subject = `Acompte à régler — ${data.serviceName} chez ${data.providerName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <tr><td style="padding: 32px 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">Bonjour ${data.clientName},</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;"><strong>${data.providerName}</strong> a enregistré pour vous un rendez-vous. Pour le confirmer, merci de régler l'acompte de <strong>${formattedDeposit}</strong>.</p>
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px;">Votre rendez-vous</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">Prestation</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Date</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">Heure</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td></tr>
                  <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">Acompte</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedDeposit}</td></tr>
                </table>
              </div>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">Le créneau est réservé pour vous pendant <strong>${data.minutesToPay} minutes</strong>. Sans paiement, il sera automatiquement libéré.</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.checkoutUrl}" style="display: inline-block; padding: 14px 32px; background-color: #d97706; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">Régler mon acompte</a></td></tr></table>
              <p style="margin: 0 0 16px; font-size: 13px; color: #71717a; text-align: center;">Paiement sécurisé via Stripe.</p>
              ${cancelUrl ? `<p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">Vous ne pourrez pas honorer ce rendez-vous ? <a href="${cancelUrl}" style="color: #dc2626; text-decoration: underline;">Annuler la réservation</a>.</p>` : ''}
            </td></tr>
            <tr><td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">À très vite,<br><strong>${data.providerName}</strong></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Bonjour ${data.clientName},

${data.providerName} a enregistré un rendez-vous pour vous. Merci de régler l'acompte de ${formattedDeposit} pour le confirmer.

- Prestation : ${data.serviceName}
- Date : ${formattedDate}
- Heure : ${formattedTime} - ${formattedEndTime}
- Acompte : ${formattedDeposit}

Le créneau est réservé pendant ${data.minutesToPay} minutes. Sans paiement, il sera libéré.

Régler mon acompte : ${data.checkoutUrl}
${cancelUrl ? `\nAnnuler la réservation : ${cancelUrl}` : ''}

À très vite,
${data.providerName}
  `.trim();

  try {
    const { error } = await getResend().emails.send({
      from: emailConfig.from,
      to: data.clientEmail,
      subject,
      html,
      text,
    });
    if (error) {
      console.error('[EMAIL] sendDepositPaymentRequestEmail Resend error:', error);
      return { success: false, error: String(error) };
    }
    return { success: true };
  } catch (err) {
    console.error('[EMAIL] sendDepositPaymentRequestEmail exception:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
