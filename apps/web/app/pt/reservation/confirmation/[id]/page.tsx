// Portuguese URL for the confirmation page — the real page lives in
// app/reservation/confirmation/[id]/page.tsx; middleware.ts marks /pt/*
// requests with the x-app-locale header, which i18n/request.ts resolves
// to Portuguese. This file only re-exports.
export { default, generateMetadata } from '../../../../reservation/confirmation/[id]/page';
