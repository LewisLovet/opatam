/**
 * Espace membre — « Mon profil » : ce qu'un membre tient lui-même.
 *
 * Nom affiché (sur la page du salon et aux clientes), téléphone, photo.
 * Les règles Firestore ne lui laissent QUE ces champs de sa fiche ; son
 * lieu, son statut ou ses prestations restent l'affaire du gérant. Son
 * adresse e-mail est celle de son compte : affichée, pas modifiable ici.
 */
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Image, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { memberService, storagePaths, uploadFile } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Text, Card, Input, Button, Loader, useToast } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useAuth, useProvider, useEspaceMembre } from '../../contexts';

export default function MembreProfilScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { showToast } = useToast();
  const { userData } = useAuth();
  const { providerId, provider } = useProvider();
  const { monMemberId } = useEspaceMembre();

  const [membre, setMembre] = useState<Member | null>(null);
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);

  useEffect(() => {
    if (!providerId || !monMemberId) return;
    memberService
      .getById(providerId, monMemberId)
      .then((m) => {
        setMembre(m);
        setNom(m?.name ?? '');
        setTelephone(m?.phone ?? '');
        setPhoto(m?.photoURL || null);
      })
      .catch(() => setMembre(null));
  }, [providerId, monMemberId]);

  const enregistrer = async () => {
    if (!providerId || !monMemberId) return;
    if (!nom.trim()) {
      showToast({ variant: 'error', message: t('espaceMembre.profil.nomRequis') });
      return;
    }
    setEnregistrement(true);
    try {
      await memberService.updateMember(providerId, monMemberId, { name: nom.trim(), phone: telephone.trim() || null });
      showToast({ variant: 'success', message: t('espaceMembre.profil.enregistre') });
      router.back();
    } catch (err) {
      console.error('[membre-profil]', err);
      showToast({ variant: 'error', message: t('common.error') });
    } finally {
      setEnregistrement(false);
    }
  };

  const changerPhoto = async () => {
    if (!providerId || !monMemberId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('proMembers.photo.permissionTitle'), t('proMembers.photo.permissionMessage'));
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (r.canceled || !r.assets[0]) return;
    setEnvoiPhoto(true);
    try {
      const blob = await (await fetch(r.assets[0].uri)).blob();
      const url = await uploadFile(`${storagePaths.memberPhotos(providerId, monMemberId)}/${Date.now()}.jpg`, blob, { contentType: 'image/jpeg' });
      await memberService.updatePhoto(providerId, monMemberId, url);
      setPhoto(url);
      showToast({ variant: 'success', message: t('proMembers.photo.updated') });
    } catch {
      showToast({ variant: 'error', message: t('proMembers.photo.uploadError') });
    } finally {
      setEnvoiPhoto(false);
    }
  };

  if (!membre) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BrandedHeader title={t('espaceMembre.profil.titre')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loader />
        </View>
      </View>
    );
  }

  const initiales = (nom || '?').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BrandedHeader title={t('espaceMembre.profil.titre')} subtitle={provider?.businessName} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center' }}>
          <Pressable onPress={changerPhoto} disabled={envoiPhoto} style={{ alignItems: 'center' }}>
            {photo ? (
              <Image source={{ uri: photo }} style={[s.photo, { backgroundColor: colors.surfaceSecondary }]} />
            ) : (
              <View style={[s.photo, { backgroundColor: membre.color || colors.primary }]}>
                <Text variant="h1" style={{ color: '#FFFFFF' }}>{initiales}</Text>
              </View>
            )}
            <View style={[s.badgePhoto, { backgroundColor: colors.primary, borderColor: colors.background }]}>
              {envoiPhoto ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera" size={16} color="#FFFFFF" />}
            </View>
          </Pressable>
          <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>
            {t('espaceMembre.profil.photoAide')}
          </Text>
        </View>

        <Card padding="lg" shadow="sm">
          <View style={{ gap: spacing.md }}>
            <Input label={t('espaceMembre.profil.nom')} value={nom} onChangeText={setNom} autoCapitalize="words" />
            <Input label={t('espaceMembre.profil.telephone')} value={telephone} onChangeText={setTelephone} keyboardType="phone-pad" />
            <Input label={t('espaceMembre.profil.email')} value={userData?.email ?? ''} editable={false} />
            <Text variant="caption" color="textSecondary">{t('espaceMembre.profil.emailAide')}</Text>
          </View>
        </Card>

        <Button title={t('common.save')} variant="primary" onPress={enregistrer} disabled={enregistrement} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  photo: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  badgePhoto: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
