/**
 * LoyaltyActivationSheet
 *
 * Feuille d'activation d'une carte de fidélité (POST /api/loyalty/activate),
 * avec l'opt-in emails promos PRÉ-COCHÉ et révocable. Partagée par l'espace
 * fidélité et la page du prestataire : le serveur crée le doc s'il n'existe
 * pas, la feuille est donc identique qu'on ait déjà une carte ou non.
 *
 * L'appel réseau est encapsulé ici ; l'écran appelant n'a plus qu'à réagir
 * au succès (`onActivated`) — rafraîchir ses cartes puis jouer la révélation.
 *
 * C'est ICI qu'on découvre la carte et ses emplacements vides : la page du
 * prestataire n'affiche qu'un bloc compact avec le bouton, pour ne pas
 * encombrer la page avant que le client s'y intéresse.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Button } from '../../Button';
import { OverlaySheet } from '../../OverlaySheet';
import { useAuth } from '../../../contexts';
import { postLoyaltyActivation } from '../../../hooks/useLoyaltyCards';
import { StampRow } from './StampRow';

export interface LoyaltyActivationSheetProps {
  visible: boolean;
  providerId: string | null;
  businessName: string;
  /** Seuil du programme — la carte vierge affichée dans la feuille. */
  threshold: number;
  /** Fermeture demandée par l'utilisateur (ignorée pendant l'appel réseau). */
  onClose: () => void;
  /**
   * Activation acceptée par le serveur. L'appelant rafraîchit ses données
   * et ferme la feuille ; on attend sa promesse avant de rendre la main
   * (le bouton reste en chargement pendant le re-fetch).
   */
  onActivated: (promoEmailsOptIn: boolean) => void | Promise<void>;
}

export function LoyaltyActivationSheet({
  visible,
  providerId,
  businessName,
  threshold,
  onClose,
  onActivated,
}: LoyaltyActivationSheetProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [optIn, setOptIn] = React.useState(true);
  const [activating, setActivating] = React.useState(false);
  const [error, setError] = React.useState(false);

  // Chaque ouverture repart d'un état neuf : opt-in PRÉ-COCHÉ (révocable
  // ensuite depuis la carte) et aucune erreur héritée d'un essai précédent.
  React.useEffect(() => {
    if (visible) {
      setOptIn(true);
      setError(false);
    }
  }, [visible]);

  const handleActivate = async () => {
    if (!user || !providerId) return;
    setActivating(true);
    setError(false);
    const ok = await postLoyaltyActivation(user, providerId, optIn);
    if (!ok) {
      setActivating(false);
      setError(true);
      return;
    }
    await onActivated(optIn);
    setActivating(false);
  };

  return (
    <OverlaySheet
      visible={visible}
      onClose={() => {
        if (!activating) onClose();
      }}
      heightPct={0.62}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.lg,
          gap: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sheetIconWrap}>
          <View style={[styles.sheetIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="ribbon" size={34} color={colors.primary} />
          </View>
        </View>
        <Text variant="h2" style={{ textAlign: 'center' }}>
          {t('clientLoyalty.activation.sheetTitle')}
        </Text>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {t('clientLoyalty.activation.sheetDescription', { businessName })}
        </Text>

        {/* La carte, emplacements vides — dont le dernier, la récompense. */}
        {threshold > 0 && (
          <View
            style={[
              styles.blankCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
                padding: spacing.md,
              },
            ]}
          >
            <StampRow filled={0} threshold={threshold} />
          </View>
        )}

        <Pressable
          onPress={() => setOptIn((v) => !v)}
          style={({ pressed }) => [
            styles.optInCheckRow,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: 12,
              padding: spacing.md,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons
            name={optIn ? 'checkbox' : 'square-outline'}
            size={24}
            color={optIn ? colors.primary : colors.textMuted}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text variant="bodySmall">
              {t('clientLoyalty.activation.optInLabel', { businessName })}
            </Text>
            <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
              {t('clientLoyalty.activation.optInHint')}
            </Text>
          </View>
        </Pressable>

        {error && (
          <Text variant="caption" style={{ color: colors.error, textAlign: 'center' }}>
            {t('clientLoyalty.activation.error')}
          </Text>
        )}

        <Button
          title={t('clientLoyalty.activation.confirmButton')}
          onPress={() => void handleActivate()}
          loading={activating}
          fullWidth
        />
      </ScrollView>
    </OverlaySheet>
  );
}

const styles = StyleSheet.create({
  blankCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  optInCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sheetIconWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  sheetIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
