'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StripeDataProvider } from './StripeDataContext';

/**
 * Le titre de chaque vue.
 *
 * La navigation entre ces pages vit dans la sidebar, sous « Stripe » : une
 * barre d'onglets ici ferait un second niveau de menu à trois centimètres du
 * premier. Il reste à cette page de dire OÙ l'on est.
 */
const TITRES: Record<string, { titre: string; sous: string }> = {
  '/admin/stripe': {
    titre: 'Vue consolidée',
    sous: "Le résultat de la période, et le lien vers ce qui le compose.",
  },
  '/admin/stripe/revenus': {
    titre: 'Revenus',
    sous: 'Ce qui entre vraiment : abonnements et Pack sérénité, hors essais et hors codes gratuits.',
  },
  '/admin/stripe/frais': {
    titre: 'Frais',
    sous: 'Ce que Stripe prélève, par poste et par mois, jusqu’à la transaction.',
  },
  '/admin/stripe/transactions': {
    titre: 'Transactions',
    sous: 'Le relevé brut, filtrable.',
  },
};

export default function StripeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const entete = TITRES[pathname] ?? TITRES['/admin/stripe'];

  return (
    <StripeDataProvider>
      <div className="p-6 max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Stripe</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{entete.titre}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{entete.sous}</p>
        </div>

        {children}
      </div>
    </StripeDataProvider>
  );
}
