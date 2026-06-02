/**
 * Request Email Change (callable)
 *
 * Generates a Firebase "verify and change email" link with the Admin SDK and
 * sends it to the NEW address via Resend. Done server-side — exactly like
 * requestPasswordReset — to avoid the client-side reCAPTCHA path that
 * `verifyBeforeUpdateEmail` requires (it fails with auth/error-code:-26 when
 * reCAPTCHA isn't configured for the web app).
 *
 * The user's CURRENT email is read from their auth record (never trusted from
 * the client). The caller must be authenticated; the web form also re-asks for
 * the password (client-side reauthentication) before calling this.
 *
 * Link target: /auth/action?mode=verifyAndChangeEmail&oobCode=… — handled by
 * the existing AuthActionPage, which applies the code and signs the user out.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { sendEmailChangeEmail } from '../utils/resendService';

const WEB_URL = 'https://opatam.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const requestEmailChange = onCall(
  { region: 'europe-west1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Authentification requise');
    }

    const raw = request.data?.newEmail;
    if (!raw || typeof raw !== 'string' || !EMAIL_RE.test(raw.trim())) {
      throw new HttpsError('invalid-argument', 'Adresse email invalide');
    }
    const newEmail = raw.trim().toLowerCase();

    try {
      const userRecord = await admin.auth().getUser(uid);
      const currentEmail = userRecord.email;
      if (!currentEmail) {
        throw new HttpsError('failed-precondition', 'Compte sans adresse email');
      }
      if (currentEmail.toLowerCase() === newEmail) {
        throw new HttpsError(
          'invalid-argument',
          "La nouvelle adresse est identique à l'actuelle",
        );
      }

      // Reject if the new address already belongs to another account.
      try {
        const existing = await admin.auth().getUserByEmail(newEmail);
        if (existing && existing.uid !== uid) {
          throw new HttpsError('already-exists', 'Cette adresse email est déjà utilisée');
        }
      } catch (lookupErr: any) {
        if (lookupErr instanceof HttpsError) throw lookupErr;
        if (lookupErr?.code !== 'auth/user-not-found') throw lookupErr;
        // user-not-found → the address is free, continue.
      }

      // Generate the verify-and-change link (server-side, no reCAPTCHA).
      const firebaseLink = await admin
        .auth()
        .generateVerifyAndChangeEmailLink(currentEmail, newEmail, {
          url: `${WEB_URL}/login`,
        });
      const oobCode = new URL(firebaseLink).searchParams.get('oobCode');
      if (!oobCode) {
        throw new HttpsError('internal', 'Impossible de générer le lien de confirmation');
      }

      const changeLink = `${WEB_URL}/auth/action?mode=verifyAndChangeEmail&oobCode=${oobCode}`;

      const result = await sendEmailChangeEmail({
        email: newEmail,
        changeLink,
        name: userRecord.displayName || undefined,
      });
      if (!result.success) {
        console.error('[EMAIL_CHANGE] Email send failed:', result.error);
        throw new HttpsError('internal', "Erreur lors de l'envoi de l'email");
      }

      console.log(`[EMAIL_CHANGE] Verification sent for ${uid} → ${newEmail}`);
      return { success: true };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      if (error?.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Cette adresse email est déjà utilisée');
      }
      console.error('[EMAIL_CHANGE] Error:', error);
      throw new HttpsError('internal', "Erreur lors du changement d'adresse email");
    }
  },
);
