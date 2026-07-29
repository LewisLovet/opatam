/**
 * /supprimer-mon-compte — page publique exigée par Google Play pour la
 * fiche de sécurité des données.
 *
 * Elle est INFORMATIVE : elle ne supprime rien et n'expose aucune API. La
 * suppression réelle vit dans l'application, derrière une confirmation par
 * mot de passe — c'est ce qui protège le compte, et une page web anonyme
 * ne pourrait pas offrir la même garantie.
 *
 * Accessible sans session : quelqu'un qui a perdu l'accès à son compte
 * doit pouvoir lire la marche à suivre, d'où la section « si vous ne
 * pouvez plus vous connecter ».
 *
 * Les durées de conservation reprennent MOT POUR MOT celles de
 * /confidentialite. Promettre une suppression plus rapide ou plus large
 * que la politique en vigueur créerait un engagement qu'on ne tient pas.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Supprimer mon compte Opatam',
  description:
    "Comment supprimer définitivement votre compte Opatam depuis l'application, ou par email si vous n'y avez plus accès. Données supprimées et durées de conservation.",
  alternates: {
    canonical: 'https://opatam.com/supprimer-mon-compte',
  },
};

const MAILTO =
  'mailto:contact@opatam.com?subject=' +
  encodeURIComponent('Demande de suppression de compte Opatam');

export default function SupprimerMonComptePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">
            Supprimer mon compte Opatam
          </h1>

          <div className="space-y-8 leading-relaxed text-gray-700">
            <section>
              <p>
                Vous pouvez supprimer votre compte Opatam à tout moment, que vous soyez
                client ou professionnel. La suppression se fait{' '}
                <strong>depuis l&apos;application mobile</strong>&nbsp;: c&apos;est le
                seul endroit où nous pouvons vérifier qu&apos;il s&apos;agit bien de
                vous.
              </p>
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-amber-900">
                  <strong>Cette action est irréversible.</strong> Une fois la
                  suppression confirmée, votre compte et vos données ne peuvent plus
                  être récupérés.
                </p>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Depuis l&apos;application
              </h2>
              <p>
                Ouvrez l&apos;onglet <strong>Menu</strong>, puis touchez{' '}
                <strong>Supprimer mon compte</strong>. Le chemin est le même que vous
                utilisiez Opatam en tant que client ou en tant que professionnel.
              </p>
              <ol className="mt-4 list-decimal space-y-2 pl-6">
                <li>
                  Ouvrez l&apos;application Opatam et connectez-vous si ce n&apos;est
                  pas déjà fait.
                </li>
                <li>
                  Touchez l&apos;onglet <strong>Menu</strong>, en bas à droite.
                </li>
                <li>
                  Faites défiler jusqu&apos;à <strong>Supprimer mon compte</strong>.
                </li>
                <li>
                  Saisissez votre <strong>mot de passe</strong> pour confirmer, puis
                  validez.
                </li>
              </ol>
              <p className="mt-4 text-sm text-gray-600">
                Cette confirmation par mot de passe protège votre compte&nbsp;: elle
                empêche qu&apos;une personne ayant accès à votre téléphone déverrouillé
                puisse le supprimer à votre place. Selon l&apos;ancienneté de votre
                session, une reconnexion peut également vous être demandée.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Si vous ne pouvez plus vous connecter
              </h2>
              <p>
                Compte inaccessible, application désinstallée, mot de passe perdu&nbsp;:
                écrivez-nous et nous procéderons à la suppression pour vous.
              </p>
              <p className="mt-4">
                <a
                  href={MAILTO}
                  className="inline-block rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  Demander la suppression par email
                </a>
              </p>
              <p className="mt-4 text-sm text-gray-600">
                Écrivez impérativement <strong>depuis l&apos;adresse email liée au
                compte</strong>. C&apos;est ce qui nous permet de vérifier que la
                demande vient bien de son titulaire&nbsp;; sans cela, nous ne pouvons
                pas y donner suite. Si vous préférez, l&apos;adresse est{' '}
                <a
                  href="mailto:contact@opatam.com"
                  className="text-indigo-600 hover:underline"
                >
                  contact@opatam.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Données supprimées et durées de conservation
              </h2>
              <p>
                La suppression retire votre profil, vos identifiants de connexion et
                vos préférences. Certaines données sont toutefois conservées plus
                longtemps, soit pour des raisons comptables, soit parce que la loi
                l&apos;impose&nbsp;:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  <strong>Données de compte</strong>&nbsp;: supprimées dans un délai
                  maximal de 30 jours après la suppression.
                </li>
                <li>
                  <strong>Données de réservation</strong>&nbsp;: conservées jusqu&apos;à
                  3 ans après la dernière réservation.
                </li>
                <li>
                  <strong>Données de facturation</strong>&nbsp;: conservées 10 ans
                  lorsque la loi l&apos;impose, conformément aux obligations
                  comptables.
                </li>
              </ul>
              <p className="mt-4">
                Le détail de ces traitements figure dans notre{' '}
                <Link href="/confidentialite" className="text-indigo-600 hover:underline">
                  politique de confidentialité
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Vous êtes professionnel&nbsp;?
              </h2>
              <p>
                La suppression de votre compte retire également votre fiche publique,
                vos prestations et vos disponibilités. Vos clients ne pourront plus
                réserver chez vous et vos rendez-vous à venir seront annulés. Si vous
                souhaitez simplement suspendre votre activité, dépublier votre fiche
                depuis l&apos;application est réversible, contrairement à la
                suppression.
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
