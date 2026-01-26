/**
 * Design System Showcase Page
 * Displays all UI components for testing and documentation
 */

import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import {
  Text,
  Button,
  Input,
  Card,
  Badge,
  Avatar,
  Divider,
  Loader,
  Skeleton,
  IconButton,
  Switch,
  useToast,
} from '../components';

export default function DesignSystemScreen() {
  const { colors, spacing, radius } = useTheme();
  const { showToast } = useToast();

  // State for interactive components
  const [inputValue, setInputValue] = useState('');
  const [errorInputValue, setErrorInputValue] = useState('');
  const [switchValue, setSwitchValue] = useState(false);
  const [switchValue2, setSwitchValue2] = useState(true);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text variant="h1" style={{ marginBottom: spacing.xs }}>
          Design System
        </Text>
        <Text variant="body" color="textSecondary" style={{ marginBottom: spacing['2xl'] }}>
          Composants UI pour l'application mobile Opatam
        </Text>

        {/* Typography Section */}
        <Section title="Typography">
          <Text variant="h1">Heading 1 (32px Bold)</Text>
          <Text variant="h2">Heading 2 (24px Bold)</Text>
          <Text variant="h3">Heading 3 (20px Semibold)</Text>
          <Text variant="body">Body text (16px Regular)</Text>
          <Text variant="bodySmall">Body small (14px Regular)</Text>
          <Text variant="caption">Caption text (12px Regular)</Text>
          <Text variant="label">Label text (14px Medium)</Text>
          <View style={{ marginTop: spacing.md }}>
            <Text variant="body" color="primary">Primary color text</Text>
            <Text variant="body" color="textSecondary">Secondary color text</Text>
            <Text variant="body" color="textMuted">Muted color text</Text>
            <Text variant="body" color="error">Error color text</Text>
            <Text variant="body" color="success">Success color text</Text>
          </View>
        </Section>

        {/* Buttons Section */}
        <Section title="Buttons">
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm }}>
            Variants
          </Text>
          <View style={styles.buttonRow}>
            <Button title="Primary" variant="primary" />
            <Button title="Secondary" variant="secondary" />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Outline" variant="outline" />
            <Button title="Ghost" variant="ghost" />
          </View>
          <View style={styles.buttonRow}>
            <Button title="Danger" variant="danger" />
            <Button title="Disabled" disabled />
          </View>

          <Text
            variant="label"
            color="textSecondary"
            style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
          >
            Sizes
          </Text>
          <View style={styles.buttonRow}>
            <Button title="Small" size="sm" />
            <Button title="Medium" size="md" />
            <Button title="Large" size="lg" />
          </View>

          <Text
            variant="label"
            color="textSecondary"
            style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
          >
            States
          </Text>
          <View style={styles.buttonRow}>
            <Button title="Loading..." loading />
          </View>
          <Button
            title="Full Width Button"
            fullWidth
            style={{ marginTop: spacing.sm }}
          />
          <Button
            title="With Icons"
            leftIcon={<Ionicons name="heart" size={18} color={colors.textInverse} />}
            rightIcon={<Ionicons name="arrow-forward" size={18} color={colors.textInverse} />}
            style={{ marginTop: spacing.sm }}
          />
        </Section>

        {/* Inputs Section */}
        <Section title="Inputs">
          <Input
            label="Email"
            placeholder="Entrez votre email"
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="email-address"
            leftIcon={<Ionicons name="mail-outline" size={20} color={colors.textMuted} />}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Mot de passe"
            placeholder="Entrez votre mot de passe"
            secureTextEntry
            helperText="8 caractères minimum"
            rightIcon={<Ionicons name="eye-outline" size={20} color={colors.textMuted} />}
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Avec erreur"
            placeholder="Champ avec erreur"
            value={errorInputValue}
            onChangeText={setErrorInputValue}
            error="Ce champ est requis"
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Désactivé"
            placeholder="Champ désactivé"
            value="Valeur fixe"
            disabled
          />
          <View style={{ height: spacing.md }} />
          <Input
            label="Multiline"
            placeholder="Entrez votre message..."
            multiline
            numberOfLines={3}
          />
        </Section>

        {/* Cards Section */}
        <Section title="Cards">
          <Card padding="md" shadow="sm">
            <Text variant="h3">Carte simple</Text>
            <Text variant="body" color="textSecondary">
              Une carte avec padding moyen et ombre légère.
            </Text>
          </Card>
          <View style={{ height: spacing.md }} />
          <Card padding="lg" shadow="md">
            <Text variant="h3">Carte grande</Text>
            <Text variant="body" color="textSecondary">
              Une carte avec plus de padding et ombre moyenne.
            </Text>
            <Button
              title="Action"
              size="sm"
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            />
          </Card>
          <View style={{ height: spacing.md }} />
          <Card padding="md" shadow="sm" onPress={() => console.log('Card pressed')}>
            <Text variant="h3">Carte cliquable</Text>
            <Text variant="body" color="textSecondary">
              Appuyez sur cette carte pour voir l'effet.
            </Text>
          </Card>
        </Section>

        {/* Badges Section */}
        <Section title="Badges">
          <View style={styles.badgeRow}>
            <Badge label="Success" variant="success" />
            <Badge label="Warning" variant="warning" />
            <Badge label="Error" variant="error" />
          </View>
          <View style={[styles.badgeRow, { marginTop: spacing.md }]}>
            <Badge label="Info" variant="info" />
            <Badge label="Neutral" variant="neutral" />
          </View>
          <Text
            variant="label"
            color="textSecondary"
            style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
          >
            Sizes
          </Text>
          <View style={styles.badgeRow}>
            <Badge label="Small" size="sm" variant="success" />
            <Badge label="Medium" size="md" variant="success" />
          </View>
        </Section>

        {/* Avatars Section */}
        <Section title="Avatars">
          <View style={styles.avatarRow}>
            <View style={styles.avatarItem}>
              <Avatar size="sm" name="Alice Martin" />
              <Text variant="caption" color="textSecondary">sm</Text>
            </View>
            <View style={styles.avatarItem}>
              <Avatar size="md" name="Bob Dupont" />
              <Text variant="caption" color="textSecondary">md</Text>
            </View>
            <View style={styles.avatarItem}>
              <Avatar size="lg" name="Claire Lefebvre" />
              <Text variant="caption" color="textSecondary">lg</Text>
            </View>
            <View style={styles.avatarItem}>
              <Avatar size="xl" name="David Bernard" />
              <Text variant="caption" color="textSecondary">xl</Text>
            </View>
          </View>
          <Text
            variant="label"
            color="textSecondary"
            style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
          >
            Avec image
          </Text>
          <View style={styles.avatarRow}>
            <Avatar
              size="lg"
              name="Test User"
              source={{ uri: 'https://i.pravatar.cc/150?img=1' }}
            />
            <Avatar
              size="lg"
              name="Test User 2"
              source={{ uri: 'https://i.pravatar.cc/150?img=2' }}
            />
            <Avatar
              size="lg"
              name="Test User 3"
              source={{ uri: 'https://i.pravatar.cc/150?img=3' }}
            />
          </View>
        </Section>

        {/* Dividers Section */}
        <Section title="Dividers">
          <Text variant="body">Contenu au dessus</Text>
          <Divider />
          <Text variant="body">Contenu en dessous</Text>
          <View style={{ height: spacing.lg }} />
          <View style={styles.dividerHorizontal}>
            <Text variant="body">Gauche</Text>
            <Divider orientation="vertical" spacing={spacing.md} />
            <Text variant="body">Droite</Text>
          </View>
        </Section>

        {/* Loaders Section */}
        <Section title="Loaders">
          <View style={styles.loaderRow}>
            <View style={styles.loaderItem}>
              <Loader size="sm" />
              <Text variant="caption" color="textSecondary">Small</Text>
            </View>
            <View style={styles.loaderItem}>
              <Loader size="md" />
              <Text variant="caption" color="textSecondary">Medium</Text>
            </View>
            <View style={styles.loaderItem}>
              <Loader size="lg" />
              <Text variant="caption" color="textSecondary">Large</Text>
            </View>
          </View>
          <Text
            variant="label"
            color="textSecondary"
            style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
          >
            Skeletons
          </Text>
          <Skeleton width="60%" height={20} style={{ marginBottom: spacing.sm }} />
          <Skeleton width="100%" height={16} style={{ marginBottom: spacing.sm }} />
          <Skeleton width="80%" height={16} style={{ marginBottom: spacing.md }} />
          <View style={styles.skeletonRow}>
            <Skeleton circle height={48} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Skeleton width="70%" height={16} style={{ marginBottom: spacing.xs }} />
              <Skeleton width="40%" height={14} />
            </View>
          </View>
        </Section>

        {/* Icon Buttons Section */}
        <Section title="Icon Buttons">
          <View style={styles.iconButtonRow}>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="heart" size={20} color={colors.textInverse} />}
                variant="primary"
              />
              <Text variant="caption" color="textSecondary">Primary</Text>
            </View>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="share-outline" size={20} color={colors.secondary} />}
                variant="secondary"
              />
              <Text variant="caption" color="textSecondary">Secondary</Text>
            </View>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="bookmark-outline" size={20} color={colors.text} />}
                variant="outline"
              />
              <Text variant="caption" color="textSecondary">Outline</Text>
            </View>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />}
                variant="ghost"
              />
              <Text variant="caption" color="textSecondary">Ghost</Text>
            </View>
          </View>
          <Text
            variant="label"
            color="textSecondary"
            style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
          >
            Sizes
          </Text>
          <View style={styles.iconButtonRow}>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="add" size={16} color={colors.textInverse} />}
                variant="primary"
                size="sm"
              />
              <Text variant="caption" color="textSecondary">sm</Text>
            </View>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="add" size={20} color={colors.textInverse} />}
                variant="primary"
                size="md"
              />
              <Text variant="caption" color="textSecondary">md</Text>
            </View>
            <View style={styles.iconButtonItem}>
              <IconButton
                icon={<Ionicons name="add" size={24} color={colors.textInverse} />}
                variant="primary"
                size="lg"
              />
              <Text variant="caption" color="textSecondary">lg</Text>
            </View>
          </View>
        </Section>

        {/* Switch Section */}
        <Section title="Switch">
          <Switch
            value={switchValue}
            onValueChange={setSwitchValue}
            label="Notifications"
            description="Recevoir des notifications push"
          />
          <Divider spacing={spacing.sm} />
          <Switch
            value={switchValue2}
            onValueChange={setSwitchValue2}
            label="Mode sombre"
          />
          <Divider spacing={spacing.sm} />
          <Switch
            value={false}
            onValueChange={() => {}}
            label="Désactivé"
            disabled
          />
        </Section>

        {/* Toast Section */}
        <Section title="Toast">
          <Text variant="body" color="textSecondary" style={{ marginBottom: spacing.md }}>
            Appuyez sur les boutons pour afficher les différents types de toast.
            Vous pouvez les fermer en appuyant dessus ou en les glissant vers le haut.
          </Text>
          <View style={styles.buttonRow}>
            <Button
              title="Success"
              variant="primary"
              size="sm"
              onPress={() =>
                showToast({
                  message: 'Réservation confirmée !',
                  variant: 'success',
                })
              }
            />
            <Button
              title="Error"
              variant="danger"
              size="sm"
              onPress={() =>
                showToast({
                  message: 'Erreur de connexion au serveur',
                  variant: 'error',
                })
              }
            />
          </View>
          <View style={[styles.buttonRow, { marginTop: spacing.sm }]}>
            <Button
              title="Warning"
              variant="secondary"
              size="sm"
              onPress={() =>
                showToast({
                  message: 'Votre session expire bientôt',
                  variant: 'warning',
                })
              }
            />
            <Button
              title="Info"
              variant="outline"
              size="sm"
              onPress={() =>
                showToast({
                  message: 'Nouvelle mise à jour disponible',
                  variant: 'info',
                })
              }
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button
              title="Toast longue durée (5s)"
              variant="ghost"
              size="sm"
              onPress={() =>
                showToast({
                  message: 'Ce toast reste affiché plus longtemps',
                  variant: 'info',
                  duration: 5000,
                })
              }
            />
          </View>
        </Section>

        {/* Bottom padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Section wrapper component
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ marginBottom: spacing['3xl'] }}>
      <Text
        variant="h2"
        style={{
          marginBottom: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },
  avatarItem: {
    alignItems: 'center',
    gap: 4,
  },
  dividerHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
  },
  loaderRow: {
    flexDirection: 'row',
    gap: 32,
    alignItems: 'center',
  },
  loaderItem: {
    alignItems: 'center',
    gap: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButtonRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  iconButtonItem: {
    alignItems: 'center',
    gap: 4,
  },
});
