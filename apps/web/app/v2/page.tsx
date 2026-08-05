/**
 * /v2 — seconde page d'accueil, en test à côté de l'existante.
 *
 * HORS RÉFÉRENCEMENT, volontairement. Deux pages d'accueil au contenu proche
 * se cannibalisent : Google choisirait lui-même laquelle afficher, et le
 * trafic se diluerait sur les deux. La page reste accessible par son adresse
 * — c'est tout ce qu'un test demande — mais elle est exclue de l'index et
 * absente du sitemap.
 *
 * Elle ne partage AUCUN composant avec `/` : sa direction artistique vit dans
 * un module CSS qui lui appartient. L'accueil qui convertit aujourd'hui ne
 * peut donc pas être abîmé par ce qu'on essaie ici.
 */

import type { Metadata } from 'next';
import { articleRepository } from '@booking-app/firebase';
import type { ArticleCardData } from '@/app/blog/components/ArticleCard';
import { LandingV2 } from './LandingV2';

export const metadata: Metadata = {
  title: 'Opatam — réservation en ligne sans commission',
  robots: { index: false, follow: false },
};

// Même fenêtre de revalidation que l'accueil : le bloc tutoriels suit les
// publications sans reconstruire la page à chaque visite.
export const revalidate = 1800;

export default async function V2Page() {
  // Tolérant, comme l'accueil : une liste vide masque la section plutôt que
  // de casser la page.
  const docs = await articleRepository.getPublishedByCategory('tutoriels', 3).catch((err) => {
    console.error('[v2] getPublishedByCategory(tutoriels) failed:', err);
    return [];
  });

  const tutorials: ArticleCardData[] = docs.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    coverImageURL: a.coverImageURL,
    category: a.category,
    videoUrl: a.videoUrl,
    videoCoverURL: a.videoCoverURL,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    authorName: a.authorName,
  }));

  return <LandingV2 tutorials={tutorials} />;
}
