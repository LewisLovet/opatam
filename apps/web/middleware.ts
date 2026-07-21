import { NextRequest, NextResponse } from 'next/server';

/**
 * i18n URL prefix — HEADER ONLY, deliberately no rewrite/redirect.
 *
 * The English versions of the public pages live under real `/en/...` routes
 * (thin re-exports of the French pages). This middleware only tags those
 * requests with `x-app-locale: en` so i18n/request.ts — and therefore
 * getLocale(), every useTranslations() and the root <html lang> — resolve to
 * English for the whole tree, without moving app/ under a [locale] segment.
 *
 * The matcher is restricted to /en paths: zero overhead (and zero risk) for
 * everything else (/, /pro, /admin, /api…).
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Locale déduite du préfixe d'URL (/en/... → en, /it/... → it).
  const seg = request.nextUrl.pathname.split('/')[1];
  requestHeaders.set('x-app-locale', seg === 'it' ? 'it' : 'en');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/en', '/en/:path*', '/it', '/it/:path*'],
};
