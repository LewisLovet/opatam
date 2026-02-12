import type { Metadata } from 'next';
import DownloadAppPage from './DownloadPage';

export const metadata: Metadata = {
  title: 'Télécharger l\'application',
  description:
    'Téléchargez l\'application Opatam sur iOS et Android. Réservez vos rendez-vous beauté et bien-être en quelques clics depuis votre smartphone.',
  openGraph: {
    title: 'Télécharger l\'application Opatam',
    description:
      'Réservez vos rendez-vous beauté et bien-être en quelques clics depuis votre smartphone.',
    url: 'https://opatam.com/telechargement',
  },
  twitter: {
    title: 'Télécharger l\'application Opatam',
    description:
      'Réservez vos rendez-vous beauté et bien-être en quelques clics depuis votre smartphone.',
  },
  alternates: {
    canonical: 'https://opatam.com/telechargement',
  },
};

export default function Page() {
  return <DownloadAppPage />;
}
