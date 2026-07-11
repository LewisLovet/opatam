/**
 * English booking tunnel — same component as /p/[slug]/reserver, rendered in
 * English because middleware.ts tags every `/en/...` request with
 * `x-app-locale: en` (picked up by i18n/request.ts).
 */

// Route segment config must be declared locally (not re-exported) for
// Next's static analysis. Keep in sync with the source page.
export const revalidate = 30;

export { default, generateMetadata } from '../../../../p/[slug]/reserver/page';
