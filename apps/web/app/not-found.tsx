import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Home, Search, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Page introuvable',
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-160px)] bg-white flex items-center">
        <section className="relative overflow-hidden w-full">
          {/* Decorative blobs */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-indigo-100/40 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-blue-100/40 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 text-center">
            {/* 404 large number */}
            <div className="mb-6">
              <span className="text-[8rem] sm:text-[10rem] font-bold leading-none tracking-tight bg-gradient-to-b from-indigo-200 to-indigo-400/40 bg-clip-text text-transparent select-none">
                404
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-4">
              Page introuvable
            </h1>
            <p className="text-lg text-gray-600 max-w-md mx-auto mb-10">
              La page que vous recherchez n&apos;existe pas ou a été déplacée.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
              >
                <Home className="w-4 h-4" />
                Retour à l&apos;accueil
              </Link>
              <Link
                href="/recherche"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
              >
                <Search className="w-4 h-4" />
                Rechercher un professionnel
              </Link>
            </div>

            {/* Help links */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500">
              <Link
                href="/contact"
                className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Contactez-nous
              </Link>
              <span className="hidden sm:inline text-gray-300">|</span>
              <Link
                href="/#faq"
                className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Consultez la FAQ
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
