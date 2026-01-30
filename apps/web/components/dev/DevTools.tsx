'use client';

import dynamic from 'next/dynamic';

// Import dynamique pour eviter les erreurs SSR
const FirestoreTrackerWidget = dynamic(
  () =>
    import('./FirestoreTrackerWidget').then((mod) => mod.FirestoreTrackerWidget),
  { ssr: false }
);

/**
 * Conteneur pour les outils de developpement
 * N'affiche rien en production
 */
export function DevTools() {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <>
      <FirestoreTrackerWidget />
    </>
  );
}
