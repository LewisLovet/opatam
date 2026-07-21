// Italian URL for the confirmation page — the real page lives in
// app/reservation/confirmation/[id]/page.tsx; middleware.ts marks /it/*
// requests with the x-app-locale header, which i18n/request.ts resolves
// to Italian. This file only re-exports.
export { default, generateMetadata } from '../../../../reservation/confirmation/[id]/page';
