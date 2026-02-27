/**
 * Profile & Publication Screen
 * Edit business name, category, description, logo, cover photo, social links.
 * Check publication requirements and publish/unpublish page.
 * PayPal link + QR codes on the Visibilité tab.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme';
import { Text, Button, Input, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import { providerService, uploadFile, storagePaths } from '@booking-app/firebase';
import { CATEGORIES, APP_CONFIG } from '@booking-app/shared/constants';
import QRCode from 'react-native-qrcode-svg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileFormData {
  businessName: string;
  category: string;
  description: string;
}

interface SocialLinksData {
  instagram: string;
  facebook: string;
  tiktok: string;
  website: string;
  paypal: string;
}

interface PublishCheck {
  canPublish: boolean;
  missingItems: string[];
  completeness: {
    hasBusinessName: boolean;
    hasCategory: boolean;
    hasLocation: boolean;
    hasService: boolean;
    hasAvailability: boolean;
  };
}

const REQUIREMENT_LABELS: Record<string, { label: string; icon: string }> = {
  hasBusinessName: { label: 'Nom de l\'entreprise', icon: 'business-outline' },
  hasCategory: { label: 'Catégorie', icon: 'grid-outline' },
  hasLocation: { label: 'Au moins un lieu', icon: 'location-outline' },
  hasService: { label: 'Au moins une prestation', icon: 'cut-outline' },
  hasAvailability: { label: 'Disponibilités configurées', icon: 'time-outline' },
};

// ---------------------------------------------------------------------------
// Image upload helper
// ---------------------------------------------------------------------------

async function pickAndUploadImage(
  storagePath: string,
  aspect: [number, number] = [1, 1]
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission requise', 'Autorisez l\'accès à vos photos pour modifier l\'image.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;
  const response = await fetch(uri);
  const blob = await response.blob();
  const downloadURL = await uploadFile(storagePath, blob, { contentType: 'image/jpeg' });
  return downloadURL;
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId, refreshProvider } = useProvider();

  // Tabs
  const [activeTab, setActiveTab] = useState<'publication' | 'profile' | 'social'>('publication');

  // Profile form
  const [profileForm, setProfileForm] = useState<ProfileFormData>({
    businessName: '',
    category: '',
    description: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);

  // Social links form (includes paypal)
  const [socialForm, setSocialForm] = useState<SocialLinksData>({
    instagram: '',
    facebook: '',
    tiktok: '',
    website: '',
    paypal: '',
  });
  const [savingSocial, setSavingSocial] = useState(false);

  // Publication
  const [publishCheck, setPublishCheck] = useState<PublishCheck | null>(null);
  const [checkingPublish, setCheckingPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // PayPal link form (on Visibilité tab)
  const [paypalLink, setPaypalLink] = useState('');
  const [savingPaypal, setSavingPaypal] = useState(false);

  // Category picker
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // QR code tab
  const [activeQR, setActiveQR] = useState<'booking' | 'paypal'>('booking');

  const [refreshing, setRefreshing] = useState(false);

  // Initialize forms from provider
  useEffect(() => {
    if (provider) {
      setProfileForm({
        businessName: provider.businessName || '',
        category: provider.category || '',
        description: provider.description || '',
      });
      setSocialForm({
        instagram: provider.socialLinks?.instagram || '',
        facebook: provider.socialLinks?.facebook || '',
        tiktok: provider.socialLinks?.tiktok || '',
        website: provider.socialLinks?.website || '',
        paypal: provider.socialLinks?.paypal || '',
      });
      setPaypalLink(provider.socialLinks?.paypal || '');
    }
  }, [provider]);

  // Check publish requirements
  const checkRequirements = useCallback(async () => {
    if (!providerId) return;
    setCheckingPublish(true);
    try {
      const result = await providerService.checkPublishRequirements(providerId);
      setPublishCheck(result);
    } catch (err) {
      console.error('Check requirements error:', err);
    } finally {
      setCheckingPublish(false);
    }
  }, [providerId]);

  useEffect(() => {
    if (providerId) {
      checkRequirements();
    }
  }, [providerId, checkRequirements]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProvider();
    await checkRequirements();
    setRefreshing(false);
  }, [refreshProvider, checkRequirements]);

  // --- Photo uploads ---
  const handleUploadLogo = async () => {
    if (!providerId) return;
    setUploadingLogo(true);
    try {
      const url = await pickAndUploadImage(
        `${storagePaths.providerPhotos(providerId)}/logo.jpg`,
        [1, 1]
      );
      if (url) {
        await providerService.updateProvider(providerId, { photoURL: url });
        await refreshProvider();
        showToast({ variant: 'success', message: 'Logo mis à jour' });
      }
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de l\'upload' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleUploadCover = async () => {
    if (!providerId) return;
    setUploadingCover(true);
    try {
      const url = await pickAndUploadImage(
        `${storagePaths.providerCover(providerId)}/cover.jpg`,
        [16, 9]
      );
      if (url) {
        await providerService.updateProvider(providerId, { coverPhotoURL: url });
        await refreshProvider();
        showToast({ variant: 'success', message: 'Photo de couverture mise à jour' });
      }
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de l\'upload' });
    } finally {
      setUploadingCover(false);
    }
  };

  // --- Portfolio ---
  const portfolioPhotos = provider?.portfolioPhotos || [];
  const maxPhotos = APP_CONFIG.maxPortfolioPhotos || 10;

  const handleAddPortfolioPhoto = async () => {
    if (!providerId) return;
    if (portfolioPhotos.length >= maxPhotos) {
      showToast({ variant: 'error', message: `Maximum ${maxPhotos} photos atteint` });
      return;
    }

    setUploadingPortfolio(true);
    try {
      const timestamp = Date.now();
      const path = `${storagePaths.providerPortfolio(providerId)}/${timestamp}_photo.jpg`;
      const url = await pickAndUploadImage(path, [4, 3]);
      if (url) {
        await providerService.updateProvider(providerId, {
          portfolioPhotos: [...portfolioPhotos, url],
        });
        await refreshProvider();
        showToast({ variant: 'success', message: 'Photo ajoutée au portfolio' });
      }
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de l\'upload' });
    } finally {
      setUploadingPortfolio(false);
    }
  };

  const handleDeletePortfolioPhoto = (url: string) => {
    Alert.alert(
      'Supprimer cette photo',
      'Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            setDeletingPhoto(url);
            try {
              const updated = portfolioPhotos.filter((p) => p !== url);
              await providerService.updateProvider(providerId, {
                portfolioPhotos: updated,
              });
              await refreshProvider();
              showToast({ variant: 'success', message: 'Photo supprimée' });
            } catch (err: any) {
              showToast({ variant: 'error', message: err.message || 'Erreur lors de la suppression' });
            } finally {
              setDeletingPhoto(null);
            }
          },
        },
      ]
    );
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!providerId) return;
    if (!profileForm.businessName.trim()) {
      showToast({ variant: 'error', message: 'Le nom est obligatoire' });
      return;
    }

    setSavingProfile(true);
    try {
      await providerService.updateProvider(providerId, {
        businessName: profileForm.businessName.trim(),
        category: profileForm.category,
        description: profileForm.description.trim(),
      });
      await refreshProvider();
      showToast({ variant: 'success', message: 'Profil mis à jour' });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de la mise à jour' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Save social links
  const handleSaveSocial = async () => {
    if (!providerId) return;

    setSavingSocial(true);
    try {
      await providerService.updateProvider(providerId, {
        socialLinks: {
          instagram: socialForm.instagram.trim() || null,
          facebook: socialForm.facebook.trim() || null,
          tiktok: socialForm.tiktok.trim() || null,
          website: socialForm.website.trim() || null,
          paypal: socialForm.paypal.trim() || null,
        },
      });
      await refreshProvider();
      showToast({ variant: 'success', message: 'Liens sociaux mis à jour' });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de la mise à jour' });
    } finally {
      setSavingSocial(false);
    }
  };

  // Save PayPal link (from Visibilité tab)
  const handleSavePaypal = async () => {
    if (!providerId) return;

    setSavingPaypal(true);
    try {
      await providerService.updateProvider(providerId, {
        socialLinks: {
          instagram: provider?.socialLinks?.instagram || null,
          facebook: provider?.socialLinks?.facebook || null,
          tiktok: provider?.socialLinks?.tiktok || null,
          website: provider?.socialLinks?.website || null,
          paypal: paypalLink.trim() || null,
        },
      });
      await refreshProvider();
      showToast({ variant: 'success', message: 'Lien PayPal mis à jour' });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur' });
    } finally {
      setSavingPaypal(false);
    }
  };

  // Publish / Unpublish
  const handlePublish = async () => {
    if (!providerId) return;
    setPublishing(true);
    try {
      const result = await providerService.publishProvider(providerId);
      if (!result.canPublish) {
        setPublishCheck(result);
        showToast({ variant: 'error', message: 'Veuillez compléter tous les éléments requis' });
        return;
      }
      await refreshProvider();
      showToast({ variant: 'success', message: 'Page activée !' });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de l\'activation' });
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = () => {
    Alert.alert(
      'Désactiver ma page',
      'Votre page ne sera plus visible par les clients. Vous pourrez la réactiver à tout moment.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver',
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            setPublishing(true);
            try {
              await providerService.unpublishProvider(providerId);
              await refreshProvider();
              await checkRequirements();
              showToast({ variant: 'success', message: 'Page désactivée' });
            } catch (err: any) {
              showToast({ variant: 'error', message: err.message || 'Erreur' });
            } finally {
              setPublishing(false);
            }
          },
        },
      ]
    );
  };

  // Copy URL
  const handleCopyUrl = async () => {
    if (!provider?.slug) return;
    const url = `https://opatam.com/p/${provider.slug}`;
    await Clipboard.setStringAsync(url);
    showToast({ variant: 'success', message: 'Lien copié !' });
  };

  // View preview (same route as dashboard "Aperçu" button)
  const handleViewPreview = () => {
    if (!provider?.slug) return;
    router.push({ pathname: '/(client)/provider/[slug]', params: { slug: provider.slug, preview: '1' } } as any);
  };

  const getCategoryLabel = (id: string) => {
    const cat = CATEGORIES.find((c) => c.id === id);
    return cat ? cat.label : id;
  };

  const paypalUrl = provider?.socialLinks?.paypal
    ? (provider.socialLinks.paypal.startsWith('http')
      ? provider.socialLinks.paypal
      : `https://paypal.me/${provider.socialLinks.paypal}`)
    : null;

  const bookingUrl = provider?.slug ? `https://opatam.com/p/${provider.slug}/reserver` : null;

  const tabs = [
    { key: 'publication' as const, label: 'Visibilité', icon: 'globe-outline' },
    { key: 'profile' as const, label: 'Profil', icon: 'person-outline' },
    { key: 'social' as const, label: 'Réseaux', icon: 'share-social-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text variant="h3" style={{ color: '#FFFFFF', flex: 1, marginLeft: spacing.sm }}>
            Profil & Publication
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  styles.tab,
                  { borderBottomColor: isActive ? '#FFFFFF' : 'transparent' },
                ]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)'}
                />
                <Text
                  variant="caption"
                  style={{
                    color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* ══════════════ Publication Tab ══════════════ */}
        {activeTab === 'publication' && (
          <>
            {/* Status card */}
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={[
                    styles.statusIcon,
                    {
                      backgroundColor: provider?.isPublished ? '#DCFCE7' : colors.surfaceSecondary,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Ionicons
                    name={provider?.isPublished ? 'globe' : 'globe-outline'}
                    size={24}
                    color={provider?.isPublished ? '#16A34A' : colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Text variant="h3">
                      {provider?.isPublished ? 'Page active' : 'Page inactive'}
                    </Text>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: provider?.isPublished ? '#DCFCE7' : colors.surfaceSecondary,
                          borderRadius: radius.full,
                        },
                      ]}
                    >
                      <Text
                        variant="caption"
                        style={{
                          color: provider?.isPublished ? '#16A34A' : colors.textMuted,
                          fontWeight: '600',
                          fontSize: 11,
                        }}
                      >
                        {provider?.isPublished ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    {provider?.isPublished
                      ? 'Visible et accessible par les clients'
                      : 'Non visible par les clients'}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                {provider?.isPublished ? (
                  <>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Pressable
                        onPress={handleCopyUrl}
                        style={[
                          styles.actionButton,
                          { backgroundColor: colors.primaryLight || '#e4effa', borderRadius: radius.md, flex: 1 },
                        ]}
                      >
                        <Ionicons name="copy-outline" size={18} color={colors.primary} />
                        <Text variant="caption" style={{ color: colors.primary, fontWeight: '500' }}>
                          Copier le lien
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleViewPreview}
                        style={[
                          styles.actionButton,
                          { backgroundColor: '#DCFCE7', borderRadius: radius.md, flex: 1 },
                        ]}
                      >
                        <Ionicons name="eye-outline" size={18} color="#16A34A" />
                        <Text variant="caption" style={{ color: '#16A34A', fontWeight: '500' }}>
                          Voir l'aperçu
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable
                      onPress={handleUnpublish}
                      disabled={publishing}
                      style={[
                        styles.actionButton,
                        { borderColor: '#F97316', borderWidth: 1, borderRadius: radius.md },
                      ]}
                    >
                      {publishing ? (
                        <ActivityIndicator size="small" color="#F97316" />
                      ) : (
                        <>
                          <Ionicons name="eye-off-outline" size={18} color="#F97316" />
                          <Text variant="caption" style={{ color: '#F97316', fontWeight: '500' }}>
                            Désactiver ma page
                          </Text>
                        </>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Button
                    title="Activer ma page"
                    onPress={handlePublish}
                    loading={publishing}
                    disabled={publishing || !publishCheck?.canPublish}
                  />
                )}
              </View>
            </Card>

            {/* Requirements checklist (if not published) */}
            {!provider?.isPublished && (
              <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                  <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
                  <Text variant="h3">Éléments requis</Text>
                </View>

                {checkingPublish ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={{ gap: spacing.sm }}>
                    {Object.entries(REQUIREMENT_LABELS).map(([key, { label }]) => {
                      const isComplete = publishCheck?.completeness[key as keyof typeof publishCheck.completeness];
                      return (
                        <View key={key} style={styles.requirementRow}>
                          <Ionicons
                            name={isComplete ? 'checkmark-circle' : 'close-circle'}
                            size={20}
                            color={isComplete ? '#16A34A' : '#F59E0B'}
                          />
                          <Text
                            variant="body"
                            style={{
                              flex: 1,
                              color: isComplete ? colors.text : colors.textSecondary,
                            }}
                          >
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                <Pressable
                  onPress={checkRequirements}
                  disabled={checkingPublish}
                  style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
                >
                  <Text variant="caption" style={{ color: colors.primary, fontWeight: '500' }}>
                    Actualiser
                  </Text>
                </Pressable>
              </Card>
            )}

            {/* QR Codes section (if published) */}
            {provider?.isPublished && bookingUrl && (
              <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
                <Text variant="h3" style={{ marginBottom: spacing.md }}>QR Codes</Text>

                {/* Tab bar */}
                <View style={[styles.qrTabBar, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}>
                  <Pressable
                    onPress={() => setActiveQR('booking')}
                    style={[
                      styles.qrTab,
                      {
                        backgroundColor: activeQR === 'booking' ? colors.background : 'transparent',
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Ionicons name="qr-code-outline" size={16} color={activeQR === 'booking' ? colors.primary : colors.textMuted} />
                    <Text
                      variant="caption"
                      style={{
                        color: activeQR === 'booking' ? colors.primary : colors.textMuted,
                        fontWeight: activeQR === 'booking' ? '600' : '400',
                      }}
                    >
                      Réservation
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setActiveQR('paypal')}
                    style={[
                      styles.qrTab,
                      {
                        backgroundColor: activeQR === 'paypal' ? colors.background : 'transparent',
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Ionicons name="logo-paypal" size={16} color={activeQR === 'paypal' ? '#0070BA' : colors.textMuted} />
                    <Text
                      variant="caption"
                      style={{
                        color: activeQR === 'paypal' ? '#0070BA' : colors.textMuted,
                        fontWeight: activeQR === 'paypal' ? '600' : '400',
                      }}
                    >
                      PayPal
                    </Text>
                  </Pressable>
                </View>

                {activeQR === 'booking' ? (
                  <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
                    <View style={[styles.qrContainer, { borderColor: colors.border, borderRadius: radius.md }]}>
                      <QRCode
                        value={bookingUrl}
                        size={180}
                        backgroundColor="#FFFFFF"
                        color="#000000"
                      />
                    </View>
                    <Text variant="body" style={{ fontWeight: '500', marginTop: spacing.md }}>
                      QR code de réservation
                    </Text>
                    <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
                      Affichez-le dans votre établissement. Vos clients scannent et réservent directement.
                    </Text>
                  </View>
                ) : (
                  <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
                    {paypalUrl ? (
                      <>
                        <View style={[styles.qrContainer, { borderColor: colors.border, borderRadius: radius.md }]}>
                          <QRCode
                            value={paypalUrl}
                            size={180}
                            backgroundColor="#FFFFFF"
                            color="#000000"
                          />
                        </View>
                        <Text variant="body" style={{ fontWeight: '500', marginTop: spacing.md }}>
                          QR code PayPal
                        </Text>
                        <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
                          Vos clients scannent ce QR code pour vous payer via PayPal.
                        </Text>
                      </>
                    ) : (
                      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                        <Ionicons name="logo-paypal" size={32} color={colors.textMuted} />
                        <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
                          Configurez votre lien PayPal ci-dessous pour activer le QR code.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </Card>
            )}

            {/* PayPal link section */}
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
                <View style={[styles.socialIconSmall, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="logo-paypal" size={18} color="#0070BA" />
                </View>
                <Text variant="h3">Lien PayPal</Text>
              </View>
              <Input
                label="PayPal.me ou URL"
                placeholder="votre-nom (ou https://paypal.me/votre-nom)"
                value={paypalLink}
                onChangeText={setPaypalLink}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                Permet de générer un QR code pour les paiements
              </Text>
              <View style={{ marginTop: spacing.md }}>
                <Button
                  title="Enregistrer"
                  onPress={handleSavePaypal}
                  loading={savingPaypal}
                  disabled={savingPaypal}
                  size="sm"
                />
              </View>
            </Card>
          </>
        )}

        {/* ══════════════ Profile Tab ══════════════ */}
        {activeTab === 'profile' && (
          <>
            {/* Cover photo */}
            <Card padding="none" shadow="sm" style={{ marginBottom: spacing.lg, overflow: 'hidden' }}>
              <Pressable onPress={handleUploadCover} disabled={uploadingCover}>
                {provider?.coverPhotoURL ? (
                  <Image
                    source={{ uri: provider.coverPhotoURL }}
                    style={styles.coverImage}
                  />
                ) : (
                  <View style={[styles.coverPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                    {uploadingCover ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                        <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                          Ajouter une photo de couverture
                        </Text>
                      </>
                    )}
                  </View>
                )}
                {provider?.coverPhotoURL && (
                  <View style={styles.coverEditBadge}>
                    {uploadingCover ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
                    )}
                  </View>
                )}
              </Pressable>

              {/* Logo overlay */}
              <View style={styles.logoSection}>
                <Pressable onPress={handleUploadLogo} disabled={uploadingLogo}>
                  {provider?.photoURL ? (
                    <View style={styles.logoWrapper}>
                      <Image
                        source={{ uri: provider.photoURL }}
                        style={[styles.logoImage, { borderColor: colors.background }]}
                      />
                      <View style={[styles.logoEditBadge, { backgroundColor: colors.primary }]}>
                        {uploadingLogo ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.logoPlaceholder, { backgroundColor: colors.primary, borderColor: colors.background }]}>
                      {uploadingLogo ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
                          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }}>
                            Logo
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            </Card>

            {/* Profile form */}
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <Input
                label="Nom de l'entreprise"
                placeholder="Ex: Salon de beauté Marie"
                value={profileForm.businessName}
                onChangeText={(v) => setProfileForm((p) => ({ ...p, businessName: v }))}
              />

              <View style={{ marginTop: spacing.md }}>
                <Text variant="label" style={{ marginBottom: spacing.xs }}>
                  Catégorie
                </Text>
                <Pressable
                  onPress={() => setShowCategoryPicker(true)}
                  style={[
                    styles.pickerButton,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderRadius: radius.md,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    variant="body"
                    style={{ flex: 1, color: profileForm.category ? colors.text : colors.textMuted }}
                  >
                    {profileForm.category ? getCategoryLabel(profileForm.category) : 'Sélectionnez une catégorie'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Input
                  label="Description"
                  placeholder="Décrivez votre activité en quelques lignes..."
                  value={profileForm.description}
                  onChangeText={(v) => setProfileForm((p) => ({ ...p, description: v }))}
                  multiline
                  numberOfLines={4}
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                />
                <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                  Visible sur votre page publique
                </Text>
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Button
                  title="Enregistrer"
                  onPress={handleSaveProfile}
                  loading={savingProfile}
                  disabled={savingProfile}
                />
              </View>
            </Card>

            {/* Portfolio */}
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View style={[styles.socialIconSmall, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                    <Ionicons name="images-outline" size={18} color={colors.primary} />
                  </View>
                  <Text variant="h3">Portfolio</Text>
                </View>
                <Text variant="caption" color="textMuted">
                  {portfolioPhotos.length}/{maxPhotos}
                </Text>
              </View>

              <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.md }}>
                Ajoutez des photos de vos réalisations pour votre page publique
              </Text>

              <View style={styles.portfolioGrid}>
                {portfolioPhotos.map((photoUrl) => {
                  const isDeleting = deletingPhoto === photoUrl;
                  return (
                    <View key={photoUrl} style={[styles.portfolioItem, { borderRadius: radius.md, overflow: 'hidden' }]}>
                      <Image
                        source={{ uri: photoUrl }}
                        style={styles.portfolioImage}
                      />
                      <Pressable
                        onPress={() => handleDeletePortfolioPhoto(photoUrl)}
                        disabled={isDeleting}
                        style={styles.portfolioDeleteBtn}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                        )}
                      </Pressable>
                    </View>
                  );
                })}

                {portfolioPhotos.length < maxPhotos && (
                  <Pressable
                    onPress={handleAddPortfolioPhoto}
                    disabled={uploadingPortfolio}
                    style={[
                      styles.portfolioItem,
                      {
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        backgroundColor: colors.surfaceSecondary,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        justifyContent: 'center',
                        alignItems: 'center',
                      },
                    ]}
                  >
                    {uploadingPortfolio ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="add" size={28} color={colors.primary} />
                        <Text variant="caption" color="textMuted" style={{ marginTop: 2, fontSize: 10 }}>
                          Ajouter
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </Card>
          </>
        )}

        {/* ══════════════ Social Links Tab ══════════════ */}
        {activeTab === 'social' && (
          <>
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <Text variant="body" color="textSecondary" style={{ marginBottom: spacing.md }}>
                Ajoutez vos réseaux sociaux pour augmenter votre visibilité
              </Text>

              <View style={{ gap: spacing.md }}>
                <View style={styles.socialRow}>
                  <View style={[styles.socialIcon, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="logo-instagram" size={20} color="#E1306C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Instagram"
                      placeholder="votre.compte"
                      value={socialForm.instagram}
                      onChangeText={(v) => setSocialForm((p) => ({ ...p, instagram: v }))}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.socialRow}>
                  <View style={[styles.socialIcon, { backgroundColor: '#DBEAFE' }]}>
                    <Ionicons name="logo-facebook" size={20} color="#1877F2" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Facebook"
                      placeholder="URL ou nom de page"
                      value={socialForm.facebook}
                      onChangeText={(v) => setSocialForm((p) => ({ ...p, facebook: v }))}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.socialRow}>
                  <View style={[styles.socialIcon, { backgroundColor: '#F3E8FF' }]}>
                    <Ionicons name="logo-tiktok" size={20} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="TikTok"
                      placeholder="@votre.compte"
                      value={socialForm.tiktok}
                      onChangeText={(v) => setSocialForm((p) => ({ ...p, tiktok: v }))}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.socialRow}>
                  <View style={[styles.socialIcon, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="globe-outline" size={20} color="#0284C7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Site web"
                      placeholder="https://votre-site.com"
                      value={socialForm.website}
                      onChangeText={(v) => setSocialForm((p) => ({ ...p, website: v }))}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                </View>
              </View>

              <View style={{ marginTop: spacing.lg }}>
                <Button
                  title="Enregistrer"
                  onPress={handleSaveSocial}
                  loading={savingSocial}
                  disabled={savingSocial}
                />
              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCategoryPicker(false)}
        >
          <Pressable
            style={[
              styles.pickerModal,
              { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerHandle}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
            </View>
            <Text variant="h3" align="center" style={{ marginBottom: spacing.md }}>
              Catégorie
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {CATEGORIES.map((cat) => {
                const isSelected = profileForm.category === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      setProfileForm((p) => ({ ...p, category: cat.id }));
                      setShowCategoryPicker(false);
                    }}
                    style={[
                      styles.categoryOption,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text
                      variant="body"
                      style={{
                        color: isSelected ? '#FFFFFF' : colors.text,
                        fontWeight: isSelected ? '600' : '400',
                      }}
                    >
                      {cat.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  statusIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // QR tab bar
  qrTabBar: {
    flexDirection: 'row',
    padding: 3,
  },
  qrTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  // QR code
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    alignSelf: 'center',
  },
  // Cover & logo
  coverImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#FFFFFF',
  },
  coverPlaceholder: {
    width: '100%',
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEditBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    paddingHorizontal: 16,
    marginTop: -36,
    marginBottom: 12,
  },
  logoWrapper: {
    position: 'relative',
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Picker
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  // Social
  socialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  socialIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  pickerHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 1,
  },
  // Portfolio
  portfolioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  portfolioItem: {
    // 3 columns: (100% - 2 gaps of 8px) / 3 ≈ 31%
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
  },
  portfolioImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  portfolioDeleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
