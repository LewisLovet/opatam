import type { Metadata } from 'next';
import LandingPage from './HomePage';

export const metadata: Metadata = {
  title: 'Opatam - Réservation en ligne pour entrepreneurs',
  description:
    'Opatam est la plateforme de réservation en ligne sans commission. Gérez vos rendez-vous, attirez de nouveaux clients et développez votre activité. Essai gratuit 30 jours.',
  openGraph: {
    title: 'Opatam - Réservation en ligne pour entrepreneurs',
    description:
      'Gérez vos rendez-vous en ligne, attirez de nouveaux clients et développez votre activité. Sans commission. Essai gratuit 30 jours.',
    url: 'https://opatam.com',
  },
  twitter: {
    title: 'Opatam - Réservation en ligne pour entrepreneurs',
    description:
      'Gérez vos rendez-vous en ligne, attirez de nouveaux clients et développez votre activité. Sans commission.',
  },
  alternates: {
    canonical: 'https://opatam.com',
  },
};

export default function Page() {
  return <LandingPage />;
}
