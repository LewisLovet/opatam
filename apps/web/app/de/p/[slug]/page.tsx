/**
 * German provider page — same component as /p/[slug], rendered in German
 * because middleware.ts tags every `/de/...` request with `x-app-locale: de`
 * (picked up by i18n/request.ts). Metadata is locale-aware in the source page.
 */

// Route segment config must be declared locally (not re-exported) for
// Next's static analysis. Keep in sync with the source page.
export const revalidate = 30;

export { default, generateMetadata } from '../../../p/[slug]/page';
