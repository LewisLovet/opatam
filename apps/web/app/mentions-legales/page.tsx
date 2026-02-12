import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site opatam.com et de l\'application mobile Opatam. Éditeur, hébergeur, propriété intellectuelle.',
  alternates: {
    canonical: 'https://opatam.com/mentions-legales',
  },
};

export default function MentionsLegalesPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">Mentions légales</h1>
          <p className="mb-8 text-sm text-gray-500">Dernière mise à jour : 9 février 2026</p>

          <div className="space-y-8 text-gray-700 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">1. Éditeur du site</h2>
              <p>Le site <strong>opatam.com</strong> et l&apos;application mobile <strong>Opatam</strong> sont édités par :</p>
              <ul className="mt-3 list-none space-y-1">
                <li><strong>Raison sociale :</strong> KamerleonTech</li>
                <li><strong>Statut :</strong> Auto-entrepreneur</li>
                <li><strong>SIRET :</strong> 92766332800015</li>
                <li><strong>Adresse :</strong> 3 avenue Charles de Gaulle, Chilly-Mazarin</li>
                <li><strong>Email :</strong> contact@opatam.com</li>
                <li><strong>Directeur de la publication :</strong> KamerleonTech</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">2. Hébergement</h2>
              <p><strong>Site web :</strong> Hébergé par Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.</p>
              <p className="mt-2"><strong>Application mobile :</strong> Distribuée via l&apos;Apple App Store et le Google Play Store.</p>
              <p className="mt-2"><strong>Données :</strong> Les données sont stockées sur les serveurs de Google Firebase (Google Cloud Platform), localisés dans l&apos;Union européenne (région europe-west1).</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">3. Description du service</h2>
              <p>Opatam est une plateforme de réservation en ligne permettant aux professionnels indépendants de gérer leurs rendez-vous, leur agenda et leur visibilité en ligne. Les clients peuvent rechercher des professionnels et réserver des prestations directement via le site web ou l&apos;application mobile.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">4. Propriété intellectuelle</h2>
              <p>L&apos;ensemble du contenu du site web et de l&apos;application (structure, textes, graphiques, images, logos, icônes, code source, algorithmes) est la propriété exclusive de KamerleonTech ou fait l&apos;objet d&apos;une autorisation d&apos;utilisation.</p>
              <p className="mt-2">Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site ou de l&apos;application, quel que soit le moyen ou le procédé utilisé, est interdite sans l&apos;autorisation écrite préalable de KamerleonTech.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">5. Limitation de responsabilité</h2>
              <p>KamerleonTech s&apos;efforce d&apos;assurer l&apos;exactitude et la mise à jour des informations diffusées sur la plateforme, mais ne saurait être tenue responsable :</p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>Des erreurs, omissions ou résultats obtenus suite à l&apos;utilisation du service</li>
                <li>Des interruptions temporaires du service pour maintenance ou mise à jour</li>
                <li>Du contenu publié par les professionnels inscrits sur la plateforme</li>
                <li>Des litiges entre professionnels et clients découlant de prestations réservées</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">6. Données personnelles</h2>
              <p>La collecte et le traitement des données personnelles sont décrits dans notre <a href="/confidentialite" className="text-indigo-600 hover:underline">Politique de confidentialité</a>.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">7. Droit applicable</h2>
              <p>Les présentes mentions légales sont régies par le droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux français seront seuls compétents.</p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">8. Contact</h2>
              <p>Pour toute question relative aux présentes mentions légales, vous pouvez nous contacter à l&apos;adresse : <a href="mailto:contact@opatam.com" className="text-indigo-600 hover:underline">contact@opatam.com</a></p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
