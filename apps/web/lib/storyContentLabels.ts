/**
 * Libellés des contenus de story (`storyEvents.content`, écrit par la
 * callable recordStoryShare). Une seule table pour l'admin : la page
 * Marketing › Stories et le tableau de bord disent la même chose.
 */
export const STORY_CONTENT_LABELS: Record<string, string> = {
  services: 'Prestations',
  availabilities: 'Disponibilités',
  review: 'Avis',
  loyalty: 'Fidélité',
  none: 'QR code',
  realisation: 'Réalisation',
  avantApres: 'Avant / après',
};

export function storyContentLabel(content: string): string {
  return STORY_CONTENT_LABELS[content] ?? content;
}
