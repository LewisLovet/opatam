/**
 * Booking Flow Layout
 * Wraps booking screens with BookingProvider for shared state
 */

import { Stack, useLocalSearchParams } from 'expo-router';
import { BookingProvider, useProvidersCache } from '../../../../contexts';
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
  const { getCachedProviderById } = useProvidersCache();

  /**
   * Comme sur la fiche, la couleur est connue avant la lecture Firestore.
   *
   * Ici l'enjeu est plus fort : la cliente ARRIVE de la fiche, déjà aux
   * couleurs du salon. Un tunnel qui s'ouvre en bleu avant de virer au
   * bordeaux annule précisément la continuité que ce layout cherche à
   * établir, et au moment le plus mal choisi — celui où elle s'engage.
   *
   * La fiche dépose ce qu'elle a chargé dans le cache, ce tunnel l'y reprend
   * par identifiant.
   */
  const themeId = provider?.themeId ?? getCachedProviderById(providerId)?.themeId;

  // `useTheme()` ci-dessus lit le thème EXTÉRIEUR, et c'est voulu : seul
  // `colors.background` en dépend, une couleur que l'accent ne touche pas.
  return (
    <BookingProvider>
      <ProviderAccent themeId={themeId}>
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
