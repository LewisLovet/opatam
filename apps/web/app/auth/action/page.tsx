import type { Metadata } from 'next';
import AuthActionPage from './AuthActionPage';

export const metadata: Metadata = {
  title: 'Réinitialiser votre mot de passe - Opatam',
  description: 'Choisissez un nouveau mot de passe pour votre compte Opatam.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AuthActionPage />;
}
