/**
 * Espace membre — « Mon lien de réservation » : la page du salon avec CE
 * membre choisi d'avance (`/p/<salon>/reserver?membre=<id>`) — seules ses
 * prestations, puis directement ses créneaux. À mettre dans sa bio, à
 * envoyer, ou à faire scanner (QR code).
 *
 * Le lien vise toujours opatam.com : une adresse de développement envoyée à
 * une cliente ne mènerait nulle part.
 */
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../../theme';
import { Text, Button, useToast } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider, useEspaceMembre } from '../../contexts';

export default function MonLienScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { showToast } = useToast();
  const { provider } = useProvider();
  const { monMemberId } = useEspaceMembre();
  const [copie, setCopie] = useState(false);

  const lien = provider?.slug && monMemberId ? `https://opatam.com/p/${provider.slug}/reserver?membre=${monMemberId}` : null;

  const copier = async () => {
    if (!lien) return;
    await Clipboard.setStringAsync(lien);
    setCopie(true);
    showToast({ variant: 'success', message: t('espaceMembre.lien.copie') });
    setTimeout(() => setCopie(false), 2000);
  };

  const partager = async () => {
    if (!lien) return;
    try {
      await Share.share({ message: t('espaceMembre.lien.messagePartage', { salon: provider?.businessName ?? '', lien }) });
    } catch {
      // Partage annulé : rien à faire.
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BrandedHeader title={t('espaceMembre.lien.titre')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] }}>
        <Text variant="body" color="textSecondary">{t('espaceMembre.lien.intro')}</Text>

        {lien ? (
          <>
            <View style={[s.qr, { backgroundColor: '#FFFFFF', borderRadius: radius.xl, borderColor: colors.border }]}>
              <QRCode value={lien} size={220} />
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.md }}>
                {t('espaceMembre.lien.scanner')}
              </Text>
            </View>

            <Pressable
              onPress={copier}
              style={[s.lien, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            >
              <Text variant="caption" numberOfLines={2} style={{ flex: 1 }}>{lien}</Text>
              <Ionicons name={copie ? 'checkmark' : 'copy-outline'} size={18} color={colors.primary} />
            </Pressable>

            <Button title={t('espaceMembre.lien.partager')} onPress={partager} leftIcon={<Ionicons name="share-outline" size={18} color="#FFFFFF" />} />
          </>
        ) : (
          <Text variant="body" color="textMuted">{t('espaceMembre.lien.indisponible')}</Text>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  qr: { alignItems: 'center', padding: 24, borderWidth: 1 },
  lien: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
});
