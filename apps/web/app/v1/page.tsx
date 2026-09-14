import { permanentRedirect } from 'next/navigation';

/**
 * /v1 a été l'adresse de test de cette page d'accueil. Elle EST l'accueil
 * désormais : redirection permanente vers `/`, pour que les liens partagés
 * pendant la phase de test continuent de marcher sans dupliquer la page.
 * Les composants restent dans ce dossier, importés par app/page.tsx.
 */
export default function V1Page() {
  permanentRedirect('/');
}
