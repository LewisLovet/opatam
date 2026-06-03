/**
 * Default cover image for a provider category.
 *
 * Returns a path under /public/category-covers/<id>.jpg. Callers render it as
 * an <img> layered over the blue gradient cover, with an onError that hides the
 * <img> — so any category WITHOUT an image file simply falls back to the
 * gradient (no broken image, no regression). This lets us add category covers
 * incrementally just by dropping files into public/category-covers/.
 *
 * Used on the real public fiche (ProviderHero) AND the registration live
 * preview, so a brand-new provider (no cover photo yet) gets a category-themed
 * banner on both surfaces.
 */
export function categoryCover(category?: string | null): string | null {
  if (!category) return null;
  return `/category-covers/${category}.jpg`;
}
