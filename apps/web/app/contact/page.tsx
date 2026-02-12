import type { Metadata } from 'next';
import ContactPage from './ContactPage';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contactez l\'équipe Opatam. Une question sur la plateforme, un problème technique ou une suggestion ? Nous vous répondons sous 24h.',
  openGraph: {
    title: 'Contactez Opatam',
    description:
      'Une question, un problème ou une suggestion ? Contactez l\'équipe Opatam. Réponse sous 24h.',
    url: 'https://opatam.com/contact',
  },
  twitter: {
    title: 'Contactez Opatam',
    description:
      'Une question, un problème ou une suggestion ? Contactez l\'équipe Opatam.',
  },
  alternates: {
    canonical: 'https://opatam.com/contact',
  },
};

export default function Page() {
  return <ContactPage />;
}
