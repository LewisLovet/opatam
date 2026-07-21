/**
 * Italian booking tunnel — same component as /p/[slug]/reserver, rendered in
 * Italian because middleware.ts tags every `/it/...` request with
 * `x-app-locale: it` (picked up by i18n/request.ts).
 */

// Route segment config must be declared locally (not re-exported) for
// Next's static analysis. Keep in sync with the source page.
export const revalidate = 30;

export { default, generateMetadata } from '../../../../p/[slug]/reserver/page';
