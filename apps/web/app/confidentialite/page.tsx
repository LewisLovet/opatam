import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Politique de confidentialité et protection des données personnelles sur Opatam. Conformité RGPD, droits des utilisateurs, cookies.',
  alternates: {
    canonical: 'https://opatam.com/confidentialite',
  },
  robots: { index: false, follow: false },
};

export default function ConfidentialitePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">Politique de confidentialité</h1>
          <p className="mb-8 text-sm text-gray-500">Dernière mise à jour : 11 mai 2026</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Responsable du traitement</h2>
              <p>Le responsable du traitement des données personnelles est :</p>
              <ul className="mt-3 list-none space-y-1">
                <li><strong>KamerleonTech</strong> - Auto-entrepreneur</li>
                <li>SIRET : 92766332800015</li>
                <li>3 avenue Charles de Gaulle, Chilly-Mazarin</li>
                <li>Email : <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a></li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Données collectées</h2>
              <p>Dans le cadre de l&apos;utilisation de la plateforme Opatam, nous collectons les données suivantes :</p>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Pour les clients</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Nom et prénom</li>
                <li>Adresse email</li>
                <li>Numéro de téléphone (facultatif)</li>
                <li>Historique des réservations</li>
              </ul>

              <h3 className="mt-4 mb-2 font-semibold text-gray-900">Pour les professionnels</h3>
              <ul className="list-disc pl-6 space-y-1">
                <li>Nom et prénom, nom commercial</li>
                <li>Adresse email et numéro de téléphone</li>
                <li>Informations sur l&apos;activité (catégorie, prestations, tarifs, disponibilités)</li>
                <li>Photos de profil et de portfolio</li>
                <li>Données de facturation et de paiement (gérées par Stripe)</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">3. Finalités du traitement</h2>
              <p>Les données collectées sont utilisées pour :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>La création et la gestion des comptes utilisateurs</li>
                <li>La mise en relation entre clients et professionnels</li>
                <li>La gestion des réservations et l&apos;envoi de rappels</li>
                <li>L&apos;envoi de notifications (email, push) relatives aux rendez-vous</li>
                <li>La gestion des abonnements et la facturation</li>
                <li>L&apos;amélioration du service</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Base légale du traitement</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Exécution du contrat :</strong> gestion des comptes, réservations, abonnements</li>
                <li><strong>Consentement :</strong> envoi de notifications marketing, cookies non essentiels</li>
                <li><strong>Intérêt légitime :</strong> amélioration du service, prévention de la fraude</li>
                <li><strong>Obligation légale :</strong> conservation des données de facturation</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">5. Sous-traitants et destinataires</h2>
              <p>Vos données peuvent être transmises aux sous-traitants suivants, dans le strict cadre des finalités décrites :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li><strong>Google Firebase</strong> (Google Cloud Platform) : hébergement et base de données (UE - europe-west1)</li>
                <li><strong>Vercel Inc.</strong> : hébergement du site web, statistiques d&apos;audience agrégées (Vercel Analytics) et indicateurs de performance (Speed Insights) sans cookie publicitaire</li>
                <li><strong>Stripe Inc.</strong> : traitement des paiements par carte bancaire</li>
                <li><strong>RevenueCat</strong> : gestion des abonnements achetés via l&apos;App Store et le Google Play Store</li>
                <li><strong>Resend</strong> : envoi des emails transactionnels (confirmations, rappels)</li>
                <li><strong>Expo (EAS)</strong> : envoi des notifications push mobiles</li>
                <li><strong>Microsoft Clarity</strong> : analyse anonymisée des parcours utilisateurs sur le site (avec anonymisation d&apos;adresse IP et de saisies clavier)</li>
                <li>
                  <strong>Meta Platforms Ireland Ltd.</strong> (Facebook / Instagram) : mesure de l&apos;efficacité des
                  campagnes publicitaires et création d&apos;audiences similaires. Les données transmises sont
                  <strong> hashées (SHA-256)</strong> côté client avant envoi : adresse email, identifiant utilisateur,
                  nom, téléphone et ville. Sur mobile, l&apos;identifiant publicitaire de l&apos;appareil (IDFA sur iOS,
                  AAID sur Android) est également transmis, <em>uniquement</em> si vous y avez consenti via le
                  système d&apos;App Tracking Transparency d&apos;Apple ou la bannière de consentement Android.
                  Les évènements de conversion (inscription, achat, abonnement) sont également transmis via
                  l&apos;<em>API Conversions</em> de Meta côté serveur. Ce traitement est gouverné par la
                  <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline"> politique de confidentialité de Meta</a>.
                </li>
              </ul>
              <p className="mt-2">
                Le partage de données avec Meta est conditionné à votre <strong>consentement explicite</strong> :
                bannière de cookies sur le site web (vous pouvez refuser à tout moment), prompt iOS
                « Autoriser le suivi » sur l&apos;application mobile. Aucune donnée n&apos;est vendue ou cédée à
                des tiers à d&apos;autres fins que celles décrites ci-dessus.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">6. Durée de conservation</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Données de compte :</strong> conservées pendant la durée d&apos;utilisation du service, puis supprimées dans un délai de 30 jours après suppression du compte</li>
                <li><strong>Données de réservation :</strong> conservées 3 ans après la dernière réservation</li>
                <li><strong>Données de facturation :</strong> conservées 10 ans conformément aux obligations comptables</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">7. Cookies et traceurs</h2>
              <p>Le site utilise deux catégories de cookies et traceurs :</p>
              <h3 className="mt-3 mb-1 font-semibold text-gray-900">Cookies strictement nécessaires</h3>
              <p>Authentification, session, préférences de l&apos;utilisateur, mémoire du choix de consentement. Ces cookies sont indispensables au fonctionnement du service et ne nécessitent pas votre consentement préalable.</p>
              <h3 className="mt-3 mb-1 font-semibold text-gray-900">Cookies de mesure publicitaire (Meta Pixel)</h3>
              <p>Soumis à votre <strong>consentement explicite</strong> via la bannière de cookies affichée à votre première visite. Le Pixel Meta dépose le cookie <code>_fbp</code> et, si vous arrivez via une publicité, le cookie <code>_fbc</code>. Ces cookies permettent à Meta de mesurer l&apos;efficacité de nos campagnes publicitaires et de constituer des audiences similaires. Vous pouvez retirer votre consentement à tout moment en supprimant les cookies dans votre navigateur ou en nous écrivant à <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a>.</p>
              <h3 className="mt-3 mb-1 font-semibold text-gray-900">Statistiques d&apos;audience anonymisées</h3>
              <p>Vercel Analytics, Vercel Speed Insights et Microsoft Clarity collectent des données agrégées (pages vues, temps de chargement, parcours utilisateurs anonymisés) sans cookie publicitaire et avec anonymisation IP. Ces traceurs respectent les critères CNIL d&apos;exemption de consentement.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">8. Application mobile — App Tracking Transparency</h2>
              <p>
                Sur iOS, conformément aux exigences d&apos;Apple, une demande d&apos;autorisation
                <em> « App Tracking Transparency » </em>vous est présentée à la première utilisation de
                l&apos;application Opatam après votre inscription. Cette demande concerne uniquement
                l&apos;accès à l&apos;identifiant publicitaire de votre appareil (IDFA), utilisé pour mesurer
                l&apos;efficacité de nos campagnes publicitaires sur les plateformes de Meta.
              </p>
              <p className="mt-2">
                <strong>Refuser n&apos;a aucun impact sur le fonctionnement de l&apos;application.</strong>
                Vous pouvez modifier votre choix à tout moment dans <em>Réglages iOS → Confidentialité
                et sécurité → Suivi → Opatam</em>.
              </p>
              <p className="mt-2">
                Sur Android, le même principe s&apos;applique via les paramètres système
                <em> « Paramètres → Confidentialité → Annonces »</em> où vous pouvez désactiver
                l&apos;identifiant publicitaire (AAID).
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">9. Vos droits (RGPD)</h2>
              <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li><strong>Droit d&apos;accès :</strong> obtenir une copie de vos données personnelles</li>
                <li><strong>Droit de rectification :</strong> corriger des données inexactes ou incomplètes</li>
                <li><strong>Droit à l&apos;effacement :</strong> demander la suppression de vos données</li>
                <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
                <li><strong>Droit d&apos;opposition :</strong> vous opposer au traitement de vos données</li>
                <li><strong>Droit à la limitation :</strong> limiter le traitement de vos données</li>
              </ul>
              <p className="mt-3">Pour exercer ces droits, contactez-nous à : <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a></p>
              <p className="mt-2">Vous disposez également du droit d&apos;introduire une réclamation auprès de la CNIL (Commission Nationale de l&apos;Informatique et des Libertés) : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">www.cnil.fr</a></p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">10. Sécurité</h2>
              <p>Nous mettons en oeuvre les mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement des communications (HTTPS/TLS), authentification sécurisée via Firebase Auth, accès restreint aux données, et paiements sécurisés via Stripe (certifié PCI-DSS).</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">11. Modifications</h2>
              <p>Nous nous réservons le droit de modifier la présente politique de confidentialité. Toute modification sera publiée sur cette page avec la date de mise à jour. En cas de modification substantielle, les utilisateurs seront informés par email.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">12. Contact</h2>
              <p>Pour toute question relative à la protection de vos données personnelles :</p>
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
