/**
 * AppBootSplash — l'écran d'attente juste après le splash natif.
 *
 * `app/index.tsx` doit résoudre l'authentification et l'état d'onboarding
 * avant de savoir où envoyer l'utilisateur. Ce laps de temps affichait un
 * `ActivityIndicator` nu sur fond clair : après un splash bleu plein
 * écran, la rupture était brutale et donnait l'impression d'un temps mort.
 *
 * On garde donc le même décor — dégradé, logo pulsant, points — pour que
 * le démarrage se lise comme une seule séquence continue.
 *
 * DÉLIBÉRÉMENT SANS PHRASE, contrairement au splash de mise à jour : ici
 * il ne se passe rien d'exceptionnel et l'attente dure en général moins
 * d'une seconde. Une phrase du type « Nous préparons votre espace… »
 * n'aurait pas le temps d'être lue, et laisserait croire à un traitement
 * long là où il n'y en a pas.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandSplash, SPLASH_PRIMARY, splashStyles } from './BrandSplash';

export function AppBootSplash() {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        splashStyles.scene,
        // Couleur de fond identique au splash natif : elle couvre le
        // temps que le dégradé se peigne, évitant un flash blanc.
        { backgroundColor: SPLASH_PRIMARY },
      ]}
    >
      <BrandSplash />
    </View>
  );
}
