/**
 * DevFAB - Development Floating Action Button
 * Navigation menu and theme configurator for development
 * Only visible in __DEV__ mode
 */

import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { ThemeConfigurator } from './ThemeConfigurator';
import { resetOnboarding } from '../../utils';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  action: () => void;
}

export function DevFAB() {
  const { colors, radius, shadows, spacing } = useTheme();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);

  // Don't render in production
  if (!__DEV__) {
    return null;
  }

  const menuItems: MenuItem[] = [
    {
      icon: 'color-palette-outline',
      label: 'Design System',
      action: () => {
        setIsMenuOpen(false);
        router.push('/design-system');
      },
    },
    {
      icon: 'cube-outline',
      label: 'Composants Métier',
      action: () => {
        setIsMenuOpen(false);
        router.push('/business-components');
      },
    },
    {
      icon: 'home-outline',
      label: 'Accueil',
      action: () => {
        setIsMenuOpen(false);
        router.push('/');
      },
    },
    {
      icon: 'settings-outline',
      label: 'Thème',
      action: () => {
        setIsMenuOpen(false);
        setIsConfiguratorOpen(true);
      },
    },
    {
      icon: 'refresh-outline',
      label: 'Reset Onboarding',
      action: async () => {
        await resetOnboarding();
        setIsMenuOpen(false);
        router.replace('/');
      },
    },
  ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      {/* FAB Button */}
      <Pressable
        onPress={toggleMenu}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.full,
            ...shadows.md,
          },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons
          name={isMenuOpen ? 'close' : 'code-slash'}
          size={18}
          color={colors.textInverse}
        />
      </Pressable>

      {/* Menu Modal */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsMenuOpen(false)}
        >
          <View
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                ...shadows.xl,
              },
            ]}
          >
            <Text
              variant="label"
              color="textSecondary"
              style={[styles.menuTitle, { paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}
            >
              DEV MENU
            </Text>
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                onPress={item.action}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  },
                  pressed && { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: spacing.md }}
                />
                <Text variant="body">{item.label}</Text>
              </Pressable>
            ))}
            <View style={{ height: spacing.sm }} />
          </View>
        </Pressable>
      </Modal>

      {/* Theme Configurator */}
      <ThemeConfigurator
        visible={isConfiguratorOpen}
        onClose={() => setIsConfiguratorOpen(false)}
      />
    </>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 24,
    paddingBottom: 100, // Above the FAB
  },
  menu: {
    minWidth: 200,
    overflow: 'hidden',
  },
  menuTitle: {
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
