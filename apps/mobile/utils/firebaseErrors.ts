/**
 * Firebase Error Messages
 * Maps Firebase error codes to French user-friendly messages
 */

export function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cet email est déjà utilisé';
    case 'auth/invalid-email':
      return "Format d'email invalide";
    case 'auth/weak-password':
      return 'Le mot de passe est trop faible';
    case 'auth/user-not-found':
      return 'Aucun compte associé à cet email';
    case 'auth/wrong-password':
      return 'Mot de passe incorrect';
    case 'auth/invalid-credential':
      return 'Email ou mot de passe incorrect';
    case 'auth/too-many-requests':
      return 'Trop de tentatives, réessayez plus tard';
    case 'auth/network-request-failed':
      return 'Erreur de connexion';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé';
    default:
      return 'Une erreur est survenue';
  }
}
