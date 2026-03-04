/**
 * Request Password Reset (callable)
 * Generates a Firebase password reset link, then sends a branded HTML email via Resend.
 * The link points to the web app's reset password page.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sendPasswordResetEmail } from '../utils/resendService';

/** Web app base URL */
const WEB_URL = 'https://opatam.com';

export const requestPasswordReset = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const email = request.data?.email;

    if (!email || typeof email !== 'string') {
      throw new HttpsError('invalid-argument', 'Email requis');
    }

    const trimmedEmail = email.trim().toLowerCase();

    try {
      // Check if user exists
      const userRecord = await admin.auth().getUserByEmail(trimmedEmail);

      // Generate the Firebase password reset link
      // Use our web app as the action URL
      const firebaseResetLink = await admin.auth().generatePasswordResetLink(
        trimmedEmail,
        { url: `${WEB_URL}/login` }
      );

      // Extract oobCode from the Firebase link and build our own URL
      const url = new URL(firebaseResetLink);
      const oobCode = url.searchParams.get('oobCode');

      if (!oobCode) {
        throw new HttpsError('internal', 'Impossible de générer le lien de réinitialisation');
      }

      // Build link to our web reset page
      const resetLink = `${WEB_URL}/auth/action?mode=resetPassword&oobCode=${oobCode}`;

      // Send branded email via Resend
      const result = await sendPasswordResetEmail({
        email: trimmedEmail,
        resetLink,
        name: userRecord.displayName || undefined,
      });

      if (!result.success) {
        console.error('[PASSWORD_RESET] Email send failed:', result.error);
        throw new HttpsError('internal', "Erreur lors de l'envoi de l'email");
      }

      console.log('[PASSWORD_RESET] Reset email sent to:', trimmedEmail);
      return { success: true };
    } catch (error: any) {
      // If user not found, still return success (don't leak user existence)
      if (error.code === 'auth/user-not-found') {
        console.log('[PASSWORD_RESET] User not found, returning success silently:', trimmedEmail);
        return { success: true };
      }

      // Re-throw HttpsError as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error('[PASSWORD_RESET] Error:', error);
      throw new HttpsError('internal', 'Erreur lors de la réinitialisation');
    }
  }
);
