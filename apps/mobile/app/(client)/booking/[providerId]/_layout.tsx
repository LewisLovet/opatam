/**
 * Booking Flow Layout
 * Wraps booking screens with BookingProvider for shared state
 */

import { Stack, useLocalSearchParams } from 'expo-router';
import { BookingProvider } from '../../../../contexts';
import { useTheme } from '../../../../theme';
import { useProviderById } from '../../../../hooks';
import { ProviderAccent } from '../../../../components/ProviderAccent';

export default function BookingLayout() {
  const { colors } = useTheme();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();

  /**
   * La couleur du salon suit la cliente dans tout le tunnel. La continuité
   * compte surtout ici : une vitrine bordeaux qui ouvre un tunnel bleu casse
   * la confiance au moment précis où elle s'engage.
   *
   * Chargé au niveau du layout et non dans chaque écran : `date` et `confirm`
   * ne lisent pas le prestataire, ils n'auraient pas eu la couleur.
   *
   * Lecture en double assumée : `index` charge déjà le prestataire de son
   * côté. La supprimer demanderait de faire descendre la donnée par un
   * contexte — un remaniement plus coûteux que le document supplémentaire
   * qu'il économise, sur un écran qui en lit déjà cinq.
   */
  const { provider } = useProviderById(providerId);

  // `useTheme()` ci-dessus lit le thème EXTÉRIEUR, et c'est voulu : seul
  // `colors.background` en dépend, une couleur que l'accent ne touche pas.
  return (
    <BookingProvider>
      <ProviderAccent themeId={provider?.themeId}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="date" />
          <Stack.Screen name="confirm" />
        </Stack>
      </ProviderAccent>
    </BookingProvider>
  );
}
