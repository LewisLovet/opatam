/**
 * Battlecards commerciales — l'argumentaire face à chaque concurrent.
 *
 * RÈGLE ÉDITORIALE (audit du spécialiste commercial, 2026-08-25) : pas un
 * tableau où Opatam gagne artificiellement partout. Chaque fiche reconnaît
 * les forces réelles du concurrent, n'avance que des faits vérifiés et
 * sourcés, et dit explicitement ce qu'il ne faut PAS affirmer. Un commercial
 * qui ment une fois perd le prospect pour toujours.
 *
 * Positionnement Opatam : une expérience de réservation directe, simple et
 * personnalisée, sans compte obligatoire pour le client, avec un prix fixe
 * et prévisible pour le professionnel.
 *
 * Contenu versionné dans le code : chaque modification passe en revue, et
 * `verifieLe` date la dernière vérification des faits — un chiffre concurrent
 * périmé est pire qu'absent.
 */

export interface Battlecard {
  /** Aligné sur SALES_PLATFORMS quand ça existe — la fiche prospect s'en sert. */
  id: string;
  nom: string;
  priorite: 1 | 2 | 3;
  /** Avertissement affiché en tête (ex. données anciennes). */
  badge?: string;
  /** L'argument principal — lisible en cinq secondes. */
  argumentPrincipal: string;
  /** Les forces du concurrent, à reconnaître pour garder la confiance. */
  forces: string[];
  /** Les avantages Opatam vérifiés face à CE concurrent. */
  avantages: string[];
  /** À poser avant d'argumenter. */
  questions: string[];
  /** Prêtes à prononcer telles quelles. */
  phrases: string[];
  objections: Array<{ objection: string; reponse: string }>;
  aNePasDire: string[];
  calculateur: 'devis' | 'treatwell' | 'fresha' | 'booksy' | null;
  sources: Array<{ label: string; url: string }>;
  verifieLe: string;
}

/** Les avantages Opatam défendables sans risque, tous vérifiés dans le code
 *  (plans : packages/shared/src/constants — parcours invité : api/bookings). */
export const AVANTAGES_OPATAM = [
  'Réservation sans création de compte : nom, e-mail et téléphone suffisent',
  'Application mobile disponible mais jamais obligatoire — tout marche depuis le navigateur',
  'Page publique personnalisée : logo, couverture, palette, URL partageable, QR code, widget intégrable',
  'Prestations complexes : variations, options, suppléments, questions, panier multi-prestations',
  'Web + application mobile pour les professionnels',
  'Réservations illimitées, 0 % de commission',
  '30 jours gratuits, sans carte bancaire',
  'Pro 19,90 € TTC/mois ou 199 €/an — Studio 29,90 € TTC/mois ou 299 €/an (10 agendas, 10 adresses)',
  'Rappels e-mail et notifications push',
  'Fichier client, statistiques, avis, promotions, fidélité',
  'Interface en français, anglais, italien, portugais et allemand',
];

export const OPATAM_PRIX = {
  soloMensuel: 19.9,
  soloAnnuel: 199,
  studioMensuel: 29.9,
  studioAnnuel: 299,
};

export const BATTLECARDS: Battlecard[] = [
  // ── Priorité 1 ────────────────────────────────────────────────────────────
  {
    id: 'iara_beauty',
    nom: 'Iara Beauty',
    priorite: 1,
    argumentPrincipal:
      'Avec Iara, la cliente entre dans l’écosystème Iara. Avec Opatam, elle arrive sur VOTRE page, à vos couleurs, et réserve sans créer de compte ni télécharger quoi que ce soit.',
    forces: [
      'Offre gratuite très riche : rendez-vous illimités, fichier client, profil personnalisable, rappels, feed social, mini-dashboard',
      'Offres payantes à 19,99 € et 39,99 € avec fidélité, promotions, acomptes, messagerie, synchronisation de calendrier',
      'Application soignée, appréciée des indépendantes de la beauté',
    ],
    avantages: [
      'Aucun compte client obligatoire : coordonnées et c’est réservé — les conditions Iara prévoient une inscription Client (nom, prénom, e-mail, téléphone)',
      'Application facultative : tout le parcours fonctionne depuis un simple lien web ; l’app est un bonus (rendez-vous, fidélité)',
      'Moins de dépendance à une plateforme sociale : Iara mêle réservation, feed et marketplace ; Opatam met d’abord en avant l’identité du professionnel',
      'Équipes et multi-lieux : Studio couvre 10 agendas et 10 adresses ; Iara se positionne explicitement sur les indépendants',
      'Prestations très configurables : variations, options, suppléments, questions, panier multi-prestations',
      'Widget intégrable sur le site existant du professionnel',
    ],
    questions: [
      'Vos clientes réservent-elles plutôt depuis votre Instagram ou depuis l’app Iara ?',
      'Travaillez-vous seule, ou l’équipe va-t-elle grandir ?',
      'Vos prestations ont-elles des variations de prix (longueur, zone, options) ?',
    ],
    phrases: [
      'Avec Iara, votre cliente entre dans l’écosystème Iara. Avec Opatam, elle arrive sur votre page, à vos couleurs, choisit son créneau et réserve sans créer de compte ni télécharger quoi que ce soit.',
      'Nous supprimons une étape susceptible de créer de l’abandon : la création de compte.',
      'Le jour où vous prenez une deuxième personne ou une deuxième adresse, Studio couvre tout à prix fixe.',
    ],
    objections: [
      {
        objection: '« Iara est gratuit, pourquoi payer ? »',
        reponse:
          'Le gratuit d’Iara est réel et riche — reconnaissez-le. La différence se joue sur le parcours de la cliente (pas de compte, pas d’app) et sur votre indépendance : votre page, vos couleurs, votre lien. Si ces deux points comptent, l’abonnement se justifie ; sinon, Iara est un bon choix.',
      },
      {
        objection: '« Mes clientes ont déjà l’app Iara »',
        reponse:
          'Justement : elles sont dans l’écosystème Iara, pas dans le vôtre. Un lien Opatam dans votre bio Instagram ramène la réservation chez vous, et la nouvelle cliente n’a rien à installer.',
      },
    ],
    aNePasDire: [
      'Ne pas promettre « davantage de conversions » — aucune mesure comparative n’existe. Dire : « nous supprimons une étape susceptible de créer de l’abandon ».',
      'Ne pas prétendre être moins cher qu’Iara ni les seuls à personnaliser le profil : c’est faux.',
    ],
    calculateur: null,
    sources: [
      { label: 'Offre officielle Iara', url: 'https://iarabeauty.com/fr/pro' },
      { label: 'Conditions Iara (inscription Client)', url: 'https://iarabeauty.com/fr/terms' },
    ],
    verifieLe: '2026-08-25',
  },
  {
    id: 'planity',
    nom: 'Planity',
    priorite: 1,
    argumentPrincipal:
      'Prix affiché et transparent (19,90 € TTC, sans devis ni conseiller), mise en route autonome en 30 jours sans carte, et une vitrine à son image, qu’il personnalise et maîtrise — réservable sans compte client.',
    forces: [
      'Notoriété considérable : plus de 60 000 professionnels annoncés, 15 millions d’utilisateurs, forte audience marketplace',
      'Suite très complète : agenda, 300 SMS mensuels, fichier client, prépaiement, caisse NF525, stocks',
      'Sans commission, comme Opatam',
    ],
    avantages: [
      'Prix immédiatement transparent : 19,90 € TTC affichés — Planity ne publie pas ses tarifs. Comparez Opatam au devis réellement reçu par le prospect.',
      'Mise en route autonome : 30 jours sans carte, contre un parcours Planity centré sur la demande de démonstration et l’accompagnement par un conseiller',
      'Identité indépendante : couleurs, couverture, QR code, widget intégrable au site existant — chez Planity, l’offre de base est une page sur planity.com, le site sur mesure est une option',
      'Moins de friction : aucun compte client chez Opatam ; Planity fait créer un compte à la première réservation, avec validation par SMS',
      'Équipe à coût fixe : 29,90 € TTC jusqu’à dix agendas',
    ],
    questions: [
      'Avez-vous un devis Planity ? Quel montant mensuel vous a-t-on annoncé ?',
      'Vos nouvelles clientes viennent-elles de Planity, ou de vos réseaux et du bouche-à-oreille ?',
      'Avez-vous besoin d’une caisse et d’une gestion de stocks, ou d’abord de réservations ?',
    ],
    phrases: [
      'Planity est une excellente marketplace. Opatam est particulièrement intéressant si vous voulez surtout développer votre propre marque, garder un lien de réservation plus simple et connaître votre coût dès maintenant. Vos clientes peuvent réserver sans créer de compte.',
      'Vous connaissez le prix d’Opatam avant même de nous parler : 19,90 € TTC. Combien vous a-t-on annoncé chez Planity ?',
      'Votre page Opatam est à vos couleurs, avec votre QR code, intégrable à votre site — pas une fiche parmi 60 000.',
    ],
    objections: [
      {
        objection: '« Planity m’apporte des clientes »',
        reponse:
          'C’est sa vraie force, ne la niez pas. La question à poser : sur les dix dernières nouvelles clientes, combien venaient de Planity et combien de vos réseaux ? Si l’essentiel vient de vous, la marketplace pèse peu — et le coût, lui, reste entier.',
      },
      {
        objection: '« Planity fait aussi caisse et SMS »',
        reponse:
          'Exact — si la caisse NF525 et les stocks sont indispensables, Planity est légitime. Si le besoin est la réservation, la vitrine et le fichier client, Opatam le fait pour un prix connu d’avance.',
      },
    ],
    aNePasDire: [
      'Ne JAMAIS dire que Planity prend une commission : Planity affirme officiellement le contraire.',
      'Ne pas présenter les ~100 €/mois comme un tarif officiel : Planity ne publie pas ses prix — s’appuyer sur le devis du prospect.',
    ],
    calculateur: 'devis',
    sources: [
      { label: 'Tarifs et fonctionnalités officiels Planity', url: 'https://info.planity.com/tarifs' },
      {
        label: 'Création du compte client Planity (SMS)',
        url: 'https://support.planity.com/hc/fr/articles/28244930386322-Comment-cr%C3%A9er-un-compte-sur-Planity',
      },
    ],
    verifieLe: '2026-08-25',
  },
  {
    id: 'treatwell',
    nom: 'Treatwell',
    priorite: 1,
    argumentPrincipal:
      'La visibilité Treatwell se paie : 25 % sur la première réservation de chaque nouveau client marketplace. Si l’audience vient déjà du professionnel, Opatam la transforme en réservations sans coût d’acquisition.',
    forces: [
      'Marketplace européenne puissante — pertinente pour un établissement qui cherche avant tout de l’acquisition',
      'Caisse, rapports détaillés, promotions, gestion d’équipe, outils marketing',
      'Notoriété grand public forte',
    ],
    avantages: [
      'Aucune commission d’apport : Treatwell facture 25 % sur la première réservation des nouveaux clients marketplace',
      'Pas de frais de prépaiement propres à la plateforme : Treatwell annonce 2 % + TVA sur les prépaiements',
      'Prix et promotions libres : les conditions Treatwell imposent de proposer sur la marketplace le meilleur prix public du salon',
      'Relation directe : coordonnées et liens directs ne peuvent pas être publiés librement sur la page Treatwell',
      'Avis maîtrisés : Treatwell précise que les avis ne sont pas récupérables à la résiliation',
      'Le bon choix quand l’audience existe déjà : Instagram, TikTok, Google, bouche-à-oreille alimentent le lien Opatam sans commission',
    ],
    questions: [
      'Sur vos dix derniers nouveaux clients, combien venaient déjà de vos réseaux ou de recommandations ?',
      'Quel est votre ticket moyen ?',
      'Combien de nouvelles clientes la marketplace vous apporte-t-elle réellement chaque mois ?',
    ],
    phrases: [
      'Treatwell peut vous apporter de la visibilité, mais cette visibilité se paie sur les nouveaux clients. Si votre clientèle arrive déjà par Instagram, Google ou le bouche-à-oreille, Opatam transforme directement cette audience en réservations sans prélever 25 % sur la première prestation.',
      'Votre fichier client, vos réservations, votre lien : chez Opatam, tout est exportable — y compris si vous partez.',
      'Faisons le calcul ensemble : votre ticket moyen fois vos nouveaux clients marketplace fois 25 % — comparez ce montant à 19,90 €.',
    ],
    objections: [
      {
        objection: '« J’ai besoin de la visibilité Treatwell »',
        reponse:
          'Si la majorité des nouveaux clients vient réellement de la marketplace, Treatwell se défend — c’est un budget d’acquisition. Beaucoup de salons découvrent en comptant que l’essentiel vient d’eux : dans ce cas, la commission rémunère une visibilité qu’ils n’utilisent pas.',
      },
    ],
    aNePasDire: [
      'Ne pas dire que Treatwell prélève 25 % sur TOUTES les réservations : c’est sur la première réservation des nouveaux clients apportés par la marketplace.',
    ],
    calculateur: 'treatwell',
    sources: [
      { label: 'Tarifs officiels Treatwell', url: 'https://www.treatwell.fr/partenaires/tarifs/' },
      {
        label: 'Conditions partenaires Treatwell',
        url: 'https://www.treatwell.fr/info/termes-et-conditions-salons-partenaires/',
      },
    ],
    verifieLe: '2026-08-25',
  },
  {
    id: 'fresha',
    nom: 'Fresha',
    priorite: 1,
    argumentPrincipal:
      'Dès que l’équipe grandit ou que fidélité et communications s’ajoutent, le coût réel de Fresha change. Opatam garde un forfait fixe jusqu’à dix agendas.',
    forces: [
      'Plus complet qu’Opatam sur la caisse, les stocks, les cartes cadeaux, les abonnements clients, les listes d’attente, le marketing avancé',
      'Plan indépendant à 14,95 €/mois — moins cher que le plan Pro d’Opatam pour une personne seule',
      'Produit international mature',
    ],
    avantages: [
      'Coût d’équipe prévisible : Fresha facture 9,95 € par membre réservable — à partir de quatre membres, Studio à 29,90 € devient moins cher',
      'Moins de modules payants : chez Fresha, la fidélité coûte 59,95 €/établissement/mois et certaines fonctions de données 9,95 €/membre/mois — inclus chez Opatam',
      'Communications lisibles : Fresha inclut un quota puis facture SMS, WhatsApp et e-mails marketing à l’usage',
      'Pas de frais d’apport marketplace : Fresha applique des frais quand un nouveau client vient de sa marketplace (les réservations directes n’en ont pas)',
      'Produit focalisé : réservation, vitrine, clients, fidélisation — sans administrer une suite caisse/inventaire',
    ],
    questions: [
      'Combien de personnes prennent des rendez-vous chez vous ?',
      'Utilisez-vous (ou voulez-vous) un programme de fidélité ?',
      'Avez-vous réellement besoin d’une caisse et d’un inventaire dans le même outil ?',
    ],
    phrases: [
      'Fresha est très complet et peut être intéressant seul. Mais dès que l’équipe grandit ou que vous ajoutez la fidélité et certaines communications, le coût réel change. Opatam garde un forfait fixe jusqu’à dix agendas.',
      'À quatre personnes réservables, le calcul bascule : 4 × 9,95 € dépasse déjà Studio entier.',
      'La fidélité est incluse chez Opatam — chez Fresha, c’est un module à 59,95 € par mois.',
    ],
    objections: [
      {
        objection: '« Fresha est moins cher que vous »',
        reponse:
          'Pour une personne seule sans module, oui — 14,95 € contre 19,90 €, dites-le honnêtement. Le calcul change avec l’équipe (9,95 €/membre), la fidélité (59,95 €/mois) et les communications à l’usage. Faites le total réel du prospect avant de comparer.',
      },
    ],
    aNePasDire: [
      'Ne pas affirmer que Fresha prélève une commission sur toutes les réservations : les liens directs sont sans commission, les frais concernent l’apport marketplace.',
      'Ne pas attaquer Fresha uniquement sur le prix pour un indépendant seul : il est moins cher.',
    ],
    calculateur: 'fresha',
    sources: [{ label: 'Grille officielle Fresha', url: 'https://www.fresha.com/fr/pricing' }],
    verifieLe: '2026-08-25',
  },

  // ── Priorité 2 ────────────────────────────────────────────────────────────
  {
    id: 'booksy',
    nom: 'Booksy',
    priorite: 2,
    argumentPrincipal:
      'Booksy coûte 59 € HT/mois plus 10 € HT par collaborateur supplémentaire. Pour qui veut surtout réserver, présenter son travail et gérer ses clients, Opatam le fait à 19,90–29,90 € TTC.',
    forces: [
      'Suite très étendue : caisse NF525, listes d’attente, SMS, marketing, paiements, marketplace',
      'Application non obligatoire côté client : la réservation web existe aussi',
      'Marque forte, notamment chez les barbiers',
    ],
    avantages: [
      '59 € HT/mois + 10 € HT par utilisateur supplémentaire chez Booksy — contre 19,90 € TTC solo ou 29,90 € TTC jusqu’à dix agendas',
      'Essai de 30 jours contre 7 jours chez Booksy',
      'Booksy Boost peut appliquer 30 % de commission sur la première visite (option facultative) — rien de tel chez Opatam',
      'Adapté au professionnel qui ne veut pas payer pour une caisse, des stocks et du marketing avancé',
    ],
    questions: [
      'Combien de collaborateurs prennent des rendez-vous ?',
      'Utilisez-vous la caisse et les SMS de Booksy, ou surtout l’agenda ?',
      'Utilisez-vous Boost, et à quel coût réel ?',
    ],
    phrases: [
      'Booksy est une suite de gestion très complète. Si vous avez principalement besoin de prendre des réservations, présenter votre travail et gérer vos clients, Opatam évite de payer 59 € HT plus un supplément par collaborateur.',
      'Trente jours d’essai sans carte, contre sept : vous avez le temps de vérifier que ça marche pour vous.',
    ],
    objections: [
      {
        objection: '« Booksy fait tout, pourquoi changer ? »',
        reponse:
          'S’il utilise réellement la caisse, les SMS et le marketing, Booksy se justifie. S’il paie 59 € HT surtout pour l’agenda et la page, le calcul est vite fait — posez la question de ce qu’il utilise vraiment.',
      },
    ],
    aNePasDire: [
      'Ne pas dire que l’app Booksy est obligatoire pour les clients : la réservation web existe.',
      'Ne pas présenter la commission Boost comme systématique : c’est une option d’acquisition facultative.',
    ],
    calculateur: 'booksy',
    sources: [
      { label: 'Tarification officielle Booksy', url: 'https://biz.booksy.com/fr-fr/tarifs' },
      {
        label: 'Réservation web sans app (support Booksy)',
        url: 'https://support.booksy.com/hc/fr-fr/articles/16486697667346',
      },
    ],
    verifieLe: '2026-08-25',
  },
  {
    id: 'wavy',
    nom: 'Wavy',
    priorite: 2,
    argumentPrincipal:
      'Wavy est un vrai logiciel de gestion de salon (caisse, stocks, compta). Pour un indépendant qui veut d’abord des réservations sans matériel ni formation, Opatam est plus léger et moins cher.',
    forces: [
      'Très fort sur la caisse NF525, les stocks, la comptabilité, la fiche client coiffure',
      'Communication en marque blanche — la personnalisation n’est PAS une faiblesse de Wavy',
      'Bien implanté dans la coiffure',
    ],
    avantages: [
      'Tarif annoncé à partir de 29 €/mois + pack communication à 49 €/mois — à revérifier sur le devis du prospect',
      'Plus léger pour un indépendant sans besoin de caisse ni de stock',
      'Mise en route autonome, sans matériel et sans formation',
      'Réservation sans compte client',
      'Studio à prix fixe pour les petites équipes',
    ],
    questions: [
      'Avez-vous besoin d’une caisse NF525 et d’une gestion de stocks ?',
      'Quel montant figure sur votre devis Wavy, packs compris ?',
    ],
    phrases: [
      'Si la caisse certifiée et les stocks sont indispensables, Wavy est adapté — je vous le dis honnêtement. Si le besoin est la réservation et la vitrine, Opatam démarre aujourd’hui, sans matériel, sans formation, à prix connu.',
    ],
    objections: [
      {
        objection: '« Wavy gère aussi ma caisse »',
        reponse:
          'Et Opatam ne le fait pas — c’est le critère de décision. Caisse indispensable : Wavy. Réservation, vitrine, clients : Opatam, pour moins cher et sans engagement matériel.',
      },
    ],
    aNePasDire: [
      'Ne pas présenter la personnalisation comme une faiblesse de Wavy (marque blanche réelle).',
      'Ne pas citer les tarifs Wavy comme définitifs : les revérifier sur le devis du prospect.',
    ],
    calculateur: 'devis',
    sources: [
      { label: 'Fonctionnalités officielles Wavy', url: 'https://www.wavy.co/logiciel-application-salon-beaute' },
      {
        label: 'Présentation tarifaire Wavy (blog)',
        url: 'https://www.wavy.co/blog/quel-est-le-meilleur-logiciel-pour-votre-salon-de-coiffure',
      },
    ],
    verifieLe: '2026-08-25',
  },

  // ── Priorité 3 ────────────────────────────────────────────────────────────
  {
    id: 'kiute',
    nom: 'Kiute',
    priorite: 3,
    badge: 'Conditions à confirmer avec le prospect — informations publiques anciennes',
    argumentPrincipal:
      'Opatam préserve le prix de la prestation : abonnement fixe, aucune obligation de remiser les créneaux, aucun coût d’apport sur un client venu par vos propres canaux.',
    forces: [
      'Présence historique dans la coiffure (ex-Flexy)',
      'Marketplace avec promotions attractives côté consommateur',
    ],
    avantages: [
      'Les documents accessibles indiquent : commission sur les nouveaux clients apportés, frais de paiement en ligne de 1,8 % + 0,18 €, promotions marketplace jusqu’à −30 %/−50 % — tout est à confirmer avec le prospect',
      'Chez Opatam : abonnement fixe, prix des prestations jamais remisés d’office, zéro coût d’apport',
    ],
    questions: [
      'Quelles conditions exactes avez-vous signées avec Kiute (commission, frais de paiement, promotions) ?',
      'Vos créneaux partent-ils en promotion sans votre décision ?',
    ],
    phrases: [
      'Je ne vais pas critiquer Kiute sur des chiffres anciens — regardons vos conditions réelles ensemble. Ce que je peux garantir côté Opatam : un abonnement fixe, vos prix intacts, et aucun prélèvement sur les clientes qui viennent de vous.',
    ],
    objections: [],
    aNePasDire: [
      'Ne citer AUCUN chiffre Kiute comme actuel : les informations publiques sont anciennes — s’appuyer uniquement sur le contrat du prospect.',
    ],
    calculateur: 'devis',
    sources: [
      { label: 'Centre d’aide Kiute (archives)', url: 'https://intercom.help/KiuteProSupport/en/articles/5335373' },
    ],
    verifieLe: '2026-08-25',
  },
  {
    id: 'instagram_dm',
    nom: 'Instagram / DM uniquement',
    priorite: 3,
    argumentPrincipal:
      'Le carnet de commandes vit dans les DM : ça marche, jusqu’à ce que ça déborde. Opatam transforme la bio Instagram en réservations qui se prennent toutes seules — la nuit aussi.',
    forces: [
      'Gratuit, immédiat, déjà là où vivent les clientes',
      'Relation très personnelle avec la clientèle',
    ],
    avantages: [
      'Un lien en bio : la cliente choisit son créneau seule, sans échange de messages — et sans compte à créer',
      'Rappels automatiques : moins de lapins qu’un rendez-vous convenu en DM',
      'Les créneaux se remplissent quand le salon est fermé',
      'Fichier client, statistiques et fidélité en plus du carnet',
      'L’essai est gratuit 30 jours : le test ne coûte que le lien en bio',
    ],
    questions: [
      'Combien de temps par jour passez-vous à répondre aux DM de prise de rendez-vous ?',
      'Combien de rendez-vous convenus en DM ne viennent finalement pas ?',
    ],
    phrases: [
      'Vos DM restent pour la relation — la prise de rendez-vous, elle, peut se faire toute seule via le lien en bio, même à minuit.',
      'Une cliente qui hésite à 23 h réserve si le lien est là. En DM, elle attend votre réponse — et parfois elle est passée à autre chose.',
    ],
    objections: [
      {
        objection: '« Mes clientes aiment le contact en DM »',
        reponse:
          'Elles le gardent : le lien ne remplace pas la conversation, il remplace l’aller-retour « quel créneau ? — et jeudi ? — non… ». La relation reste, la logistique disparaît.',
      },
    ],
    aNePasDire: ['Ne pas dénigrer Instagram : c’est leur canal d’acquisition — Opatam s’y branche, il ne le remplace pas.'],
    calculateur: null,
    sources: [],
    verifieLe: '2026-08-25',
  },
  {
    id: 'papier_telephone',
    nom: 'Papier / téléphone',
    priorite: 3,
    argumentPrincipal:
      'Le cahier ne sonne pas la nuit et ne rappelle personne. Opatam prend les rendez-vous quand le salon est fermé et envoie les rappels tout seul.',
    forces: [
      'Zéro coût, zéro apprentissage, contrôle total',
      'Convient à une clientèle fidèle et régulière',
    ],
    avantages: [
      'Réservation 24 h/24 sans décrocher — pendant une prestation, personne ne rappelle',
      'Rappels automatiques : moins de rendez-vous oubliés',
      'Le fichier client se construit tout seul (coordonnées, historique)',
      'La cliente n’a besoin ni d’app ni de compte : un lien suffit, même par SMS',
      '30 jours pour essayer sans rien changer au cahier',
    ],
    questions: [
      'Combien d’appels manqués par semaine pendant les prestations ?',
      'Que se passe-t-il quand une cliente veut réserver un dimanche soir ?',
    ],
    phrases: [
      'Gardez le cahier si vous l’aimez — Opatam s’occupe simplement des appels que vous ne pouvez pas prendre et des rappels que personne n’a le temps d’envoyer.',
    ],
    objections: [
      {
        objection: '« Je ne suis pas à l’aise avec les outils »',
        reponse:
          'La mise en route se fait en quelques minutes, avec nous si vous voulez — et vos clientes, elles, n’ont qu’un lien à ouvrir. Pas d’app, pas de compte, pas de formation.',
      },
    ],
    aNePasDire: ['Ne pas moquer le cahier : il a fait tourner le salon jusqu’ici.'],
    calculateur: null,
    sources: [],
    verifieLe: '2026-08-25',
  },
  {
    id: 'aucun',
    nom: 'Aucun outil',
    priorite: 3,
    argumentPrincipal:
      'Pas d’outil, c’est des rendez-vous qui se perdent entre les DM, les appels et la mémoire. Opatam donne un seul endroit où tout arrive — et 30 jours pour le vérifier gratuitement.',
    forces: ['Aucun coût, aucune habitude à changer'],
    avantages: [
      'Un lien unique à partager partout (bio, QR code, SMS) — la cliente réserve sans compte',
      'Rappels automatiques, fichier client, statistiques : le socle en une fois',
      '30 jours gratuits sans carte : le test ne coûte rien',
    ],
    questions: ['Comment vos clientes prennent-elles rendez-vous aujourd’hui, concrètement ?'],
    phrases: [
      'On installe votre page ensemble en dix minutes, vous mettez le lien en bio, et pendant 30 jours vous regardez si les réservations arrivent. Si oui, vous continuez ; sinon, ça ne vous a rien coûté.',
    ],
    objections: [],
    aNePasDire: [],
    calculateur: null,
    sources: [],
    verifieLe: '2026-08-25',
  },
];
