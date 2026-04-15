import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Tarifs — Opatam | Réservation en ligne sans commission',
  description:
    'Découvrez les tarifs Opatam : à partir de 19,90€/mois, sans commission, sans engagement. Plan Pro pour indépendants et Studio pour équipes. Essai gratuit.',
  openGraph: {
    title: 'Tarifs Opatam — À partir de 19,90€/mois',
    description: 'Réservation en ligne sans commission. Plan Pro et Studio. Essai gratuit sans carte bancaire.',
    url: 'https://opatam.com/pricing',
  },
  alternates: {
    canonical: 'https://opatam.com/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
