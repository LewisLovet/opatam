import { NextRequest, NextResponse } from 'next/server';
import { getResend, emailConfig, isValidEmail, getEmailWrapperHtml } from '@/lib/resend';

const CONTACT_EMAIL = 'contact@opatam.com';

const PROFILE_LABELS: Record<string, string> = {
  'vidéaste': 'Vidéaste',
  'community-manager': 'Community Manager',
  'graphiste': 'Graphiste / Designer',
  'photographe': 'Photographe',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, phone, city, profile, portfolio, message } = body;

    // Validation
    if (!firstName || !lastName || !email || !phone || !city || !profile || !message) {
      return NextResponse.json({ error: 'Tous les champs obligatoires doivent être remplis.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message trop long (max 5000 caractères).' }, { status: 400 });
    }

    const profileLabel = PROFILE_LABELS[profile] || profile;
    const resend = getResend();
    const fullName = `${firstName} ${lastName}`;

    // 1. Send notification to contact@opatam.com
    await resend.emails.send({
      from: emailConfig.from,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[Candidature] ${profileLabel} — ${fullName}`,
      html: getEmailWrapperHtml(`
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Nouvelle candidature freelance</p>
            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Nom</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right; color: #3f3f46;">
                  ${escapeHtml(fullName)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Email</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right;">
                  <a href="mailto:${escapeHtml(email)}" style="color: #6366f1; text-decoration: none;">${escapeHtml(email)}</a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Téléphone</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right; color: #3f3f46;">
                  ${escapeHtml(phone)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Ville</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right; color: #3f3f46;">
                  ${escapeHtml(city)}
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Profil</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right; color: #3f3f46;">
                  ${escapeHtml(profileLabel)}
                </td>
              </tr>
              ${portfolio ? `
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Portfolio</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right;">
                  <a href="${escapeHtml(portfolio)}" style="color: #6366f1; text-decoration: none;">${escapeHtml(portfolio)}</a>
                </td>
              </tr>
              ` : ''}
            </table>
            <div style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e4e4e7;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Présentation</p>
              <p style="margin: 0; font-size: 14px; color: #18181b; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
            </div>
          </td>
        </tr>
      `),
    });

    // 2. Send confirmation to the applicant
    await resend.emails.send({
      from: emailConfig.from,
      replyTo: CONTACT_EMAIL,
      to: email,
      subject: 'Candidature reçue — Opatam',
      html: getEmailWrapperHtml(`
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">Bonjour ${escapeHtml(firstName)},</p>
            <p style="margin: 0 0 16px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
              Nous avons bien reçu votre candidature en tant que <strong>${escapeHtml(profileLabel)}</strong>.
              Nous examinerons votre profil avec attention et reviendrons vers vous si votre candidature correspond à nos besoins actuels.
            </p>
            <p style="margin: 0; font-size: 14px; color: #3f3f46; line-height: 1.6;">
              En attendant, n'hésitez pas à nous contacter à <a href="mailto:contact@opatam.com" style="color: #6366f1; text-decoration: none;">contact@opatam.com</a> pour toute question.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px 32px; border-top: 1px solid #e4e4e7;">
            <p style="margin: 0; font-size: 14px; color: #71717a; text-align: center;">
              À bientôt,<br>
              <strong>L'équipe Opatam</strong>
            </p>
          </td>
        </tr>
      `),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recrutement API error:', error);
    return NextResponse.json({ error: "Erreur lors de l'envoi de la candidature." }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
