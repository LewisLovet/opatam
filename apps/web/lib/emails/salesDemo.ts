/**
 * E-mail « votre page de démonstration » — envoyé par un commercial à un
 * prospect depuis /sales/demo.
 *
 * Le message reste court à dessein : la démonstration EST l'argument. Un seul
 * appel à l'action, ouvrir sa page ; l'inscription se joue sur la page même,
 * qui porte le CTA attribué au commercial.
 */

const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface SalesDemoEmailArgs {
  businessName: string;
  demoUrl: string;
  /** Jour d'expiration du lien, déjà formaté (ex. « 23 septembre 2026 »). */
  expiresLe: string;
  /** Nom du commercial, pour signer. */
  fromName?: string | null;
}

export function generateSalesDemoEmail(args: SalesDemoEmailArgs): { subject: string; html: string } {
  const subject = `${args.businessName} — votre future page de réservation est prête`;

  const html = `
  <div style="margin:0;padding:24px 12px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6e8;">
      <div style="padding:28px 32px 0;">
        <img src="${LOGO_URL}" alt="Opatam" height="28" style="display:block;" />
        <h1 style="margin:18px 0 0;font-size:21px;line-height:1.3;color:#18181b;font-weight:700;">
          Voici à quoi ressemblerait ${args.businessName} sur Opatam
        </h1>
      </div>
      <div style="padding:16px 32px 8px;font-size:15px;line-height:1.6;color:#3f3f46;">
        <p style="margin:0 0 14px;">Bonjour,</p>
        <p style="margin:0 0 14px;">
          Nous avons préparé une démonstration de votre page de réservation, avec vos
          prestations et vos tarifs. Parcourez-la, testez une réservation — rien n'est
          réel, c'est votre page pour l'essayer.
        </p>
        <div style="margin:22px 0;">
          <a href="${args.demoUrl}" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Voir ma page de démonstration</a>
          <p style="margin:14px 0 0;font-size:13px;color:#71717a;">Ce lien reste actif jusqu'au ${args.expiresLe}.</p>
        </div>
        <p style="margin:0 0 14px;">
          Si elle vous plaît, vous pourrez la valider en deux clics depuis la page :
          votre compte se crée avec vos prestations déjà en place, et l'essai est
          gratuit pendant 30 jours, sans carte bancaire.
        </p>
        <p style="margin:0 0 24px;color:#18181b;">${args.fromName ? `${args.fromName}, ` : ''}l'équipe Opatam</p>
      </div>
      <div style="padding:14px 32px 22px;border-top:1px solid #ededf0;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9a9aa0;">
          Vous recevez ce message parce qu'un membre de l'équipe Opatam a préparé cette
          démonstration pour vous. Si vous n'êtes pas concerné, ignorez-le simplement.
        </p>
      </div>
    </div>
  </div>`;

  return { subject, html };
}
