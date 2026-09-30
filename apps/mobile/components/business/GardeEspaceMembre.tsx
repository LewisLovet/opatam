/**
 * GardeEspaceMembre — ce qu'un MEMBRE connecté peut ouvrir dans les écrans pro.
 *
 * L'espace membre réutilise les écrans du gérant (agenda, réservations,
 * horaires, indisponibilités), figés sur le membre connecté. Tout le reste
 * — abonnement, paiements, prestations, équipe, lieux, réglages du salon,
 * statistiques du salon — n'est pas à lui : une route hors de la liste
 * ramène à son agenda. Les règles Firestore et le serveur refusent de toute
 * façon ces écritures ; cette garde évite d'y mener.
 *
 * Salon repassé hors Studio (ou abonnement tombé) : écran « accès suspendu »,
 * avec de quoi se déconnecter.
 */
import React, { type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Redirect, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth, useEspaceMembre } from '../../contexts';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { Button } from '../Button';
import { Loader } from '../Loader';
import { estOuvertAuMembre } from '../../lib/espaceMembre';

export function GardeEspaceMembre({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const { estMembre, accesOuvert } = useEspaceMembre();
  const { userData, compteMembre, signOut } = useAuth();
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  // Ni gérant ni membre (accès retiré pendant la session) : retour à
  // l'aiguillage, qui l'enverra côté client.
  if (userData && !userData.providerId && compteMembre === null) {
    return <Redirect href="/" />;
  }
  if (!estMembre) return <>{children}</>;

  if (accesOuvert === null) {
    return (
      <View style={[s.centre, { backgroundColor: colors.background }]}>
        <Loader />
      </View>
    );
  }
  if (accesOuvert === false) {
    return (
      <View style={[s.centre, { backgroundColor: colors.background, padding: spacing.xl }]}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.textMuted} />
        <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
          {t('espaceMembre.suspendu.titre')}
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
          {t('espaceMembre.suspendu.texte')}
        </Text>
        <View style={{ marginTop: spacing.xl, alignSelf: 'stretch' }}>
          <Button title={t('espaceMembre.menu.deconnexion')} variant="outline" onPress={() => signOut()} />
        </View>
      </View>
    );
  }
  if (segments.length > 1 && !estOuvertAuMembre(segments)) {
    return <Redirect href={'/(pro)/(tabs)/calendar' as never} />;
  }
  return <>{children}</>;
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
