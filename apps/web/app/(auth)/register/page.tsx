import type { Metadata } from 'next';
import { Suspense } from 'react';
import RegisterPage from './RegisterPage';

export const metadata: Metadata = {
  title: 'Inscription professionnelle',
  description: 'Créez votre compte professionnel Opatam en quelques minutes. 30 jours d\'essai gratuit, sans engagement, sans commission.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <RegisterPage />
    </Suspense>
  );
}
