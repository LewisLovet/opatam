'use client';

import { formatPrice } from '@booking-app/shared';

interface ClientEntry {
  clientHash: string;
  bookingsCount: number;
  revenue: number;
  /**
   * Display name resolved from the providerClients collection. The
   * page hydrates this before passing into the panel — the rolling
   * snapshot only carries hashes for privacy.
   */
  name?: string;
}

interface Props {
  data: ClientEntry[];
}

export function TopClientsPanel({ data }: Props) {
  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Top clients
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Par CA cumulé
        </p>
      </header>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Aucun client identifié sur la période.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {data.slice(0, 5).map((c, i) => (
            <li
              key={c.clientHash}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-4">
                {i + 1}
              </span>
              <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {(c.name ?? c.clientHash).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {c.name ?? maskHash(c.clientHash)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {c.bookingsCount} RDV
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
                {formatPrice(c.revenue)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** `email:foo@bar.com` → `f***@bar.com` for the (rare) case the
 *  page can't resolve a name from providerClients.
 */
function maskHash(hash: string): string {
  if (hash.startsWith('email:')) {
    const [user, domain] = hash.slice(6).split('@');
    if (!user || !domain) return hash.slice(6);
    return `${user[0]}***@${domain}`;
  }
  return hash;
}
