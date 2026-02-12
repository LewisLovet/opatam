import { NextRequest, NextResponse } from 'next/server';
import { getResend, emailConfig, isValidEmail, getEmailWrapperHtml } from '@/lib/resend';

const CONTACT_EMAIL = 'contact@opatam.com';

const SUBJECT_LABELS: Record<string, string> = {
  general: 'Question générale',
  support: 'Support technique',
  partnership: 'Partenariat',
  press: 'Presse',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'Tous les champs sont requis.' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message trop long (max 5000 caractères).' }, { status: 400 });
    }

    const subjectLabel = SUBJECT_LABELS[subject] || 'Contact';
    const resend = getResend();

    // 1. Send notification to contact@opatam.com
    await resend.emails.send({
      from: emailConfig.from,
      to: CONTACT_EMAIL,
      replyTo: email,
      subject: `[${subjectLabel}] Nouveau message de ${name}`,
      html: getEmailWrapperHtml(`
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Nouveau message depuis le formulaire de contact</p>
            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5;">
                  <strong style="color: #18181b;">Nom</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right; color: #3f3f46;">
                  ${escapeHtml(name)}
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
                  <strong style="color: #18181b;">Sujet</strong>
                </td>
                <td style="padding: 8px 0; border-bottom: 1px solid #f4f4f5; text-align: right; color: #3f3f46;">
                  ${escapeHtml(subjectLabel)}
                </td>
              </tr>
            </table>
            <div style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e4e4e7;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Message</p>
              <p style="margin: 0; font-size: 14px; color: #18181b; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
            </div>
          </td>
        </tr>
      `),
    });

    // 2. Send confirmation to the user
    await resend.emails.send({
      from: emailConfig.from,
      replyTo: CONTACT_EMAIL,
      to: email,
      subject: 'Nous avons bien reçu votre message - Opatam',
      html: getEmailWrapperHtml(`
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 16px; font-size: 16px; color: #18181b;">Bonjour ${escapeHtml(name)},</p>
            <p style="margin: 0 0 16px; font-size: 14px; color: #3f3f46; line-height: 1.6;">
              Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais (généralement sous 24h en jours ouvrés).
            </p>
            <div style="padding: 16px; background-color: #f9fafb; border-radius: 8px; border: 1px solid #e4e4e7; margin-bottom: 16px;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Votre message</p>
              <p style="margin: 0; font-size: 14px; color: #18181b; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
            </div>
            <p style="margin: 0; font-size: 14px; color: #3f3f46; line-height: 1.6;">
              Si votre demande est urgente, vous pouvez nous répondre directement à cet email.
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
    console.error('Contact API error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du message.' }, { status: 500 });
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
