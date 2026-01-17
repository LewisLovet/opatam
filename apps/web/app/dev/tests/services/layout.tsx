'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const serviceTestPages = [
  { href: '/dev/tests/services', label: 'Index' },
  { href: '/dev/tests/services/auth', label: 'Auth' },
  { href: '/dev/tests/services/provider', label: 'Provider' },
  { href: '/dev/tests/services/members', label: 'Members' },
  { href: '/dev/tests/services/catalog', label: 'Catalog' },
  { href: '/dev/tests/services/scheduling', label: 'Scheduling' },
  { href: '/dev/tests/services/bookings', label: 'Bookings' },
];

export default function ServicesTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dev/tests"
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          &larr; Retour aux tests
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {serviceTestPages.map((page) => {
          const isActive = pathname === page.href;
          return (
            <Link
              key={page.href}
              href={page.href}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {page.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
