import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation',
  description: 'Conditions Générales d\'Utilisation de la plateforme Opatam. Règles d\'utilisation, responsabilités, propriété intellectuelle.',
  alternates: {
    canonical: 'https://opatam.com/cgu',
  },
};

export default function CGUPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">Conditions Générales d&apos;Utilisation</h1>
          <p className="mb-8 text-sm text-gray-500">Dernière mise à jour : 7 mars 2026</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Objet</h2>
              <p>Les présentes Conditions Générales d&apos;Utilisation (CGU) régissent l&apos;accès et l&apos;utilisation du site web <strong>opatam.com</strong> et de l&apos;application mobile <strong>Opatam</strong>, édités par KamerleonTech. Elles définissent les droits et obligations des utilisateurs et de l&apos;éditeur.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Définitions</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Plateforme :</strong> le site web opatam.com et l&apos;application mobile Opatam</li>
                <li><strong>Client :</strong> toute personne utilisant la Plateforme pour rechercher et réserver des prestations</li>
                <li><strong>Professionnel :</strong> toute personne ou entreprise inscrite sur la Plateforme pour proposer ses services et gérer ses rendez-vous</li>
                <li><strong>Utilisateur :</strong> tout Client ou Professionnel utilisant la Plateforme</li>
                <li><strong>Prestation :</strong> service proposé par un Professionnel et réservable via la Plateforme</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">3. Acceptation des CGU</h2>
              <p>L&apos;utilisation de la Plateforme implique l&apos;acceptation pleine et entière des présentes CGU. L&apos;Utilisateur reconnaît avoir lu et accepté les présentes conditions lors de son inscription ou de sa première utilisation du service.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Description des services</h2>
              <p>La Plateforme Opatam propose les services suivants :</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Pour les clients</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Recherche de professionnels par catégorie et localisation</li>
                <li>Consultation des profils, prestations et avis</li>
                <li>Réservation en ligne de rendez-vous</li>
                <li>Gestion de ses réservations (modification, annulation)</li>
                <li>Dépôt d&apos;avis après une prestation</li>
              </ul>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Pour les professionnels</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Création d&apos;une page professionnelle publique avec lien personnalisé</li>
                <li>Gestion de l&apos;agenda et des disponibilités</li>
                <li>Gestion des réservations et des clients</li>
                <li>Envoi automatique de rappels de rendez-vous</li>
                <li>Tableau de bord et statistiques d&apos;activité</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">5. Inscription et compte</h2>
              <p>L&apos;inscription est gratuite et requiert une adresse email valide. L&apos;Utilisateur s&apos;engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants de connexion. Il est responsable de toute activité réalisée depuis son compte.</p>
              <p className="mt-2">KamerleonTech se réserve le droit de suspendre ou supprimer tout compte en cas de manquement aux présentes CGU.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">6. Obligations des utilisateurs</h2>
              <p>L&apos;Utilisateur s&apos;engage à :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Utiliser la Plateforme conformément à sa destination</li>
                <li>Fournir des informations exactes et à jour</li>
                <li>Ne pas publier de contenu illicite, diffamatoire ou portant atteinte aux droits de tiers</li>
                <li>Ne pas tenter de contourner les mesures de sécurité</li>
                <li>Respecter les rendez-vous pris via la Plateforme</li>
              </ul>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Obligations spécifiques des professionnels</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Disposer des qualifications et autorisations nécessaires à l&apos;exercice de leur activité</li>
                <li>Assurer la véracité des informations relatives à leurs prestations et tarifs</li>
                <li>Honorer les rendez-vous confirmés via la Plateforme</li>
                <li>Respecter la réglementation applicable à leur activité</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">7. Réservations</h2>
              <p>La réservation d&apos;une prestation via la Plateforme constitue un accord entre le Client et le Professionnel. KamerleonTech agit uniquement en tant qu&apos;intermédiaire technique et n&apos;est pas partie au contrat de prestation.</p>
              <p className="mt-2">Les conditions d&apos;annulation et de modification sont définies par chaque Professionnel. L&apos;Utilisateur est invité à consulter les conditions spécifiques avant toute réservation.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">8. Abonnements et paiements in-app</h2>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Offres d&apos;abonnement</h3>
              <p>L&apos;accès aux fonctionnalités professionnelles de la Plateforme est soumis à la souscription d&apos;un abonnement payant, après une période d&apos;essai gratuite de 30 jours. Deux formules sont proposées :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li><strong>Pro (Solo) :</strong> destiné aux indépendants — 19,99 €/mois ou 199,99 €/an</li>
                <li><strong>Studio (Équipe) :</strong> destiné aux équipes — 29,99 €/mois ou 299,99 €/an</li>
              </ul>
              <p className="mt-2">Les prix sont indiqués en euros TTC. Ils peuvent être modifiés à tout moment, la modification prenant effet au prochain renouvellement.</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Période d&apos;essai</h3>
              <p>Chaque nouveau compte professionnel bénéficie d&apos;une période d&apos;essai gratuite de 30 jours donnant accès à l&apos;ensemble des fonctionnalités. À l&apos;issue de cette période, un abonnement payant est nécessaire pour continuer à utiliser les fonctionnalités professionnelles.</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Renouvellement automatique</h3>
              <p>Les abonnements sont à renouvellement automatique. L&apos;abonnement se renouvelle automatiquement pour une durée identique (mensuelle ou annuelle) à la fin de chaque période, sauf annulation par l&apos;Utilisateur au moins 24 heures avant la date de renouvellement.</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Paiement</h3>
              <p>Le paiement est traité par les plateformes suivantes selon le mode d&apos;accès :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li><strong>Application iOS :</strong> le paiement est débité sur le compte Apple ID de l&apos;Utilisateur via Apple In-App Purchase. La gestion de l&apos;abonnement (modification, annulation) s&apos;effectue dans les réglages du compte Apple de l&apos;Utilisateur.</li>
                <li><strong>Application Android :</strong> le paiement est débité via Google Play. La gestion de l&apos;abonnement s&apos;effectue dans les paramètres Google Play de l&apos;Utilisateur.</li>
                <li><strong>Site web :</strong> le paiement est traité par Stripe. La gestion de l&apos;abonnement s&apos;effectue depuis l&apos;espace professionnel sur le site web.</li>
              </ul>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Annulation</h3>
              <p>L&apos;Utilisateur peut annuler son abonnement à tout moment. L&apos;annulation prend effet à la fin de la période en cours : l&apos;Utilisateur conserve l&apos;accès aux fonctionnalités payantes jusqu&apos;à l&apos;expiration de la période déjà payée. Aucun remboursement au prorata ne sera effectué pour la période en cours.</p>
              <p className="mt-2">La suppression de l&apos;application n&apos;entraîne pas l&apos;annulation de l&apos;abonnement. L&apos;Utilisateur doit annuler son abonnement via les réglages de son compte Apple, Google Play ou depuis le site web.</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Remboursements</h3>
              <p>Pour les achats effectués via Apple ou Google Play, les demandes de remboursement doivent être adressées directement à Apple ou Google conformément à leurs politiques respectives. Pour les achats effectués via le site web (Stripe), les demandes de remboursement peuvent être adressées à <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a>.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">9. Propriété intellectuelle</h2>
              <p>L&apos;ensemble des éléments de la Plateforme (design, code, textes, logos, algorithmes, marques) est la propriété exclusive de KamerleonTech. Toute reproduction, même partielle, sans autorisation écrite préalable est interdite.</p>
              <p className="mt-2">Les contenus publiés par les Professionnels (textes, photos) restent leur propriété. En publiant sur la Plateforme, ils accordent à KamerleonTech une licence non exclusive d&apos;utilisation pour l&apos;affichage sur le service.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">10. Limitation de responsabilité</h2>
              <p>KamerleonTech fournit la Plateforme en tant qu&apos;intermédiaire technique. À ce titre, KamerleonTech ne saurait être tenue responsable :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>De la qualité des prestations fournies par les Professionnels</li>
                <li>Des litiges entre Clients et Professionnels</li>
                <li>De l&apos;exactitude des informations publiées par les Professionnels</li>
                <li>Des interruptions temporaires du service</li>
                <li>Des dommages directs ou indirects liés à l&apos;utilisation de la Plateforme</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">11. Disponibilité du service</h2>
              <p>KamerleonTech s&apos;efforce d&apos;assurer la disponibilité de la Plateforme 24h/24 et 7j/7. Toutefois, le service peut être interrompu pour des opérations de maintenance, des mises à jour ou en cas de force majeure, sans que cela ne puisse donner lieu à indemnisation.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">12. Données personnelles</h2>
              <p>Le traitement des données personnelles est décrit dans notre <a href="/confidentialite" className="text-indigo-600 hover:underline">Politique de confidentialité</a>.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">13. Modification des CGU</h2>
              <p>KamerleonTech se réserve le droit de modifier les présentes CGU à tout moment. Les modifications prennent effet dès leur publication sur la Plateforme. L&apos;utilisation continue du service après modification vaut acceptation des nouvelles conditions.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">14. Droit applicable et litiges</h2>
              <p>Les présentes CGU sont régies par le droit français. En cas de litige, une solution amiable sera recherchée en priorité. À défaut, le litige sera porté devant les tribunaux compétents de Paris.</p>
              <p className="mt-2">Conformément à l&apos;article L.612-1 du Code de la consommation, le consommateur peut recourir gratuitement au service de médiation CM2C (<a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">www.cm2c.net</a>).</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">15. Contact</h2>
              <p>Pour toute question relative aux présentes CGU :</p>
              <ul className="mt-2 list-none space-y-1">
                <li>Email : <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a></li>
                <li>Adresse : KamerleonTech, 3 avenue Charles de Gaulle, Chilly-Mazarin</li>
              </ul>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
