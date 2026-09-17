import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { chargerEcran } from '@/lib/ecran';
import { ProviderThemeStyle } from '@/components/theme/ProviderThemeStyle';
import { EcranClient } from './EcranClient';

/**
 * Écran du salon — /ecran/{id}?k={secret}
 *
 * Page sans menu ni pied de page, pensée pour une TV ou une tablette
 * allumée toute la journée dans le lieu. Le premier rendu vient du
 * serveur (rien de vide au démarrage), puis le client rafraîchit toutes
 * les 60 s via /api/ecran/{id}. Jamais indexée.
 */

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ k?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { k = '' } = await searchParams;
  const donnees = await chargerEcran(id, k).catch(() => null);
  return {
    title: donnees ? `${donnees.provider.businessName} · Écran du salon` : 'Écran du salon',
    robots: { index: false, follow: false },
  };
}

export default async function EcranPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { k = '' } = await searchParams;
  const donnees = await chargerEcran(id, k);
  if (!donnees) notFound();
  return (
    <div data-provider-theme>
      <ProviderThemeStyle themeId={donnees.provider.themeId} />
      <EcranClient initial={donnees} id={id} secret={k} />
    </div>
  );
}
