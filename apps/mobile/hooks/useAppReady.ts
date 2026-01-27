/**
 * useAppReady Hook
 * Manages app initialization: fonts, initial data, and splash screen
 */

import { useState, useEffect, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

// Critical images to preload (home categories)
const CRITICAL_IMAGES = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400',
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400',
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400',
  'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400',
];

export function useAppReady() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // 1. Load fonts
        await Font.loadAsync({
          ...Ionicons.font,
        });

        // 2. Preload critical images (categories)
        await Image.prefetch(CRITICAL_IMAGES);
      } catch (e) {
        console.warn('Error during app preparation:', e);
      } finally {
        setIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  return { isReady, onLayoutRootView };
}
