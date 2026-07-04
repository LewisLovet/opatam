import { revalidatePath } from 'next/cache';

/**
 * Purge le Full Route Cache des pages publiques d'un prestataire pour qu'un
 * changement de visibilité (publication / dépublication) — ou de prix / dispos —
 * se reflète *immédiatement*, sans attendre la fenêtre ISR de 30 s.
 *
 * À n'appeler que depuis un contexte serveur Next (Route Handler / Server Action).
 * Best-effort : ne jette jamais dans le flux d'un webhook ou d'un handler.
 *
 * ⚠️ Le toggle publish/unpublish côté pro passe par une écriture SDK *client*
 * (`providerService.publishProvider`), qui ne transite pas par le serveur Next :
 * ce chemin-là ne peut pas déclencher `revalidatePath` et s'appuie donc sur le
 * `export const revalidate = 30` des pages `/p/[slug]*`.
 */
export function revalidateProviderPublicPages(slug?: string | null): void {
  if (!slug) return;
  try {
    revalidatePath(`/p/${slug}`);
    revalidatePath(`/p/${slug}/reserver`);
    revalidatePath(`/p/${slug}/embed`);
  } catch (err) {
    console.error(`[revalidate] purge du cache public échouée pour "${slug}":`, err);
  }
}
