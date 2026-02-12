import type { Metadata } from 'next';
import ForgotPasswordPage from './ForgotPasswordPage';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  description: 'Réinitialisez votre mot de passe Opatam. Recevez un lien de réinitialisation par email.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ForgotPasswordPage />;
}
