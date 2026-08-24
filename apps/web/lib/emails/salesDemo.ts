/**
 * E-mail « votre page de démonstration » — envoyé par un commercial à un
 * prospect depuis la fiche d'une démo.
 *
 * Le message est court à dessein : la démonstration EST l'argument. L'e-mail
 * s'ouvre sur la photo de couverture de la démo — celle que le prospect
 * reconnaîtra comme « chez lui » — et n'a qu'un seul appel à l'action.
 * Tout est en styles inline : les clients mail ignorent le reste.
 */

const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface SalesDemoEmailArgs {
  businessName: string;
  demoUrl: string;
  /** Photo de couverture de la démo (téléversée ou du secteur). */
  coverUrl?: string | null;
  /** Jour d'expiration du lien, déjà formaté (ex. « 23 septembre 2026 »). */
  expiresLe: string;
  /** Nom du commercial, pour signer. */
  fromName?: string | null;
  /** Mot personnel du commercial, texte brut — échappé ici avant insertion. */
  message?: string | null;
}

/** Le message vient d'un champ libre : tout HTML y est du texte, jamais du code. */
function echapperHtml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br />');
}

export function generateSalesDemoEmail(args: SalesDemoEmailArgs): { subject: string; html: string } {
  const subject = `Votre future page de réservation est prête — ${args.businessName}`;
  const nom = echapperHtml(args.businessName);

  const html = `
  <div style="margin:0;padding:32px 12px;background:#f4f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <!-- préheader invisible : la ligne sous l'objet dans la boîte de réception -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
      Vos prestations, vos tarifs, la réservation en ligne — parcourez votre page d'essai.
    </div>
    <div style="max-width:560px;margin:0 auto;">
      <div style="text-align:center;padding:0 0 18px;">
        <img src="${LOGO_URL}" alt="Opatam" height="26" style="display:inline-block;" />
      </div>

      <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2de;box-shadow:0 1px 3px rgba(24,24,27,0.06);">
        ${
          args.coverUrl
            ? `<a href="${args.demoUrl}" style="display:block;">
                 <img src="${args.coverUrl}" alt="" width="560" style="display:block;width:100%;height:190px;object-fit:cover;" />
               </a>`
            : ''
        }
        <div style="padding:28px 36px 8px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c81e3a;">
            Démonstration personnalisée
          </p>
          <h1 style="margin:0 0 14px;font-size:23px;line-height:1.25;color:#18181b;font-weight:700;">
            ${nom}, voici votre page&nbsp;de&nbsp;réservation
          </h1>
          ${
            args.message?.trim()
              ? `<div style="margin:0 0 18px;padding:14px 18px;background:#faf7f5;border-left:3px solid #c81e3a;border-radius:0 10px 10px 0;font-size:14.5px;line-height:1.6;color:#3f3f46;font-style:italic;">
                   ${echapperHtml(args.message.trim())}${args.fromName ? `<span style="display:block;margin-top:6px;font-style:normal;font-size:13px;color:#71717a;">— ${echapperHtml(args.fromName)}</span>` : ''}
                 </div>`
              : ''
          }
          <p style="margin:0 0 8px;font-size:15px;line-height:1.65;color:#3f3f46;">
            Nous l'avons préparée avec vos prestations et vos tarifs, tels qu'ils
            apparaîtront à vos clientes. Parcourez-la, ouvrez une prestation,
            testez une réservation — rien n'est réel, cette page est là pour l'essayer.
          </p>
        </div>

        <div style="padding:10px 36px 26px;text-align:center;">
          <a href="${args.demoUrl}" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:12px;">
            Découvrir ma page
          </a>
          <p style="margin:12px 0 0;font-size:12.5px;color:#9a9aa0;">
            Lien actif jusqu'au ${args.expiresLe} — aucune inscription requise pour regarder.
          </p>
        </div>

        <div style="padding:18px 36px 22px;border-top:1px solid #f0ece9;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#3f3f46;">
            Si elle vous plaît, un bouton sur la page crée votre compte avec tout
            déjà en place — <strong>30&nbsp;jours d'essai gratuit, sans carte bancaire</strong>.
          </p>
          <p style="margin:12px 0 0;font-size:14px;color:#18181b;">
            ${args.fromName ? `${echapperHtml(args.fromName)}, ` : ''}l'équipe Opatam
          </p>
        </div>
      </div>

      <p style="margin:16px 8px 0;text-align:center;font-size:11.5px;line-height:1.5;color:#a7a29e;">
        Vous recevez ce message parce qu'un membre de l'équipe Opatam a préparé cette
        démonstration pour vous. Si vous n'êtes pas concerné, ignorez-le simplement.
      </p>
    </div>
  </div>`;

  return { subject, html };
}
