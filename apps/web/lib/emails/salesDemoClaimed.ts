/**
 * E-mail au COMMERCIAL : un prospect vient de créer son compte depuis sa
 * démonstration. Le moment que tout le travail de démo prépare — il mérite
 * d'être su dans la minute, pas découvert au prochain passage sur le
 * tableau de bord.
 */

const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface DemoClaimedEmailArgs {
  staffName: string | null;
  /** Nom du compte créé (celui saisi à l'inscription). */
  providerName: string;
  /** Nom porté par la démo (peut différer si le prospect l'a changé). */
  demoName: string;
  appUrl: string;
}

export function generateDemoClaimedEmail(args: DemoClaimedEmailArgs): { subject: string; html: string } {
  const subject = `${args.providerName} vient de créer son compte depuis votre démo`;

  const html = `
  <div style="margin:0;padding:24px 12px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6e8;">
      <div style="padding:28px 32px 0;">
        <img src="${LOGO_URL}" alt="Opatam" height="28" style="display:block;" />
        <h1 style="margin:18px 0 0;font-size:21px;line-height:1.3;color:#18181b;font-weight:700;">
          Votre démo a converti
        </h1>
      </div>
      <div style="padding:16px 32px 8px;font-size:15px;line-height:1.6;color:#3f3f46;">
        <p style="margin:0 0 14px;">Bonjour${args.staffName ? ` ${args.staffName}` : ''},</p>
        <p style="margin:0 0 14px;">
          <strong>${args.providerName}</strong> vient de créer son compte Opatam depuis la
          démonstration « ${args.demoName} ». Son essai gratuit de 30 jours démarre
          maintenant — c'est le bon moment pour l'aider à publier sa page et obtenir sa
          première réservation.
        </p>
        <div style="margin:22px 0;">
          <a href="${args.appUrl}/sales" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Ouvrir mon espace commercial</a>
        </div>
        <p style="margin:0 0 24px;color:#18181b;">L'équipe Opatam</p>
      </div>
    </div>
  </div>`;

  return { subject, html };
}
