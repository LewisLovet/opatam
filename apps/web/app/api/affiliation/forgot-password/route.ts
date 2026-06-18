import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import {
  resend,
  emailConfig,
  appConfig,
  getEmailWrapperHtml,
  isValidEmail,
} from '@/lib/resend';

/**
 * POST /api/affiliation/forgot-password
 *
 * Self-service password reset for AFFILIATES.
 *
 * Why a dedicated route (instead of the shared `requestPasswordReset` callable):
 * the callable routes the user through `/auth/action`, whose post-reset
 * "Se connecter" button lands on the PRO `/login`. An affiliate has no provider
 * account, so that's a dead-end for them. Here we build the reset link with
 * `next=/affiliation/login`, so after setting a new password they're sent back
 * to their own login — consistent with the affiliate welcome email.
 *
 * Always returns `{ success: true }` (no account enumeration).
 */
export async function POST(request: NextRequest) {
  // Generic response used in every branch — never reveals whether the account
  // exists, is an affiliate, or anything else.
  const generic = NextResponse.json({ success: true });

  let email: string | undefined;
  try {
    const body = await request.json();
    email = typeof body?.email === 'string' ? body.email : undefined;
  } catch {
    return generic;
  }

  if (!email || !isValidEmail(email)) return generic;
  const trimmedEmail = email.trim().toLowerCase();

  try {
    const auth = getAdminAuth();

    // Only send a reset to people who are actually affiliates. A non-affiliate
    // who lands here (e.g. a pro typing their email) should use the pro flow;
    // we stay silent either way (no enumeration).
    let user;
    try {
      user = await auth.getUserByEmail(trimmedEmail);
    } catch {
      return generic; // unknown email
    }

    const { getAdminFirestore } = await import('@/lib/firebase-admin');
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || !userDoc.data()?.affiliateId) {
      return generic; // not an affiliate — silently ignore
    }

    // Generate a Firebase reset oobCode, then route it through our own branded
    // /auth/action page with next=/affiliation/login so the post-reset CTA goes
    // back to the affiliate login (not the pro one).
    const fbLink = await auth.generatePasswordResetLink(trimmedEmail, {
      url: `${appConfig.url}/affiliation/login`,
    });
    const oobCode = new URL(fbLink).searchParams.get('oobCode');
    if (!oobCode) return generic;

    const resetLink = `${appConfig.url}/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(
      oobCode
    )}&next=${encodeURIComponent('/affiliation/login')}`;

    const content = `
      <tr>
        <td style="padding: 8px 32px 32px;">
          <h1 style="margin: 0 0 16px; font-size: 22px; color: #18181b;">Réinitialisez votre mot de passe</h1>
          <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #3f3f46;">
            Vous avez demandé à réinitialiser le mot de passe de votre espace affilié Opatam.
            Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
          </p>
          <table role="presentation" style="margin: 0 auto;">
            <tr>
              <td align="center" style="border-radius: 8px; background-color: #4f46e5;">
                <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">
                  Choisir un nouveau mot de passe
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 24px 0 0; font-size: 13px; line-height: 1.6; color: #71717a;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email — votre mot de passe restera inchangé.
          </p>
        </td>
      </tr>
    `;

    await resend.emails.send({
      from: emailConfig.from,
      to: trimmedEmail,
      subject: 'Réinitialisez votre mot de passe affilié Opatam',
      html: getEmailWrapperHtml(content),
    });
  } catch (err) {
    // Swallow everything — the response must stay generic regardless.
    console.error('[affiliation/forgot-password] error (non-blocking):', err);
  }

  return generic;
}
