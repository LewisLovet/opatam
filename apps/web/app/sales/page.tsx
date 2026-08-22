'use client';

import { Users, Kanban, PhoneCall, Presentation } from 'lucide-react';

/**
 * Accueil de l'espace commercial — squelette de la Phase 1.
 *
 * L'atterrissage du lien d'invitation pointe ici : la page doit exister et
 * être propre avant que le pipeline, la fiche prospect et le centre de
 * démonstration ne la remplissent.
 */
export default function SalesHomePage() {
  const blocs = [
    { icone: Kanban, titre: 'Pipeline', texte: 'Vos prospects, du premier contact à l’abonné conservé.' },
    { icone: Users, titre: 'Fiches prospects', texte: 'Coordonnées, historique, activation du compte lié.' },
    { icone: Presentation, titre: 'Centre de démonstration', texte: 'Démos par secteur, liens attribués, réservation test.' },
    { icone: PhoneCall, titre: 'Alertes d’essai', texte: 'Les comptes qui décrochent, et la prochaine action utile.' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bienvenue</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Votre espace est ouvert. Les outils arrivent module par module — voici ce qui est en construction.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {blocs.map(({ icone: Icone, titre, texte }) => (
          <div key={titre} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <Icone className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="mt-3 font-semibold text-gray-900 dark:text-white">{titre}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{texte}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
