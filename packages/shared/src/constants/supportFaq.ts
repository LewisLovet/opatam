/**
 * Pré-chat du support — les questions fréquentes qui orientent AVANT de
 * parler à un humain. Partagé web (bulle /pro) et mobile (écran Messagerie).
 *
 * Règle éditoriale (la même que les battlecards) : chaque réponse est
 * VÉRIFIÉE dans le produit — rien d'inventé, pas de chemin d'interface
 * précis qui casserait à la première refonte. Contenu français uniquement
 * (le contenu éditorial reste FR, décision i18n du projet).
 *
 * `id` des thèmes : stable, il part dans le tag `topic` des messages et
 * s'affiche côté admin — ne pas renommer sans y penser.
 */

export interface SupportFaqEntree {
  question: string;
  reponse: string;
  /** Lien d'approfondissement — routes web /pro, ignoré par l'app mobile. */
  lienWeb?: { label: string; href: string };
}

export interface SupportFaqTheme {
  id: string;
  titre: string;
  /** Nom court affiché en tag sur la conversation côté admin. */
  tag: string;
  entrees: SupportFaqEntree[];
}

export const SUPPORT_FAQ: SupportFaqTheme[] = [
  {
    id: 'page',
    titre: 'Ma page & ma visibilité',
    tag: 'Page',
    entrees: [
      {
        question: 'Comment partager ma page de réservation ?',
        reponse:
          'Votre page a un lien unique (opatam.com/p/votre-nom) : mettez-le dans votre bio Instagram, vos stories, votre fiche Google. Vous disposez aussi d’un QR code à imprimer et d’un widget à intégrer si vous avez déjà un site.',
      },
      {
        question: 'Puis-je mettre ma page à mes couleurs ?',
        reponse:
          'Oui : logo, photo de couverture, palette de couleurs, description, galerie photos et liens vers vos réseaux — tout se règle depuis votre espace. Votre page vous ressemble, elle ne ressemble pas à Opatam.',
      },
      {
        question: 'Mes clientes doivent-elles créer un compte pour réserver ?',
        reponse:
          'Non — c’est un point fort d’Opatam : nom, e-mail et téléphone suffisent pour réserver. Aucune application à télécharger, aucun compte à créer. Moins d’étapes, moins d’abandons.',
      },
    ],
  },
  {
    id: 'reservations',
    titre: 'Réservations & créneaux',
    tag: 'Résas',
    entrees: [
      {
        question: 'Mes créneaux n’apparaissent pas, pourquoi ?',
        reponse:
          'Trois vérifications qui règlent presque tous les cas : 1) les horaires d’ouverture du membre concerné sont bien renseignés ; 2) la prestation est bien affectée à ce membre et à ce lieu ; 3) la durée de la prestation (plus son temps de battement) tient dans les horaires restants de la journée. Si tout est bon et que ça coince encore, écrivez-nous.',
      },
      {
        question: 'Puis-je valider chaque réservation à la main ?',
        reponse:
          'Oui : activez la confirmation manuelle dans vos réglages de réservation. Chaque demande arrive « en attente » et vous la confirmez ou la refusez. Sans cette option, les réservations sont confirmées automatiquement.',
      },
      {
        question: 'Les rappels aux clientes sont-ils automatiques ?',
        reponse:
          'Oui — rappels par e-mail avant le rendez-vous, et notifications push pour celles qui ont l’application. C’est automatique, rien à faire de votre côté, et c’est ce qui fait baisser les rendez-vous manqués.',
      },
    ],
  },
  {
    id: 'acomptes',
    titre: 'Acomptes & paiements',
    tag: 'Acomptes',
    entrees: [
      {
        question: 'Comment demander un acompte à la réservation ?',
        reponse:
          'Les acomptes se règlent dans vos paramètres de paiement : un pourcentage global, ou un montant personnalisé par prestation. Il faut d’abord connecter votre compte de versement (Stripe — identité + IBAN, guidé pas à pas) : c’est lui qui reçoit l’argent, Opatam ne touche jamais vos encaissements.',
      },
      {
        question: 'L’acompte est-il remboursé si la cliente annule ?',
        reponse:
          'C’est vous qui décidez : remboursement automatique si l’annulation intervient avant un délai que vous choisissez (48 h avant le rendez-vous, par exemple), ou acompte non remboursable. Et vous gardez toujours la main pour rembourser manuellement un cas particulier.',
      },
      {
        question: 'Opatam prend-il une commission sur mes réservations ?',
        reponse:
          '0 % de commission, jamais. Vous payez un abonnement fixe, et tout ce que vos clientes règlent vous revient (hors frais bancaires Stripe sur les acomptes, comme pour tout paiement par carte).',
      },
    ],
  },
  {
    id: 'abonnement',
    titre: 'Abonnement & essai',
    tag: 'Abo',
    entrees: [
      {
        question: 'Comment fonctionne l’essai gratuit ?',
        reponse:
          '30 jours, toutes les fonctionnalités, sans carte bancaire. À la fin, vous choisissez : Pro à 19,90 € TTC/mois (ou 199 €/an) pour un agenda, Studio à 29,90 € TTC/mois (ou 299 €/an) pour les équipes — jusqu’à 10 agendas et 10 adresses. Rien n’est prélevé sans votre décision.',
      },
      {
        question: 'Puis-je résilier quand je veux ?',
        reponse:
          'Oui, à tout moment, depuis vos paramètres — sans engagement ni frais de sortie. Et vos données (fichier clientes, réservations) restent exportables.',
      },
      {
        question: 'Que se passe-t-il à la fin de mon essai si je n’ai pas choisi ?',
        reponse:
          'Votre compte se met en pause : votre page cesse de prendre des réservations, mais rien n’est supprimé. Vous reprenez exactement où vous en étiez en activant un abonnement.',
      },
    ],
  },
];

/** Le tag lisible d'un topic — pour l'affichage admin. */
export function supportTopicTag(topicId: string | null | undefined): string | null {
  if (!topicId) return null;
  return SUPPORT_FAQ.find((t) => t.id === topicId)?.tag ?? null;
}
