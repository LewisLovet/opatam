import type { Metadata } from 'next';
import { WidgetDemo } from './WidgetDemo';

/**
 * Démonstration du widget de remplissage — /widget/demo
 *
 * Le futur widget « semaine » tel qu'il apparaîtrait sur le site d'un
 * prestataire : une grille libre / occupé par pas de 30 min, la prise de
 * rendez-vous au clic sur un créneau libre. Données fictives, options
 * réglables. Non indexée.
 */

export const metadata: Metadata = {
  title: 'Widget de remplissage · Démonstration',
  robots: { index: false, follow: false },
};

export default function WidgetDemoPage() {
  return <WidgetDemo />;
}
