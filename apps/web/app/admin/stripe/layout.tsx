'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StripeDataProvider } from './StripeDataContext';

const ONGLETS = [
  { href: '/admin/stripe', label: 'Vue consolidée' },
  { href: '/admin/stripe/revenus', label: 'Revenus' },
  { href: '/admin/stripe/frais', label: 'Frais' },
  { href: '/admin/stripe/transactions', label: 'Transactions' },
];

export default function StripeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <StripeDataProvider>
      <div className="p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stripe</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ce qui entre, ce que ça coûte, et d&apos;où vient chaque euro.
          </p>
        </div>

        <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-8 -mx-1 overflow-x-auto">
          {ONGLETS.map((o) => {
            // Comparaison exacte : `startsWith` marquerait « Vue consolidée »
            // comme actif sur toutes les sous-pages, son chemin étant leur préfixe.
            const actif = pathname === o.href;
            return (
              <Link
                key={o.href}
                href={o.href}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  actif
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </StripeDataProvider>
  );
}
