/**
 * Template Emails
 * Notification email templates sent via Resend.
 */

import { Resend } from 'resend';
import { defineString } from 'firebase-functions/params';

const resendApiKey = defineString('RESEND_API_KEY');

let resendInstance: Resend | null = null;
function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(resendApiKey.value());
  }
  return resendInstance;
}

const FROM = 'Opatam <noreply@kamerleontech.com>';
const APP_URL = 'https://opatam.com';

interface TemplateEmailOptions {
  to: string;
  template: 'subscription_expiry' | 'unpublished_reminder' | 'new_review';
  data: Record<string, any>;
}

function wrapHtml(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 560px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo img { height: 32px; }
    h1 { font-size: 22px; color: #111827; margin: 0 0 12px; }
    p { font-size: 15px; color: #4B5563; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #3B82F6; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; }
    .btn-outline { display: inline-block; border: 2px solid #3B82F6; color: #3B82F6 !important; text-decoration: none; padding: 10px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #9CA3AF; }
    .highlight { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; border-radius: 8px; margin: 16px 0; }
    .highlight-red { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px 16px; border-radius: 8px; margin: 16px 0; }
    .stars { font-size: 24px; color: #F59E0B; letter-spacing: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <strong style="font-size: 20px; color: #3B82F6;">OPATAM</strong>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>Opatam — La plateforme de reservation sans commission</p>
      <p><a href="${APP_URL}" style="color: #3B82F6;">opatam.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

function getTemplate(template: string, data: Record<string, any>): { subject: string; html: string } {
  switch (template) {
    case 'subscription_expiry': {
      const { businessName, daysUntilExpiry, isExpired } = data;

      if (isExpired) {
        return {
          subject: `${businessName} — Votre page a été dépubliée`,
          html: wrapHtml(`
            <h1>Votre page n'est plus visible</h1>
            <div class="highlight-red">
              <p style="margin:0; color: #991B1B; font-weight: 600;">Votre abonnement a expiré</p>
            </div>
            <p>Bonjour,</p>
            <p>Votre abonnement Opatam pour <strong>${businessName}</strong> a expiré. Votre page n'est plus visible par les clients et vous ne recevez plus de réservations.</p>
            <p>Renouvelez votre abonnement pour retrouver votre visibilité :</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${APP_URL}/pro/parametres" class="btn">Renouveler mon abonnement</a>
            </p>
            <p style="font-size: 13px; color: #9CA3AF;">Vos données (prestations, avis, clients) sont conservées et seront restaurées dès le renouvellement.</p>
          `),
        };
      }

      return {
        subject: `${businessName} — Votre abonnement expire dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}`,
        html: wrapHtml(`
          <h1>Votre abonnement expire bientôt</h1>
          <div class="highlight">
            <p style="margin:0; color: #92400E; font-weight: 600;">Il reste ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''} avant l'expiration</p>
          </div>
          <p>Bonjour,</p>
          <p>L'abonnement de <strong>${businessName}</strong> sur Opatam expire dans <strong>${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}</strong>.</p>
          <p>Si vous ne renouvelez pas, votre page sera automatiquement dépubliée et vos clients ne pourront plus vous trouver.</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/pro/parametres" class="btn">Renouveler maintenant</a>
          </p>
        `),
      };
    }

    case 'unpublished_reminder': {
      const { businessName } = data;
      return {
        subject: `${businessName} — Votre page n'est pas encore visible`,
        html: wrapHtml(`
          <h1>Votre page attend d'être publiée !</h1>
          <p>Bonjour,</p>
          <p>Votre page <strong>${businessName}</strong> sur Opatam n'est pas encore publiée. Cela signifie que les clients ne peuvent pas vous trouver ni prendre rendez-vous.</p>
          <p>Publiez votre page en quelques clics pour commencer à recevoir des réservations :</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/pro/profil" class="btn">Publier ma page</a>
          </p>
          <p style="font-size: 13px; color: #6B7280;">Astuce : partagez votre page sur vos réseaux sociaux pour attirer vos premiers clients !</p>
        `),
      };
    }

    case 'new_review': {
      const { businessName, clientName, rating, comment } = data;
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      return {
        subject: `Nouvel avis pour ${businessName} — ${rating}/5`,
        html: wrapHtml(`
          <h1>Vous avez reçu un nouvel avis !</h1>
          <p>Bonjour,</p>
          <p>Un client a laissé un avis sur votre page <strong>${businessName}</strong> :</p>
          <div style="background: #F9FAFB; border-radius: 12px; padding: 20px; margin: 16px 0; text-align: center;">
            <p class="stars" style="margin: 0 0 8px;">${stars}</p>
            <p style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 4px;">${rating}/5</p>
            <p style="color: #6B7280; margin: 0;">par ${clientName || 'Un client'}</p>
            ${comment ? `<p style="margin: 12px 0 0; color: #374151; font-style: italic;">"${comment}"</p>` : ''}
          </div>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/pro/avis" class="btn">Voir mes avis</a>
          </p>
        `),
      };
    }

    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

export async function sendTemplateEmail(options: TemplateEmailOptions): Promise<void> {
  const { to, template, data } = options;
  const { subject, html } = getTemplate(template, data);

  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
  });

  console.log(`[TemplateEmail] Sent "${template}" to ${to}`);
}
