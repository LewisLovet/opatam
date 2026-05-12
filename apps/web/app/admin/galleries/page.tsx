'use client';

/**
 * /admin/galleries — index of the vertical-landing galleries.
 *
 * One row per vertical landing page that has a "Vos créations"
 * marquee fed from Firestore. Today only `/nail-artist` is in flight;
 * future verticals (coiffeur, barbier, …) get added to VERTICALS
 * below.
 *
 * Why a hardcoded list (rather than a dynamic listing of Firestore
 * docs): the verticals correspond to actual page routes we ship, so
 * the source of truth lives in code. The Firestore docs can be empty
 * (admin hasn't populated yet) without us losing them from the
 * dashboard.
 */
import Link from 'next/link';
import { Images, ChevronRight } from 'lucide-react';

interface Vertical {
  /** Firestore doc id + landing route slug. */
  slug: string;
  /** Display name in the admin. */
  label: string;
  /** Public landing URL preview. */
  publicPath: string;
}

const VERTICALS: Vertical[] = [
  {
    slug: 'nail-artist',
    label: 'Nail artist',
    publicPath: '/nail-artist',
  },
];

export default function AdminGalleriesIndex() {
  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Galeries landings
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
          Gérez les images affichées dans la bande « Vos créations » de chaque
          landing métier. Une galerie par vertical — uploadez des photos ou
          collez des URLs (Firebase Storage, CDN externe, etc.).
        </p>
      </header>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {VERTICALS.map((v, idx) => (
          <Link
            key={v.slug}
            href={`/admin/galleries/${v.slug}`}
            className={`flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
              idx > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 flex items-center justify-center">
                <Images className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {v.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Landing publique :{' '}
                  <a
                    href={v.publicPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-primary-700 dark:hover:text-primary-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    opatam.com{v.publicPath}
                  </a>
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
