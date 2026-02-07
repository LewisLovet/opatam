'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dev/tests', label: 'Index' },
  { href: '/dev/tests/firebase-connection', label: 'Firebase' },
  { href: '/dev/tests/users', label: 'Users' },
  { href: '/dev/tests/providers', label: 'Providers' },
  { href: '/dev/tests/members', label: 'Members' },
  { href: '/dev/tests/locations', label: 'Locations' },
  { href: '/dev/tests/prestations', label: 'Prestations' },
  { href: '/dev/tests/availability', label: 'Availability' },
  { href: '/dev/tests/bookings', label: 'Bookings' },
  { href: '/dev/tests/services', label: 'Services' },
  { href: '/dev/tests/stripe', label: 'Stripe' },
];

export default function TestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      {/* Horizontal Tab Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800/50 sticky top-0 lg:top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== '/dev/tests' && pathname.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${isActive
                      ? 'bg-purple-500/15 text-purple-300'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }
                  `}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
