import { getTranslations } from 'next-intl/server';
import { BrandLoading } from '@/components/loading/BrandLoading';

/**
 * L'attente du tunnel de réservation.
 *
 * Sans ce fichier, Next remontait à la frontière la plus proche —
 * `p/[slug]/loading.tsx`, le squelette de la VITRINE. On cliquait donc sur
 * « Réserver » pour voir apparaître une fausse fiche prestataire, photo de
 * couverture comprise, avant que le tunnel ne la remplace. Une attente qui
 * annonce le mauvais écran est pire qu'une attente neutre.
 */
export default async function ReserverLoading() {
  const t = await getTranslations('booking.common');
  // Surface OPAQUE et pleine hauteur : sans elle, l'attente se superposait à
  // la vitrine encore peinte derrière — on voyait le logo flotter au milieu
  // des prestations. Next garde l'écran précédent jusqu'à ce que le nouveau
  // segment soit prêt ; c'est à cette attente-ci de le recouvrir.
  return (
    <div className="opatam-attente min-h-screen flex items-center justify-center">
      <style
        dangerouslySetInnerHTML={{
          __html: `
.opatam-attente { background: #ffffff; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .opatam-attente { background: #030712; }
}
:root[data-theme="dark"] .opatam-attente { background: #030712; }`,
        }}
      />
      <BrandLoading label={t('loading')} />
    </div>
  );
}
