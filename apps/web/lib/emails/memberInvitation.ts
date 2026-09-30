/**
 * E-mail « rejoignez l'équipe sur Opatam » — le gérant d'un salon Studio
 * invite un membre à se connecter à l'app avec son propre compte.
 *
 * Le lien mène à /rejoindre, où le membre crée son mot de passe (ou se
 * connecte) puis accepte. Valable 7 jours ; un renvoi annule le précédent.
 */

const LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/opatam-da04b.firebasestorage.app/o/assets%2Flogos%2Flogo-email.png?alt=media';

export interface MemberInvitationEmailArgs {
  url: string;
  memberName: string;
  businessName: string;
  expiresAt: Date;
}

function echapper(texte: string, max = 120): string {
  return texte
    .slice(0, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateMemberInvitationEmail(args: MemberInvitationEmailArgs): {
  subject: string;
  html: string;
  text: string;
} {
  const salon = args.businessName.trim().slice(0, 120) || 'votre salon';
  const prenom = args.memberName.trim().split(/\s+/)[0]?.slice(0, 60) || '';
  const jusquau = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(args.expiresAt);
  const subject = `${salon} vous invite sur Opatam`;

  const html = `
  <div style="margin:0;padding:32px 12px;background:#f4f2f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;">
      <div style="text-align:center;padding:0 0 18px;">
        <img src="${LOGO_URL}" alt="Opatam" height="26" style="display:inline-block;" />
      </div>
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2de;box-shadow:0 1px 3px rgba(24,24,27,0.06);">
        <div style="padding:28px 36px 8px;">
          <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#18181b;font-weight:700;">
            ${prenom ? `${echapper(prenom)}, ` : ''}${echapper(salon)} vous ouvre votre espace
          </h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#3f3f46;">
            Avec votre propre compte sur l'application Opatam, vous pourrez :
          </p>
          <ul style="margin:0 0 18px;padding-left:18px;font-size:14.5px;line-height:1.8;color:#3f3f46;">
            <li>consulter <strong>votre agenda</strong> et vos rendez-vous ;</li>
            <li>régler <strong>vos horaires</strong> et vos indisponibilités ;</li>
            <li>créer, déplacer ou annuler <strong>vos rendez-vous</strong>.</li>
          </ul>
        </div>
        <div style="padding:4px 36px 26px;text-align:center;">
          <a href="${args.url}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:12px;">
            Créer mon accès
          </a>
          <p style="margin:12px 0 0;font-size:12.5px;color:#9a9aa0;">
            Lien valable jusqu'au ${jusquau}.
          </p>
        </div>
        <div style="padding:0 36px 26px;">
          <p style="margin:0;padding:14px 16px;background:#f6f7f9;border-radius:10px;font-size:13.5px;line-height:1.6;color:#3f3f46;">
            <strong>Ensuite</strong> : ouvrez l'application Opatam et touchez
            <strong>« Se connecter »</strong> — pas « Créer un compte » — avec cette adresse
            et le mot de passe que vous aurez choisi.
          </p>
        </div>
      </div>
      <p style="margin:16px 8px 0;text-align:center;font-size:11.5px;line-height:1.5;color:#a7a29e;">
        Vous recevez ce message parce que ${echapper(salon)} vous a ajouté à son équipe sur Opatam.
        Si vous n'êtes pas concerné, ignorez-le simplement.
      </p>
    </div>
  </div>`;

  const text = [
    `${prenom ? `${prenom}, ` : ''}${salon} vous ouvre votre espace sur Opatam.`,
    '',
    'Avec votre propre compte sur l’application, vous pourrez consulter votre agenda,',
    'régler vos horaires et gérer vos rendez-vous.',
    '',
    `Créer mon accès : ${args.url}`,
    `(lien valable jusqu'au ${jusquau})`,
    '',
    'Ensuite : ouvrez l’application Opatam et touchez « Se connecter » (pas « Créer un compte »),',
    'avec cette adresse et le mot de passe que vous aurez choisi.',
  ].join('\n');

  return { subject, html, text };
}
