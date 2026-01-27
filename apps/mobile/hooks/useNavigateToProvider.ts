/**
 * useNavigateToProvider Hook
 * Preloads images before navigation using expo-image
 */

import { useState, useCallback } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useProvidersCache } from '../contexts';

interface NavigateState {
  loadingSlug: string | null;
}

const preloadedImages = new Set<string>();

export function useNavigateToProvider() {
  const router = useRouter();
  const { getCachedProvider, fetchProviderBySlug } = useProvidersCache();
  const [state, setState] = useState<NavigateState>({ loadingSlug: null });

  const navigateToProvider = useCallback(
    async (slug: string) => {
      // Already preloaded → instant navigation
      if (preloadedImages.has(slug)) {
        router.push(`/(client)/provider/${slug}`);
        return;
      }

      setState({ loadingSlug: slug });

      try {
        // 1. Get provider data
        let provider = getCachedProvider(slug);
        if (!provider) {
          provider = await fetchProviderBySlug(slug);
        }

        if (!provider) {
          setState({ loadingSlug: null });
          return;
        }

        // 2. Preload images with expo-image
        const imageUrls = [provider.coverPhotoURL, provider.photoURL].filter(
          (url): url is string => !!url && url.length > 0
        );

        if (imageUrls.length > 0) {
          // expo-image prefetch returns true if all succeeded
          await Image.prefetch(imageUrls);
        }

        preloadedImages.add(slug);

        // 3. Navigate
        router.push(`/(client)/provider/${slug}`);
      } catch (error) {
        console.error('Navigation error:', error);
        // Navigate anyway even if prefetch failed
        router.push(`/(client)/provider/${slug}`);
      } finally {
        setState({ loadingSlug: null });
      }
    },
    [router, getCachedProvider, fetchProviderBySlug]
  );

  const isLoading = useCallback(
    (slug: string) => state.loadingSlug === slug,
    [state.loadingSlug]
  );

  return {
    navigateToProvider,
    loadingSlug: state.loadingSlug,
    isLoading,
  };
}
