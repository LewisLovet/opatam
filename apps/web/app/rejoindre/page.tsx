import type { Metadata } from 'next';
import { Suspense } from 'react';
import RejoindreClient from './RejoindreClient';

export const metadata: Metadata = {
  title: 'Rejoindre votre salon',
  description: 'Créez votre accès à l’espace membre Opatam.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RejoindreClient />
    </Suspense>
  );
}
