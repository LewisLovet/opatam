/**
 * ClarityScript — Microsoft Clarity tag injector.
 *
 * Loads only when `NEXT_PUBLIC_CLARITY_PROJECT_ID` is defined, so
 * local dev (and any environment without the env var) ships
 * nothing extra. Strategy `afterInteractive` defers the network
 * call until after hydration so it never competes with the LCP.
 *
 * Setup:
 *  1. Create a project at https://clarity.microsoft.com (free, no
 *     event limits).
 *  2. Copy the project ID (looks like `abcd1234ef`).
 *  3. Add to Vercel env (Production + Preview):
 *       NEXT_PUBLIC_CLARITY_PROJECT_ID=abcd1234ef
 *
 * Privacy notes:
 *  - Clarity by default masks form inputs and personally-identifying
 *    text. This is the GDPR-friendly default we rely on.
 *  - Sessions are anonymous unless we explicitly call
 *    `clarity('identify', userId)`. We do NOT do that here — keep
 *    Clarity for behaviour analytics, send identified events to
 *    PostHog / GA instead.
 */

'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

export function ClarityScript() {
  const pathname = usePathname();
  if (!CLARITY_PROJECT_ID) return null;

  // Skip Clarity on the authenticated app surfaces (pro + admin). Its session
  // recording (DOM mutation observers) adds noticeable CPU overhead on
  // data-dense pages like the calendar/planning, and Clarity is only useful
  // for the public/marketing funnel anyway.
  if (pathname?.startsWith('/pro') || pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <Script
      id="ms-clarity"
      strategy="afterInteractive"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
        `,
      }}
    />
  );
}
