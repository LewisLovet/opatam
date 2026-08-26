/**
 * E-mail « invitation » — un commercial incite un prospect à s'abonner SANS
 * remise. Le pendant sobre de salesOffre.ts : pas de code, pas d'urgence —
 * l'essai gratuit est l'argument, le lien porte l'attribution signée.
 */

const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface SalesInvitationEmailArgs {
  url: string;
  fromName?: string | null;
  message?: string | null;
}

function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br />');
}

export function generateSalesInvitationEmail(args: SalesInvitationEmailArgs): {
  subject: string;
  html: string;
} {
  const subject = 'Votre agenda en ligne Opatam — 30 jours d’essai gratuit';

  const html = `
  <div style="margin:0;padding:32px 12px;background:#f4f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="text-align:center;padding:0 0 18px;">
        <img src="${LOGO_URL}" alt="Opatam" height="26" style="display:inline-block;" />
      </div>
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2de;box-shadow:0 1px 3px rgba(24,24,27,0.06);">
        <div style="padding:28px 36px 8px;">
          <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:#18181b;font-weight:700;">
            Vos réservations en ligne, sans commission
          </h1>
          ${
            args.message?.trim()
              ? `<div style="margin:0 0 18px;padding:14px 18px;background:#faf7f5;border-left:3px solid #c81e3a;border-radius:0 10px 10px 0;font-size:14.5px;line-height:1.6;color:#3f3f46;font-style:italic;">
                   ${echapperHtml(args.message.trim())}${args.fromName ? `<span style="display:block;margin-top:6px;font-style:normal;font-size:13px;color:#71717a;">— ${echapperHtml(args.fromName)}</span>` : ''}
                 </div>`
              : ''
          }
          <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">
            Opatam donne à votre salon une page de réservation à votre image : vos clientes
            réservent jour et nuit, les rappels automatiques réduisent les rendez-vous manqués,
            et votre fichier client vous appartient.
          </p>
          <ul style="margin:0 0 18px;padding-left:18px;font-size:14.5px;line-height:1.8;color:#3f3f46;">
            <li><strong>30 jours d'essai gratuit</strong>, sans carte bancaire</li>
            <li><strong>0 % de commission</strong> sur vos réservations — un abonnement fixe</li>
            <li><strong>Sans engagement</strong> — résiliable à tout moment</li>
          </ul>
        </div>
        <div style="padding:4px 36px 26px;text-align:center;">
          <a href="${args.url}" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:12px;">
            Créer mon compte gratuitement
          </a>
          <p style="margin:12px 0 0;font-size:12.5px;color:#9a9aa0;">
            Aucune carte bancaire demandée — vous testez tout, vous décidez ensuite.
          </p>
        </div>
        <div style="padding:16px 36px 22px;border-top:1px solid #f0ece9;">
          <p style="margin:0;font-size:14px;color:#18181b;">
            ${args.fromName ? `${echapperHtml(args.fromName)}, ` : ''}l'équipe Opatam
          </p>
        </div>
      </div>
      <p style="margin:16px 8px 0;text-align:center;font-size:11.5px;line-height:1.5;color:#a7a29e;">
        Vous recevez ce message parce qu'un membre de l'équipe Opatam vous a proposé de
        découvrir la plateforme. Si vous n'êtes pas concerné, ignorez-le simplement.
      </p>
    </div>
  </div>`;

  return { subject, html };
}
