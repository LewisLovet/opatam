/**
 * E-mail « votre offre » — un commercial propose une remise à un prospect.
 *
 * Le code est la star : gros, copiable à l'œil, avec sa date de fin. Le
 * lien d'inscription porte l'attribution ET le code (pré-rempli côté
 * abonnement). Texte court : l'offre a déjà été présentée de vive voix.
 */

const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface SalesOffreEmailArgs {
  offreLabel: string;
  pitch: string;
  annuelSeulement: boolean;
  code: string;
  url: string;
  expiresLe: string;
  fromName?: string | null;
  message?: string | null;
  /** Compte déjà inscrit : le CTA mène au PAIEMENT web (code pré-appliqué),
   *  pas à l'inscription — l'essai en cours reste entier. */
  paiementDirect?: boolean;
}

function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br />');
}

export function generateSalesOffreEmail(args: SalesOffreEmailArgs): { subject: string; html: string } {
  const subject = `Votre offre Opatam : ${args.offreLabel}`;

  const html = `
  <div style="margin:0;padding:32px 12px;background:#f4f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="text-align:center;padding:0 0 18px;">
        <img src="${LOGO_URL}" alt="Opatam" height="26" style="display:inline-block;" />
      </div>
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2de;box-shadow:0 1px 3px rgba(24,24,27,0.06);">
        <div style="padding:28px 36px 8px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c81e3a;">
            Offre réservée
          </p>
          <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:#18181b;font-weight:700;">
            ${echapperHtml(args.offreLabel)}
          </h1>
          ${
            args.message?.trim()
              ? `<div style="margin:0 0 18px;padding:14px 18px;background:#faf7f5;border-left:3px solid #c81e3a;border-radius:0 10px 10px 0;font-size:14.5px;line-height:1.6;color:#3f3f46;font-style:italic;">
                   ${echapperHtml(args.message.trim())}${args.fromName ? `<span style="display:block;margin-top:6px;font-style:normal;font-size:13px;color:#71717a;">— ${echapperHtml(args.fromName)}</span>` : ''}
                 </div>`
              : ''
          }
          <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3f46;">
            ${echapperHtml(args.pitch)}
          </p>
          <div style="margin:0 0 6px;padding:18px;background:#faf7f5;border:1px dashed #c81e3a;border-radius:12px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#71717a;">
              Votre code${args.annuelSeulement ? ' — valable sur l’abonnement annuel' : ''}
            </p>
            <p style="margin:0;font-size:26px;font-weight:800;letter-spacing:.06em;color:#18181b;font-family:ui-monospace,Menlo,monospace;">
              ${args.code}
            </p>
            <p style="margin:6px 0 0;font-size:12px;color:#9a9aa0;">
              Usage unique — valable jusqu'au ${args.expiresLe}
            </p>
          </div>
        </div>
        <div style="padding:12px 36px 26px;text-align:center;">
          <a href="${args.url}" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:12px;">
            ${args.paiementDirect ? "Payer en ligne avec l'offre" : "Créer mon compte avec l'offre"}
          </a>
          <p style="margin:12px 0 0;font-size:12.5px;color:#9a9aa0;">
            ${
              args.paiementDirect
                ? "Le code est pré-appliqué sur la page de paiement. Votre essai n'est pas perdu : le prélèvement démarre à la fin de votre période d'essai en cours — ou immédiatement si elle touche à sa fin."
                : "30 jours d'essai gratuit d'abord, sans carte bancaire — le code s'applique au moment de l'abonnement, sur le site."
            }
          </p>
        </div>
        <div style="padding:16px 36px 22px;border-top:1px solid #f0ece9;">
          <p style="margin:0;font-size:14px;color:#18181b;">
            ${args.fromName ? `${echapperHtml(args.fromName)}, ` : ''}l'équipe Opatam
          </p>
        </div>
      </div>
      <p style="margin:16px 8px 0;text-align:center;font-size:11.5px;line-height:1.5;color:#a7a29e;">
        Vous recevez ce message parce qu'un membre de l'équipe Opatam vous a proposé cette offre.
        Si vous n'êtes pas concerné, ignorez-le simplement.
      </p>
    </div>
  </div>`;

  return { subject, html };
}
