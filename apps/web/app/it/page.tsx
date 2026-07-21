/**
 * Italian homepage — same component as `/`, rendered in Italian because
 * middleware.ts tags every `/it/...` request with `x-app-locale: it`
 * (picked up by i18n/request.ts). Metadata is locale-aware in ../page.tsx.
 */

// Route segment config must be declared locally (not re-exported) for
// Next's static analysis. Keep in sync with ../page.tsx.
export const revalidate = 1800;

export { default, generateMetadata } from '../page';
