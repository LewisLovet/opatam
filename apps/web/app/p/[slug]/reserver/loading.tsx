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
  return <BrandLoading label={t('loading')} />;
}
