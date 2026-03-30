import type { Metadata } from 'next';
import RecrutementPage from './RecrutementPage';

export const metadata: Metadata = {
  title: 'Rejoignez l\'équipe - Recrutement freelance',
  description:
    'Rejoignez le réseau de freelances Opatam. Nous recherchons des vidéastes, community managers, graphistes et photographes pour des missions rémunérées.',
  openGraph: {
    title: 'Rejoignez l\'équipe Opatam',
    description:
      'Vous êtes freelance, créatif ou expert du digital ? Collaborez avec Opatam sur des missions concrètes et rémunérées.',
    url: 'https://opatam.com/recrutement',
  },
  twitter: {
    title: 'Rejoignez l\'équipe Opatam',
    description:
      'Freelances créatifs et experts du digital, rejoignez le réseau Opatam.',
  },
  alternates: {
    canonical: 'https://opatam.com/recrutement',
  },
};

export default function Page() {
  return <RecrutementPage />;
}
