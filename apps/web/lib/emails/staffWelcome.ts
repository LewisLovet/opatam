/**
 * E-mail d'invitation d'un commercial.
 *
 * Le compte est créé PAR l'administrateur (Admin SDK) — le commercial ne
 * passe jamais par l'inscription publique, qui mènerait à l'expérience
 * client. Cet e-mail porte le lien de définition du mot de passe, dont
 * l'atterrissage est /sales.
 *
 *   - mode 'new'      → compte créé pour lui, lien de mot de passe en CTA
 *   - mode 'existing' → il avait déjà un compte Opatam : mêmes identifiants,
 *                       son espace /sales est simplement ouvert
 */

const APP_URL = 'https://opatam.com';
const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface StaffWelcomeArgs {
  name: string;
  role: 'sales' | 'sales_manager';
  mode: 'new' | 'existing';
  /** Requis quand mode === 'new'. */
  resetLink?: string;
}

export function generateStaffWelcomeEmail(args: StaffWelcomeArgs): { subject: string; html: string } {
  const roleLabel = args.role === 'sales_manager' ? 'responsable commercial' : 'commercial';
  const subject = `Votre espace commercial Opatam est prêt`;

  const cta =
    args.mode === 'new'
      ? `<a href="${args.resetLink}" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Définir mon mot de passe</a>
         <p style="margin:14px 0 0;font-size:13px;color:#71717a;">Ce lien est personnel et expire — si c'est le cas, utilisez « Mot de passe oublié » sur la page de connexion.</p>`
      : `<a href="${APP_URL}/sales" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Ouvrir mon espace</a>
         <p style="margin:14px 0 0;font-size:13px;color:#71717a;">Connectez-vous avec vos identifiants Opatam habituels.</p>`;

  const html = `
  <div style="margin:0;padding:24px 12px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e6e8;">
      <div style="padding:28px 32px 0;">
        <img src="${LOGO_URL}" alt="Opatam" height="28" style="display:block;" />
        <h1 style="margin:18px 0 0;font-size:21px;line-height:1.3;color:#18181b;font-weight:700;">
          Bienvenue dans l'équipe commerciale
        </h1>
      </div>
      <div style="padding:16px 32px 8px;font-size:15px;line-height:1.6;color:#3f3f46;">
        <p style="margin:0 0 14px;">Bonjour ${args.name},</p>
        <p style="margin:0 0 14px;">
          Votre accès ${roleLabel} à Opatam vient d'être ouvert. Votre espace regroupe vos
          prospects, votre pipeline et vos outils de démonstration.
        </p>
        <div style="margin:22px 0;">${cta}</div>
        <p style="margin:0 0 24px;color:#18181b;">L'équipe Opatam</p>
      </div>
      <div style="padding:14px 32px 22px;border-top:1px solid #ededf0;">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9a9aa0;">
          Opatam — accès réservé à l'équipe. Si vous n'attendiez pas cette invitation,
          ignorez simplement ce message.
        </p>
      </div>
    </div>
  </div>`;

  return { subject, html };
}
