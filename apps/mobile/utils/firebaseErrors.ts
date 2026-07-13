/**
 * Firebase Error Messages
 * Maps Firebase error codes to localized user-friendly messages
 */

import i18n from '../lib/i18n';

const ERROR_CODE_TO_KEY: Record<string, string> = {
  'auth/email-already-in-use': 'errors.auth.emailAlreadyInUse',
  'auth/invalid-email': 'errors.auth.invalidEmail',
  'auth/weak-password': 'errors.auth.weakPassword',
  'auth/user-not-found': 'errors.auth.userNotFound',
  'auth/wrong-password': 'errors.auth.wrongPassword',
  'auth/invalid-credential': 'errors.auth.invalidCredential',
  'auth/too-many-requests': 'errors.auth.tooManyRequests',
  'auth/network-request-failed': 'errors.auth.networkRequestFailed',
  'auth/user-disabled': 'errors.auth.userDisabled',
};

export function getFirebaseErrorMessage(code: string): string {
  // t() is called at message-production time so the current language applies
  return i18n.t(ERROR_CODE_TO_KEY[code] ?? 'common.error');
}
