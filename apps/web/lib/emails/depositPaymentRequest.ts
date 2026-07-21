import {
  appConfig,
  getResend,
  emailConfig,
  isValidEmail,
} from '../resend';

/**
 * Email sent when a booking requires a deposit and the client must pay it
 * from their inbox: provider-created bookings ("demander l'acompte au client"
 * in the planning drawer) and tunnel bookings whose payment page was left.
 *
 * Distinct from the "you forgot to pay" reminder (`sendDepositReminderEmail`
 * in functions/) which fires from a cron at T+15min. This is the
 * inaugural message.
 *
 * Localized (fr/en/it): `locale` comes from `booking.clientLocale` (the language the
 * client booked in). Absent — e.g. provider-created bookings where the
 * client never expressed a language — falls back to French.
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
  /** Client language ('fr' | 'en' | 'it'…). Absent = French. */
  locale?: string | null;
}

export interface SendResult {
  success: boolean;
  error?: string;
}

const TEXTS = {
  fr: {
    subject: (service: string, provider: string) =>
      `Acompte à régler — ${service} chez ${provider}`,
    hello: (name: string) => `Bonjour ${name},`,
    intro: (provider: string, deposit: string) =>
      `<strong>${provider}</strong> a enregistré pour vous un rendez-vous. Pour le confirmer, merci de régler l'acompte de <strong>${deposit}</strong>.`,
    introText: (provider: string, deposit: string) =>
      `${provider} a enregistré un rendez-vous pour vous. Merci de régler l'acompte de ${deposit} pour le confirmer.`,
    yourBooking: 'Votre rendez-vous',
    service: 'Prestation',
    date: 'Date',
    time: 'Heure',
    deposit: 'Acompte',
    holdNotice: (minutes: number) =>
      `Le créneau est réservé pour vous pendant <strong>${minutes} minutes</strong>. Sans paiement, il sera automatiquement libéré.`,
    holdNoticeText: (minutes: number) =>
      `Le créneau est réservé pendant ${minutes} minutes. Sans paiement, il sera libéré.`,
    payCta: 'Régler mon acompte',
    securePayment: 'Paiement sécurisé via Stripe.',
    cantMakeIt: 'Vous ne pourrez pas honorer ce rendez-vous ?',
    cancelLink: 'Annuler la réservation',
    signoff: 'À très vite,',
  },
  en: {
    subject: (service: string, provider: string) =>
      `Deposit required — ${service} at ${provider}`,
    hello: (name: string) => `Hello ${name},`,
    intro: (provider: string, deposit: string) =>
      `<strong>${provider}</strong> has scheduled an appointment for you. To confirm it, please pay the <strong>${deposit}</strong> deposit.`,
    introText: (provider: string, deposit: string) =>
      `${provider} has scheduled an appointment for you. Please pay the ${deposit} deposit to confirm it.`,
    yourBooking: 'Your appointment',
    service: 'Service',
    date: 'Date',
    time: 'Time',
    deposit: 'Deposit',
    holdNotice: (minutes: number) =>
      `The slot is held for you for <strong>${minutes} minutes</strong>. Without payment, it will be released automatically.`,
    holdNoticeText: (minutes: number) =>
      `The slot is held for ${minutes} minutes. Without payment, it will be released.`,
    payCta: 'Pay my deposit',
    securePayment: 'Secure payment via Stripe.',
    cantMakeIt: "Can't make this appointment?",
    cancelLink: 'Cancel the booking',
    signoff: 'See you soon,',
  },
  it: {
    subject: (service: string, provider: string) =>
      `Acconto da pagare — ${service} presso ${provider}`,
    hello: (name: string) => `Buongiorno ${name},`,
    intro: (provider: string, deposit: string) =>
      `<strong>${provider}</strong> ha fissato un appuntamento per Lei. Per confermarlo, La preghiamo di pagare l'acconto di <strong>${deposit}</strong>.`,
    introText: (provider: string, deposit: string) =>
      `${provider} ha fissato un appuntamento per Lei. La preghiamo di pagare l'acconto di ${deposit} per confermarlo.`,
    yourBooking: 'Il Suo appuntamento',
    service: 'Prestazione',
    date: 'Data',
    time: 'Ora',
    deposit: 'Acconto',
    holdNotice: (minutes: number) =>
      `Il posto è riservato per Lei per <strong>${minutes} minuti</strong>. Senza pagamento, verrà liberato automaticamente.`,
    holdNoticeText: (minutes: number) =>
      `Il posto è riservato per ${minutes} minuti. Senza pagamento, verrà liberato.`,
    payCta: "Paga l'acconto",
    securePayment: 'Pagamento sicuro tramite Stripe.',
    cantMakeIt: "Non può presentarsi all'appuntamento?",
    cancelLink: 'Annulla la prenotazione',
    signoff: 'A prestissimo,',
  },
} as const;

type Locale = 'fr' | 'en' | 'it';

const INTL_LOCALE: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB', it: 'it-IT' };

function resolveLocale(raw: string | null | undefined): Locale {
  return raw === 'en' || raw === 'it' ? raw : 'fr';
}

/** Paris-anchored formats in the recipient's language (24h clock for all). */
function formatDate(d: Date, l: Locale): string {
  return d.toLocaleDateString(INTL_LOCALE[l], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
}

function formatTime(d: Date, l: Locale): string {
  return d.toLocaleTimeString(INTL_LOCALE[l], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Paris',
  });
}

function formatPrice(cents: number, l: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[l], {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export async function sendDepositPaymentRequestEmail(
  data: DepositPaymentRequestEmailData,
): Promise<SendResult> {
  if (!isValidEmail(data.clientEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  const l = resolveLocale(data.locale);
  const t = TEXTS[l];

  const formattedDate = formatDate(data.datetime, l);
  const formattedTime = formatTime(data.datetime, l);
  const endDate = new Date(data.datetime.getTime() + data.duration * 60 * 1000);
  const formattedEndTime = formatTime(endDate, l);
  const formattedDeposit = formatPrice(data.depositAmount, l);
  const cancelUrl = data.cancelToken
    ? `${appConfig.url}/reservation/annuler/${data.cancelToken}`
    : null;

  const subject = t.subject(data.serviceName, data.providerName);

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr><td align="center" style="padding: 40px 20px;">
          <table role="presentation" style="max-width: 480px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
            <tr><td style="padding: 32px 32px 24px;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.hello(data.clientName)}</p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #3f3f46;">${t.intro(data.providerName, formattedDeposit)}</p>
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #c2410c; text-transform: uppercase; letter-spacing: 0.5px;">${t.yourBooking}</p>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a; width: 100px;">${t.service}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${data.serviceName}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${t.date}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500; text-transform: capitalize;">${formattedDate}</td></tr>
                  <tr><td style="padding: 4px 0; font-size: 14px; color: #71717a;">${t.time}</td><td style="padding: 4px 0; font-size: 14px; color: #18181b; font-weight: 500;">${formattedTime} - ${formattedEndTime}</td></tr>
                  <tr><td style="padding: 8px 0 4px; font-size: 14px; color: #71717a;">${t.deposit}</td><td style="padding: 8px 0 4px; font-size: 16px; color: #18181b; font-weight: 600;">${formattedDeposit}</td></tr>
                </table>
              </div>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">${t.holdNotice(data.minutesToPay)}</p>
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;"><tr><td align="center"><a href="${data.checkoutUrl}" style="display: inline-block; padding: 14px 32px; background-color: #d97706; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">${t.payCta}</a></td></tr></table>
              <p style="margin: 0 0 16px; font-size: 13px; color: #71717a; text-align: center;">${t.securePayment}</p>
              ${cancelUrl ? `<p style="margin: 0; font-size: 13px; color: #71717a; text-align: center;">${t.cantMakeIt} <a href="${cancelUrl}" style="color: #dc2626; text-decoration: underline;">${t.cancelLink}</a>.</p>` : ''}
            </td></tr>
            <tr><td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">${t.signoff}<br><strong>${data.providerName}</strong></p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const text = `
${t.hello(data.clientName)}

${t.introText(data.providerName, formattedDeposit)}

- ${t.service} : ${data.serviceName}
- ${t.date} : ${formattedDate}
- ${t.time} : ${formattedTime} - ${formattedEndTime}
- ${t.deposit} : ${formattedDeposit}

${t.holdNoticeText(data.minutesToPay)}

${t.payCta} : ${data.checkoutUrl}
${cancelUrl ? `\n${t.cancelLink} : ${cancelUrl}` : ''}

${t.signoff}
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
