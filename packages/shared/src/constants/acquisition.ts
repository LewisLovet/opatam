/**
 * « Comment avez-vous connu Opatam ? » — la question posée à CHAQUE
 * inscription prestataire (web et mobile), obligatoire.
 *
 * Source unique des canaux : le type, le schéma zod, les deux formulaires,
 * l'admin et les analytics lisent cette liste. Ajouter un canal = une ligne
 * ici + les libellés mobiles (`auth.pro.acquisitionChannels.<id>`, 5 langues).
 *
 * `id` est stocké en base (`provider.acquisitionSource.channel`) : stable,
 * ne pas renommer. `equipe` = amené par un membre de l'équipe Opatam
 * (recoupé avec les attributions commerciales signées).
 */

export const ACQUISITION_CHANNELS = [
  { id: 'equipe', label: "Un membre de l'équipe Opatam" },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'google', label: 'Recherche Google' },
  { id: 'siteweb', label: 'Le site opatam.com' },
  { id: 'recommandation', label: 'Bouche-à-oreille / recommandation' },
  { id: 'autre', label: 'Autre…' },
] as const;

export type AcquisitionChannel = (typeof ACQUISITION_CHANNELS)[number]['id'];

export const ACQUISITION_CHANNEL_IDS = ACQUISITION_CHANNELS.map((c) => c.id) as [
  AcquisitionChannel,
  ...AcquisitionChannel[],
];

/** Libellé français d'un canal (admin, analytics) ; l'id brut si inconnu. */
export function acquisitionChannelLabel(id: string | null | undefined): string {
  if (!id) return 'Non renseigné';
  return ACQUISITION_CHANNELS.find((c) => c.id === id)?.label ?? id;
}
