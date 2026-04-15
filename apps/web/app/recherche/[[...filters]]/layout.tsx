import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rechercher un professionnel — Opatam',
  description:
    'Trouvez et réservez un professionnel près de chez vous : coiffeur, esthéticienne, masseur, coach, consultant. Réservation en ligne, avis clients, disponibilités en temps réel.',
  openGraph: {
    title: 'Rechercher un professionnel — Opatam',
    description: 'Trouvez et réservez un professionnel près de chez vous. Réservation en ligne sur Opatam.',
    url: 'https://opatam.com/recherche',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
