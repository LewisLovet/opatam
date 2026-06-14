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
// Logo shown in the header of every email (hosted on Firebase Storage so it's
// reachable from email clients without auth).
const EMAIL_LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

interface TemplateEmailOptions {
  to: string;
  template:
    | 'subscription_expiry'
    | 'unpublished_reminder'
    | 'activation_no_booking'
    | 'new_review'
    | 'affiliate_onboarding_reminder';
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
    .logo img { height: 40px; width: auto; max-width: 180px; }
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
        <img src="${EMAIL_LOGO_URL}" alt="Opatam" />
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
      const { businessName, daysUntilExpiry, isExpired, variant, affiliateOffer } = data;

      // Annual nudge — our standard conversion lever (no discount coupon,
      // so it never undercuts the affiliate program's better offer).
      const annualTip = `<p style="font-size: 13px; color: #6B7280;">💡 Astuce : l'abonnement <strong>annuel</strong> revient à environ <strong>2 mois offerts</strong> par rapport au mensuel.</p>`;

      // Affiliate offer reminder — ONLY shown here, in the email, and the ONLY
      // place we tell them to activate from the web (the Stripe coupon can't
      // apply on the in-app Apple purchase). We never steer to web inside the
      // app itself.
      const offerBlock = affiliateOffer?.discountLabel
        ? `<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:14px 16px;margin:16px 0;">
             <p style="margin:0 0 4px; color:#065F46; font-weight:700;">🎁 Votre réduction : ${affiliateOffer.discountLabel}</p>
             <p style="margin:0; font-size:13px; color:#047857;">Grâce au code <strong>${affiliateOffer.code}</strong>. Pour en bénéficier, activez votre abonnement <strong>depuis le web</strong> sur <a href="${APP_URL}/pro/abonnement" style="color:#047857;font-weight:600;">opatam.com</a> — la réduction s'applique automatiquement au paiement.</p>
           </div>`
        : '';

      // Win-back — sent a few days AFTER expiry, warmer tone, page already
      // paused. Goal: bring the pro back.
      if (variant === 'winback') {
        return {
          subject: `${businessName} — Votre page vous attend`,
          html: wrapHtml(`
            <h1>Vos clients ne vous trouvent plus</h1>
            <p>Bonjour,</p>
            <p>Votre page <strong>${businessName}</strong> est en pause : elle n'apparaît plus dans les recherches et vous ne recevez plus de réservations.</p>
            <p>Réactivez votre abonnement en moins d'une minute pour retrouver votre visibilité — vos données (prestations, avis, clients) sont intactes.</p>
            ${offerBlock}
            <p style="text-align: center; margin: 24px 0;">
              <a href="${APP_URL}/pro/parametres" class="btn">Réactiver ma page</a>
            </p>
            ${annualTip}
          `),
        };
      }

      if (isExpired) {
        return {
          subject: `${businessName} — Votre page a été dépubliée`,
          html: wrapHtml(`
            <h1>Votre page n'est plus visible</h1>
            <div class="highlight-red">
              <p style="margin:0; color: #991B1B; font-weight: 600;">Votre essai est terminé</p>
            </div>
            <p>Bonjour,</p>
            <p>Votre essai Opatam pour <strong>${businessName}</strong> est terminé. Votre page n'est plus visible par les clients et vous ne recevez plus de réservations.</p>
            <p>Activez votre abonnement pour retrouver votre visibilité :</p>
            ${offerBlock}
            <p style="text-align: center; margin: 24px 0;">
              <a href="${APP_URL}/pro/parametres" class="btn">Activer mon abonnement</a>
            </p>
            ${annualTip}
            <p style="font-size: 13px; color: #9CA3AF;">Vos données (prestations, avis, clients) sont conservées et seront restaurées dès l'activation.</p>
          `),
        };
      }

      return {
        subject: `${businessName} — Votre essai se termine dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}`,
        html: wrapHtml(`
          <h1>Votre essai se termine bientôt</h1>
          <div class="highlight">
            <p style="margin:0; color: #92400E; font-weight: 600;">Il reste ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''} d'essai</p>
          </div>
          <p>Bonjour,</p>
          <p>L'essai gratuit de <strong>${businessName}</strong> sur Opatam se termine dans <strong>${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}</strong>.</p>
          <p>Activez votre abonnement dès maintenant pour rester visible — sans interruption, et sans perdre vos réservations à venir.</p>
          ${offerBlock}
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/pro/parametres" class="btn">Activer mon abonnement</a>
          </p>
          ${annualTip}
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

    case 'activation_no_booking': {
      const { businessName } = data;
      return {
        subject: `${businessName} — Décrochez votre première réservation`,
        html: wrapHtml(`
          <h1>Prêt·e pour vos premières réservations ?</h1>
          <p>Bonjour,</p>
          <p>Votre page <strong>${businessName}</strong> est en ligne 🎉 — mais elle n'a pas encore reçu de réservation. La meilleure façon de démarrer : la <strong>partager</strong> autour de vous.</p>
          <p style="margin: 16px 0 8px; font-weight: 600;">3 actions qui marchent :</p>
          <ul style="margin: 0 0 16px; padding-left: 20px; color: #374151;">
            <li style="margin-bottom: 6px;">Publiez une <strong>story</strong> avec vos disponibilités du jour (depuis l'app).</li>
            <li style="margin-bottom: 6px;">Mettez le <strong>lien de votre page</strong> dans votre bio Instagram / TikTok.</li>
            <li style="margin-bottom: 6px;">Affichez votre <strong>QR code</strong> sur place pour que vos clients réservent en un scan.</li>
          </ul>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${APP_URL}/pro" class="btn">Partager ma page</a>
          </p>
          <p style="font-size: 13px; color: #6B7280;">Vos clients réservent en ligne 24h/24, sans appel ni va-et-vient de messages.</p>
        `),
      };
    }

    case 'affiliate_onboarding_reminder': {
      const { affiliateName, status, resumeUrl } = data;
      const statusLabel =
        status === 'restricted'
          ? 'restreint'
          : status === 'pending'
            ? 'en attente de finalisation'
            : 'incomplet';
      return {
        subject: `Finalisez votre compte affilié Opatam`,
        html: wrapHtml(`
          <h1>Votre compte affilié n'est pas encore actif</h1>
          <p>Bonjour ${affiliateName || ''},</p>
          <p>Votre compte affilié Opatam est <strong>${statusLabel}</strong>. Tant qu'il ne sera pas actif, nous ne pourrons pas vous reverser vos commissions sur les filleuls que vous nous envoyez.</p>
          <p>Quelques minutes suffisent pour le finaliser :</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${resumeUrl}" class="btn">Finaliser mon compte</a>
          </p>
          <p style="font-size: 13px; color: #6B7280;">Vous serez redirigé vers Stripe pour fournir les informations légales et bancaires nécessaires (KYC, IBAN). Une fois validé, vos commissions vous seront versées automatiquement.</p>
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
