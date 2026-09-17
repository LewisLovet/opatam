import type { Metadata } from 'next';
import { DemoEcran } from './DemoEcran';

/**
 * Démonstration de l'écran du salon — /ecran/demo
 *
 * Données fictives, heure simulée, et un panneau pour essayer les options
 * (thème, couleur, nombre de membres, prochains rendez-vous, compteurs).
 * Sert à montrer le rendu avant de créer un vrai lien. Non indexée.
 */

export const metadata: Metadata = {
  title: 'Écran du salon · Démonstration',
  robots: { index: false, follow: false },
};

export default function DemoEcranPage() {
  return <DemoEcran />;
}
