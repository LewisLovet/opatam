import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente',
  description: 'Conditions Générales de Vente des abonnements Opatam. Tarifs, essai gratuit, paiement, résiliation.',
  alternates: {
    canonical: 'https://opatam.com/cgv',
  },
};

export default function CGVPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">Conditions Générales de Vente</h1>
          <p className="mb-8 text-sm text-gray-500">Dernière mise à jour : 9 février 2026</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Objet</h2>
              <p>Les présentes Conditions Générales de Vente (CGV) régissent la souscription et l&apos;utilisation des abonnements payants proposés par KamerleonTech sur la plateforme Opatam. Elles s&apos;appliquent exclusivement aux Professionnels souscrivant un abonnement.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Offres et tarifs</h2>
              <p>Opatam propose les abonnements suivants (tarifs TTC) :</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Plan Pro</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Mensuel : 17,90 &euro;/mois</li>
                <li>Annuel : 179 &euro;/an (soit 14,92 &euro;/mois)</li>
              </ul>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Plan Studio</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Mensuel : 29,90 &euro;/mois (jusqu&apos;&agrave; 5 membres inclus)</li>
                <li>Annuel : 239 &euro;/an (jusqu&apos;&agrave; 5 membres inclus)</li>
              </ul>

              <p className="mt-3">Les tarifs sont indiqués en euros TTC. KamerleonTech étant auto-entrepreneur, la TVA n&apos;est pas applicable (article 293 B du CGI).</p>
              <p className="mt-2">KamerleonTech se réserve le droit de modifier ses tarifs. Les modifications s&apos;appliqueront aux nouveaux abonnements et aux renouvellements suivant la date de modification. Les abonnés en cours seront informés par email au moins 30 jours avant l&apos;entrée en vigueur des nouveaux tarifs.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">3. Période d&apos;essai</h2>
              <p>Chaque nouveau Professionnel bénéficie d&apos;une période d&apos;essai gratuite de <strong>30 jours</strong> avec accès complet aux fonctionnalités de la plateforme. Aucun moyen de paiement n&apos;est requis pour la période d&apos;essai.</p>
              <p className="mt-2">À l&apos;issue de la période d&apos;essai, le Professionnel doit souscrire un abonnement pour continuer à utiliser les services.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Souscription et paiement</h2>
              <p>La souscription à un abonnement s&apos;effectue directement sur la Plateforme. Le paiement est traité de manière sécurisée par <strong>Stripe</strong> (certifié PCI-DSS). KamerleonTech n&apos;a jamais accès aux informations bancaires complètes.</p>
              <p className="mt-2">Modes de paiement acceptés : carte bancaire (Visa, Mastercard, American Express).</p>
              <p className="mt-2">Le paiement est dû à la date de souscription, puis automatiquement renouvelé à chaque échéance (mensuelle ou annuelle) sauf résiliation.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">5. Renouvellement</h2>
              <p>Les abonnements sont renouvelés automatiquement à leur échéance pour une durée identique, sauf résiliation par le Professionnel avant la date de renouvellement.</p>
              <p className="mt-2">Un email de rappel est envoyé avant chaque renouvellement.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">6. Résiliation</h2>
              <p>Le Professionnel peut résilier son abonnement à tout moment depuis son espace de gestion (Paramètres &gt; Abonnement) ou via le portail Stripe.</p>
              <p className="mt-2">La résiliation prend effet à la fin de la période en cours. Le Professionnel conserve l&apos;accès aux services jusqu&apos;à l&apos;expiration de la période payée. Aucun remboursement prorata n&apos;est effectué pour la période restante.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">7. Droit de rétractation</h2>
              <p>Conformément à l&apos;article L.221-28 du Code de la consommation, le droit de rétractation ne s&apos;applique pas aux contrats de fourniture de contenu numérique non fourni sur un support matériel dont l&apos;exécution a commencé avec l&apos;accord du consommateur.</p>
              <p className="mt-2">En souscrivant un abonnement, le Professionnel accepte l&apos;exécution immédiate du service et renonce expressément à son droit de rétractation. La période d&apos;essai gratuite de 30 jours permet de tester le service avant tout engagement financier.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">8. Accès au service</h2>
              <p>L&apos;abonnement donne accès aux fonctionnalités décrites dans le plan choisi. KamerleonTech peut faire évoluer les fonctionnalités incluses dans chaque plan, sous réserve de ne pas réduire substantiellement le service sans en informer les abonnés.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">9. Responsabilité</h2>
              <p>KamerleonTech s&apos;engage à fournir un service conforme à sa description. Toutefois, la responsabilité de KamerleonTech est limitée au montant des sommes effectivement versées par le Professionnel au cours des 12 derniers mois.</p>
              <p className="mt-2">KamerleonTech ne saurait être tenue responsable des pertes de chiffre d&apos;affaires, de clientèle ou de données résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le service.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">10. Données et portabilité</h2>
              <p>En cas de résiliation, le Professionnel peut demander l&apos;export de ses données (clients, réservations) en contactant <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a>. Les données seront fournies dans un format structuré et lisible dans un délai de 30 jours.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">11. Modification des CGV</h2>
              <p>KamerleonTech se réserve le droit de modifier les présentes CGV. Les modifications seront communiquées par email aux abonnés au moins 30 jours avant leur entrée en vigueur. La poursuite de l&apos;utilisation du service après cette date vaut acceptation des nouvelles conditions.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">12. Droit applicable et litiges</h2>
              <p>Les présentes CGV sont régies par le droit français. En cas de litige, une solution amiable sera recherchée en priorité. Le Professionnel peut recourir gratuitement au service de médiation CM2C (<a href="https://www.cm2c.net" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">www.cm2c.net</a>). À défaut, les tribunaux compétents de Paris seront saisis.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">13. Contact</h2>
              <p>Pour toute question relative aux présentes CGV :</p>
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
