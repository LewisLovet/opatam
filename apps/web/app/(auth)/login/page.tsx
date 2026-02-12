import type { Metadata } from 'next';
import LoginPage from './LoginPage';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre espace professionnel Opatam pour gérer vos rendez-vous et votre activité.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LoginPage />;
}
