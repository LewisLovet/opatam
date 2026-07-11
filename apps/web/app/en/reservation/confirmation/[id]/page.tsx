// English URL for the confirmation page — the real page lives in
// app/reservation/confirmation/[id]/page.tsx; middleware.ts marks /en/*
// requests with the x-app-locale header, which i18n/request.ts resolves
// to English. This file only re-exports.
export { default, generateMetadata } from '../../../../reservation/confirmation/[id]/page';
