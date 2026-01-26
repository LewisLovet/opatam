/**
 * ThemeConfigurator
 * Modal for testing theme configurations (colors, radius, spacing)
 */

import React, { useState } from 'react';
import {
  View,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  SafeAreaView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import {
  useTheme,
  useThemeConfig,
  primaryColorPresets,
} from '../../theme';
import { Text } from '../Text';
import { Button } from '../Button';
import { Divider } from '../Divider';
import { Card } from '../Card';

interface ThemeConfiguratorProps {
  visible: boolean;
  onClose: () => void;
}

export function ThemeConfigurator({ visible, onClose }: ThemeConfiguratorProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const { config, updateConfig, resetConfig } = useThemeConfig();

  // Local state for sliders
  const [radiusMultiplier, setRadiusMultiplier] = useState(
    config.radiusMultiplier ?? 1
  );
  const [spacingMultiplier, setSpacingMultiplier] = useState(
    config.spacingMultiplier ?? 1
  );

  const handleColorSelect = (color: string) => {
    updateConfig({
      primaryColor: color,
      primaryLightColor: `${color}20`,
      primaryDarkColor: color,
    });
  };

  const handleRadiusChange = (value: number) => {
    setRadiusMultiplier(value);
    updateConfig({ radiusMultiplier: value });
  };

  const handleSpacingChange = (value: number) => {
    setSpacingMultiplier(value);
    updateConfig({ spacingMultiplier: value });
  };

  const handleReset = () => {
    resetConfig();
    setRadiusMultiplier(1);
    setSpacingMultiplier(1);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
          ]}
        >
          <Text variant="h3">Configurateur de thème</Text>
          <Pressable
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Divider spacing={0} />

        <ScrollView
          style={styles.content}
          contentContainerStyle={{ padding: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* Color Presets */}
          <View style={[styles.section, { marginBottom: spacing['2xl'] }]}>
            <Text
              variant="label"
              color="textSecondary"
              style={{ marginBottom: spacing.md }}
            >
              COULEUR PRIMAIRE
            </Text>
            <View style={styles.colorGrid}>
              {primaryColorPresets.map((preset) => (
                <Pressable
                  key={preset.color}
                  onPress={() => handleColorSelect(preset.color)}
                  style={[
                    styles.colorOption,
                    {
                      borderRadius: radius.md,
                      borderWidth: 2,
                      borderColor:
                        config.primaryColor === preset.color
                          ? colors.text
                          : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: preset.color,
                        borderRadius: radius.sm,
                      },
                    ]}
                  />
                  <Text variant="caption" align="center" numberOfLines={1}>
                    {preset.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Border Radius */}
          <View style={[styles.section, { marginBottom: spacing['2xl'] }]}>
            <Text
              variant="label"
              color="textSecondary"
              style={{ marginBottom: spacing.sm }}
            >
              BORD ARRONDI
            </Text>
            <View style={styles.sliderRow}>
              <Text variant="bodySmall">Carré</Text>
              <Text variant="bodySmall">Arrondi</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2}
              step={0.25}
              value={radiusMultiplier}
              onValueChange={handleRadiusChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <Text variant="caption" color="textMuted" align="center">
              Multiplicateur: {radiusMultiplier.toFixed(2)}x
            </Text>
          </View>

          {/* Spacing */}
          <View style={[styles.section, { marginBottom: spacing['2xl'] }]}>
            <Text
              variant="label"
              color="textSecondary"
              style={{ marginBottom: spacing.sm }}
            >
              ESPACEMENT
            </Text>
            <View style={styles.sliderRow}>
              <Text variant="bodySmall">Compact</Text>
              <Text variant="bodySmall">Spacieux</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.75}
              maximumValue={1.25}
              step={0.05}
              value={spacingMultiplier}
              onValueChange={handleSpacingChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
            <Text variant="caption" color="textMuted" align="center">
              Multiplicateur: {spacingMultiplier.toFixed(2)}x
            </Text>
          </View>

          {/* Preview */}
          <View style={[styles.section, { marginBottom: spacing['2xl'] }]}>
            <Text
              variant="label"
              color="textSecondary"
              style={{ marginBottom: spacing.md }}
            >
              APERÇU
            </Text>
            <Card shadow="md" padding="md">
              <Text variant="h3" style={{ marginBottom: spacing.sm }}>
                Titre de carte
              </Text>
              <Text
                variant="body"
                color="textSecondary"
                style={{ marginBottom: spacing.md }}
              >
                Ceci est un exemple de texte pour prévisualiser le thème actuel.
              </Text>
              <View style={styles.previewButtons}>
                <Button title="Primary" size="sm" style={{ flex: 1 }} />
                <View style={{ width: spacing.sm }} />
                <Button
                  title="Outline"
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          </View>

          {/* Reset Button */}
          <Button
            title="Réinitialiser"
            variant="ghost"
            onPress={handleReset}
            fullWidth
          />

          {/* Bottom spacing */}
          <View style={{ height: spacing['3xl'] }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    // Margin applied dynamically
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOption: {
    width: '30%',
    padding: 8,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 40,
    height: 40,
    marginBottom: 4,
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  previewButtons: {
    flexDirection: 'row',
  },
});
