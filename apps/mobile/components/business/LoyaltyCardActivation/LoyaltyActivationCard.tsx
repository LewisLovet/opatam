/**
 * LoyaltyActivationCard
 *
 * Carte à tampons + cérémonie d'activation, partagée par l'espace fidélité
 * (« Mes cartes ») et la page publique du prestataire. C'est la seule
 * implémentation de la cinématique : fondu/scale de la carte, tampons qui
 * tombent un par un, puis confettis.
 *
 * L'en-tête est injecté par l'appelant (`header`) : avatar + nom du salon
 * dans l'espace fidélité, titre du programme sur la page du prestataire —
 * le corps (tampons, voile, opt-in, animations) reste identique.
 *
 * Deux rendus possibles :
 *  - activée     → tampons + (optionnel) réglage opt-in emails ;
 *  - non activée → tampons quasi invisibles derrière un voile + CTA : on ne
 *    révèle PAS la progression avant que le client ait activé sa carte.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../../theme';
import { Card } from '../../Card';
import { Switch } from '../../Switch';
import { ActivateLoyaltyButton } from './ActivateLoyaltyButton';
import { ConfettiRain } from './ConfettiRain';
import { StampRow } from './StampRow';

export interface LoyaltyActivationCardProps {
  /** En-tête de la carte, propre à l'écran appelant. */
  header: React.ReactNode;
  /** Nombre de tampons du cycle (seuil du programme). */
  threshold: number;
  /** Tampons posés à afficher (ignoré tant que la carte n'est pas activée). */
  filled: number;
  activated: boolean;
  /** true = jouer la cinématique de révélation (vient d'être activée). */
  revealing: boolean;
  onRequestActivation: () => void;
  onRevealDone: () => void;
  /** Réglage opt-in emails promos sous les tampons (espace fidélité). */
  optIn?: { value: boolean; onChange: (value: boolean) => void } | null;
}

export function LoyaltyActivationCard({
  header,
  threshold,
  filled,
  activated,
  revealing,
  onRequestActivation,
  onRevealDone,
  optIn = null,
}: LoyaltyActivationCardProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  // --- Cinématique d'activation -------------------------------------------
  // Les Animated.Value des tampons sont créées PENDANT le render (et pas dans
  // un effet) pour que la première frame « revealing » parte bien de 0 — un
  // useEffect s'exécute après paint et laisserait flasher la jauge pleine.
  const sectionAnim = React.useRef(new Animated.Value(1)).current;
  const stampAnims = React.useRef<Animated.Value[] | null>(null);
  const [confetti, setConfetti] = React.useState(false);
  if (revealing && !stampAnims.current) {
    stampAnims.current = Array.from({ length: filled }, () => new Animated.Value(0));
    sectionAnim.setValue(0);
  }

  React.useEffect(() => {
    if (!revealing || !stampAnims.current) return;
    // Fondu/scale de la carte, puis tampons UN PAR UN (stagger 120 ms) —
    // rétroactif : la jauge peut se remplir d'un coup, effet « trésor ».
    Animated.sequence([
      Animated.timing(sectionAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.stagger(
        120,
        stampAnims.current.map((a) =>
          Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 220 }),
        ),
      ),
    ]).start(({ finished }) => {
      if (finished) setConfetti(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing]);

  const handleConfettiDone = () => {
    setConfetti(false);
    stampAnims.current = null;
    onRevealDone();
  };

  return (
    <Animated.View
      style={
        revealing
          ? {
              opacity: sectionAnim,
              transform: [
                { scale: sectionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
              ],
            }
          : null
      }
    >
      <Card padding="lg" shadow="sm">
        {header}

        {activated ? (
          <>
            <View style={{ marginTop: spacing.md }}>
              <StampRow
                filled={filled}
                threshold={threshold}
                appearAnims={revealing ? stampAnims.current : null}
              />
            </View>
            {/* Réglage opt-in emails promos, révocable à tout moment. */}
            {optIn && (
              <View
                style={[
                  styles.optInRow,
                  { marginTop: spacing.md, borderTopColor: colors.border, paddingTop: spacing.sm },
                ]}
              >
                <Switch
                  value={optIn.value}
                  onValueChange={optIn.onChange}
                  label={t(
                    optIn.value
                      ? 'clientLoyalty.activation.emailsOn'
                      : 'clientLoyalty.activation.emailsOff',
                  )}
                />
              </View>
            )}
          </>
        ) : (
          /* Jauge voilée : tampons à peine visibles + voile avec CTA.
             Ni progression ni récompense tant que la carte n'est pas activée. */
          <View
            style={[
              styles.veiledZone,
              {
                marginTop: spacing.md,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
              },
            ]}
          >
            <View style={{ opacity: 0.18 }}>
              <StampRow filled={0} threshold={threshold} />
            </View>
            <View style={[StyleSheet.absoluteFill, styles.veilOverlay]}>
              <ActivateLoyaltyButton onPress={onRequestActivation} />
            </View>
          </View>
        )}

        {confetti && <ConfettiRain onDone={handleConfettiDone} />}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  veiledZone: {
    minHeight: 68,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  veilOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  optInRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
