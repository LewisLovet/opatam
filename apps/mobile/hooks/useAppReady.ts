/**
 * useAppReady Hook
 * Manages app initialization: fonts, initial data, and splash screen
 */

import { useState, useEffect, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

/**
 * Vignettes des catégories de l'accueil. Préchargées pour que la grille
 * n'apparaisse pas case par case — mais SANS retenir le démarrage.
 */
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
        // Les polices, elles, doivent être là : sans elles les icônes
        // s'affichent en carrés puis se remplacent, et c'est un fichier
        // local, borné.
        await Font.loadAsync({
          ...Ionicons.font,
        });
      } catch (e) {
        console.warn('Error during app preparation:', e);
      } finally {
        setIsReady(true);
      }
    }

    prepare();

    /**
     * Les vignettes se chargent À CÔTÉ, sans être attendues.
     *
     * Elles l'étaient : le démarrage entier dépendait de six photos servies
     * par un CDN tiers. Or `RootLayout` ne rend rien tant que ce n'est pas
     * fini, donc l'application restait sur le splash natif pendant toute la
     * durée du téléchargement, et l'écran de chargement au logo — celui qui
     * anime, `AppBootSplash` — ne pouvait pas apparaître avant. D'où
     * l'impression que le logo met du temps à venir : ce n'est pas le logo
     * qui est lent, c'est qu'on l'attend derrière Unsplash. Sur réseau lent
     * ou coupé, l'attente allait jusqu'à l'expiration des requêtes.
     *
     * Rien ici n'est nécessaire pour afficher le premier écran. Au pire les
     * vignettes de l'accueil arrivent avec un instant de retard, ce qui est
     * précisément ce que fait n'importe quelle image d'une liste.
     */
    Image.prefetch(CRITICAL_IMAGES).catch((e) => {
      console.warn('Prefetch des vignettes de catégories:', e);
    });
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (isReady) {
      await SplashScreen.hideAsync();
    }
  }, [isReady]);

  return { isReady, onLayoutRootView };
}
