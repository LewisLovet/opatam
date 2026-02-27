/**
 * Members (Team) Management Screen
 * List, create, edit, delete members. 1 member = 1 location.
 * Features: access code display/copy, send agenda+code email, toggle active/inactive, color picker.
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
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../theme';
import { Text, Button, Input, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import {
  memberService,
  locationRepository,
  type WithId,
} from '@booking-app/firebase';
import type { Member, Location } from '@booking-app/shared/types';
import { MEMBER_COLORS } from '@booking-app/shared/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberFormData {
  name: string;
  email: string;
  phone: string;
  locationId: string;
  color: string;
}

const DEFAULT_FORM: MemberFormData = {
  name: '',
  email: '',
  phone: '',
  locationId: '',
  color: MEMBER_COLORS[0],
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function MembersScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId } = useProvider();

  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCodeFor, setShowCodeFor] = useState<string | null>(null);
  const [togglingMember, setTogglingMember] = useState<string | null>(null);
  const [sendingAgenda, setSendingAgenda] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // Code modal
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeModalMember, setCodeModalMember] = useState<WithId<Member> | null>(null);

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const [mbrs, locs] = await Promise.all([
        memberService.getByProvider(providerId),
        locationRepository.getActiveByProvider(providerId),
      ]);
      setMembers(mbrs.sort((a, b) => a.sortOrder - b.sortOrder));
      setLocations(locs);
    } catch (err) {
      showToast({ variant: 'error', message: 'Erreur lors du chargement' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useEffect(() => { loadData(); }, [loadData]);
  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Modal open
  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...DEFAULT_FORM,
      locationId: locations[0]?.id || '',
      color: MEMBER_COLORS[members.length % MEMBER_COLORS.length],
    });
    setShowModal(true);
  };

  const openEdit = (member: WithId<Member>) => {
    setEditingId(member.id);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      locationId: member.locationId,
      color: member.color || MEMBER_COLORS[0],
    });
    setShowModal(true);
  };

  // Save
  const handleSave = async () => {
    if (!providerId) return;
    if (!form.name.trim()) { showToast({ variant: 'error', message: 'Le nom est requis' }); return; }
    if (!form.email.trim()) { showToast({ variant: 'error', message: "L'email est requis" }); return; }
    if (!form.locationId) { showToast({ variant: 'error', message: 'Sélectionnez un lieu' }); return; }

    setIsSaving(true);
    try {
      if (editingId) {
        const existing = members.find((m) => m.id === editingId);
        await memberService.updateMember(providerId, editingId, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          color: form.color,
        });
        if (existing && existing.locationId !== form.locationId) {
          await memberService.changeLocation(providerId, editingId, form.locationId);
        }
        showToast({ variant: 'success', message: 'Membre modifié' });
      } else {
        await memberService.createMember(providerId, {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          locationId: form.locationId,
          color: form.color,
        });
        showToast({ variant: 'success', message: 'Membre ajouté' });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDelete = (member: WithId<Member>) => {
    if (member.isDefault) {
      showToast({ variant: 'error', message: 'Impossible de supprimer le membre principal' });
      return;
    }
    Alert.alert('Supprimer le membre', `Supprimer "${member.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!providerId) return;
          try {
            await memberService.deleteMember(providerId, member.id);
            showToast({ variant: 'success', message: 'Membre supprimé' });
            loadData();
          } catch (err: any) {
            showToast({ variant: 'error', message: err?.message || 'Erreur' });
          }
        },
      },
    ]);
  };

  // Toggle active/inactive
  const handleToggleActive = async (member: WithId<Member>) => {
    if (!providerId || member.isDefault) return;
    setTogglingMember(member.id);
    try {
      if (member.isActive) {
        await memberService.deactivateMember(providerId, member.id);
        showToast({ variant: 'success', message: `${member.name} désactivé` });
      } else {
        await memberService.reactivateMember(providerId, member.id);
        showToast({ variant: 'success', message: `${member.name} réactivé` });
      }
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    } finally {
      setTogglingMember(null);
    }
  };

  // Regenerate code
  const handleRegenerateCode = async (memberId: string) => {
    if (!providerId) return;
    Alert.alert(
      'Régénérer le code',
      "L'ancien code ne fonctionnera plus. Continuer ?",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Régénérer',
          onPress: async () => {
            try {
              const newCode = await memberService.regenerateAccessCode(providerId, memberId);
              showToast({ variant: 'success', message: `Nouveau code: ${newCode}` });
              loadData();
              if (codeModalMember && codeModalMember.id === memberId) {
                setCodeModalMember((prev) => prev ? { ...prev, accessCode: newCode } : null);
              }
            } catch (err: any) {
              showToast({ variant: 'error', message: err?.message || 'Erreur' });
            }
          },
        },
      ]
    );
  };

  // Copy code
  const handleCopyCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    showToast({ variant: 'success', message: 'Code copié dans le presse-papier' });
  };

  // Send agenda email (contains the access code already)
  const handleSendAgenda = async (member: WithId<Member>) => {
    if (!providerId) return;
    setSendingAgenda(member.id);
    try {
      const response = await fetch('https://opatam.com/api/pro/send-agenda-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, memberId: member.id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur lors de l\'envoi');
      }
      showToast({ variant: 'success', message: `Récap agenda + code envoyé à ${member.name}` });
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || "Erreur lors de l'envoi" });
    } finally {
      setSendingAgenda(null);
    }
  };

  // Open code modal
  const openCodeModal = (member: WithId<Member>) => {
    setCodeModalMember(member);
    setShowCodeModal(true);
  };

  const getLocationName = (locationId: string) => locations.find((l) => l.id === locationId)?.name || '—';

  const getInitials = (name: string) =>
    name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ fontWeight: '600' }}>Équipe</Text>
          <Pressable onPress={openCreate} style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {members.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="people-outline" size={32} color={colors.primary} />
            </View>
            <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>Aucun membre</Text>
            <Button variant="primary" title="Ajouter un membre" onPress={openCreate} style={{ marginTop: spacing.lg }} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {members.map((member) => (
              <Card key={member.id} padding="none" shadow="sm">
                {/* Main card content — tap to edit */}
                <Pressable
                  onPress={() => openEdit(member)}
                  style={({ pressed }) => [{ padding: spacing.md, opacity: pressed ? 0.95 : 1 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Avatar */}
                    <View style={[styles.avatar, { backgroundColor: member.color || colors.primary }]}>
                      <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                        {getInitials(member.name)}
                      </Text>
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text variant="body" style={{ fontWeight: '600' }}>{member.name}</Text>
                        {member.isDefault && (
                          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                            <Text variant="caption" color="primary" style={{ fontWeight: '600', fontSize: 10 }}>Vous</Text>
                          </View>
                        )}
                      </View>
                      <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                        {getLocationName(member.locationId)}
                      </Text>
                    </View>

                    {/* Active/Inactive toggle */}
                    {!member.isDefault && (
                      <View style={{ alignItems: 'center', marginLeft: spacing.sm }}>
                        <Switch
                          value={member.isActive}
                          onValueChange={() => handleToggleActive(member)}
                          disabled={togglingMember === member.id}
                          trackColor={{ false: '#D1D5DB', true: colors.primaryLight }}
                          thumbColor={member.isActive ? colors.primary : '#9CA3AF'}
                          style={{ transform: [{ scale: 0.85 }] }}
                        />
                        <Text variant="caption" color={member.isActive ? 'primary' : 'textMuted'} style={{ fontSize: 10, marginTop: 2 }}>
                          {member.isActive ? 'Actif' : 'Inactif'}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>

                {/* Access code section */}
                <View style={[styles.codeSection, { borderTopColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="key-outline" size={16} color={colors.textMuted} />
                    <Text variant="bodySmall" color="textSecondary" style={{ marginLeft: spacing.xs }}>
                      Code :{' '}
                    </Text>
                    <Text variant="bodySmall" style={{ fontWeight: '600', fontFamily: 'monospace', letterSpacing: 1 }}>
                      {showCodeFor === member.id ? member.accessCode : '••••••••'}
                    </Text>
                    <Pressable
                      onPress={() => setShowCodeFor(showCodeFor === member.id ? null : member.id)}
                      hitSlop={8}
                      style={{ marginLeft: spacing.xs, padding: 4 }}
                    >
                      <Ionicons name={showCodeFor === member.id ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                    </Pressable>
                    <Pressable
                      onPress={() => handleCopyCode(member.accessCode)}
                      hitSlop={8}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => openCodeModal(member)}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>

                {/* Quick action buttons */}
                <View style={[styles.actionsRow, { borderTopColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}>
                  <Pressable
                    onPress={() => handleSendAgenda(member)}
                    disabled={sendingAgenda === member.id}
                    style={({ pressed }) => [styles.actionBtn, { opacity: pressed || sendingAgenda === member.id ? 0.5 : 1 }]}
                  >
                    {sendingAgenda === member.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="mail-outline" size={16} color={colors.primary} />
                    )}
                    <Text variant="caption" color="primary" style={{ marginLeft: 4, fontWeight: '500' }}>
                      Envoyer récap + code
                    </Text>
                  </Pressable>

                  {!member.isDefault && (
                    <>
                      <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />
                      <Pressable
                        onPress={() => handleDelete(member)}
                        style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.5 : 1, flex: 0, paddingHorizontal: 16 }]}
                      >
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </Pressable>
                    </>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Create/Edit Modal ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">{editingId ? 'Modifier le membre' : 'Nouveau membre'}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={{ gap: spacing.md }}>
                <Input label="Nom" placeholder="Prénom du membre" value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} autoCapitalize="words" />
                <Input label="Email" placeholder="email@exemple.com" value={form.email} onChangeText={(t) => setForm((p) => ({ ...p, email: t }))} keyboardType="email-address" autoCapitalize="none" />
                <Input label="Téléphone (optionnel)" placeholder="06 12 34 56 78" value={form.phone} onChangeText={(t) => setForm((p) => ({ ...p, phone: t }))} keyboardType="phone-pad" />

                {/* Color picker */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}>Couleur</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {MEMBER_COLORS.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setForm((p) => ({ ...p, color: c }))}
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c },
                          form.color === c && { borderWidth: 3, borderColor: colors.text },
                        ]}
                      >
                        {form.color === c && (
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Location picker */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}>Lieu assigné</Text>
                  {locations.length <= 3 ? (
                    <View style={{ gap: spacing.xs }}>
                      {locations.map((loc) => (
                        <Pressable
                          key={loc.id}
                          onPress={() => setForm((p) => ({ ...p, locationId: loc.id }))}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
                        >
                          <Ionicons
                            name={form.locationId === loc.id ? 'radio-button-on' : 'radio-button-off'}
                            size={22}
                            color={form.locationId === loc.id ? colors.primary : colors.textMuted}
                          />
                          <Text variant="body" style={{ marginLeft: spacing.sm }}>{loc.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => setShowLocationPicker(true)}
                      style={[styles.selectBtn, { borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md }]}
                    >
                      <Text variant="body">{getLocationName(form.locationId) || 'Choisir un lieu'}</Text>
                      <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
                    </Pressable>
                  )}
                </View>
              </View>
            </ScrollView>

            <View style={[styles.stickyFooter, { padding: spacing.lg, paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border }]}>
              <Button variant="primary" title={isSaving ? 'Enregistrement...' : 'Enregistrer'} onPress={handleSave} loading={isSaving} disabled={isSaving} fullWidth />
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal visible={showLocationPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContent, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Choisir un lieu</Text>
              <Pressable onPress={() => setShowLocationPicker(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            {locations.map((loc) => (
              <Pressable
                key={loc.id}
                onPress={() => { setForm((p) => ({ ...p, locationId: loc.id })); setShowLocationPicker(false); }}
                style={[styles.pickerItem, { padding: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: form.locationId === loc.id ? colors.primaryLight : 'transparent' }]}
              >
                <Text variant="body" color={form.locationId === loc.id ? 'primary' : 'text'} style={{ flex: 1, fontWeight: form.locationId === loc.id ? '600' : '400' }}>
                  {loc.name}
                </Text>
                {form.locationId === loc.id && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* ── Code Actions Modal ── */}
      <Modal visible={showCodeModal} transparent animationType="fade">
        <Pressable style={styles.codeModalOverlay} onPress={() => setShowCodeModal(false)}>
          <Pressable style={[styles.codeModalContent, { backgroundColor: colors.background, borderRadius: radius.xl }]} onPress={() => {}}>
            {codeModalMember && (
              <>
                <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                  <View style={[styles.codeIconCircle, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="key" size={28} color={colors.primary} />
                  </View>
                  <Text variant="h3" style={{ marginTop: spacing.md }}>Code d'accès</Text>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                    {codeModalMember.name}
                  </Text>
                </View>

                {/* Large code display */}
                <View style={[styles.codeDisplay, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg }]}>
                  <Text variant="h2" style={{ fontFamily: 'monospace', letterSpacing: 3, textAlign: 'center' }}>
                    {codeModalMember.accessCode}
                  </Text>
                </View>

                <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
                  Ce code permet d'accéder au planning sur opatam.com/planning
                </Text>

                {/* Action buttons */}
                <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
                  <Pressable
                    onPress={() => { handleCopyCode(codeModalMember.accessCode); }}
                    style={({ pressed }) => [styles.codeActionBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="copy-outline" size={20} color={colors.primary} />
                    <Text variant="body" color="primary" style={{ marginLeft: spacing.sm, fontWeight: '500' }}>
                      Copier le code
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => { handleSendAgenda(codeModalMember); }}
                    disabled={sendingAgenda === codeModalMember.id}
                    style={({ pressed }) => [styles.codeActionBtn, { borderColor: colors.border, opacity: pressed || sendingAgenda === codeModalMember.id ? 0.5 : 1 }]}
                  >
                    {sendingAgenda === codeModalMember.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="mail-outline" size={20} color={colors.primary} />
                    )}
                    <Text variant="body" color="primary" style={{ marginLeft: spacing.sm, fontWeight: '500' }}>
                      Envoyer récap + code par email
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleRegenerateCode(codeModalMember.id)}
                    style={({ pressed }) => [styles.codeActionBtn, { borderColor: '#FEE2E2', opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Ionicons name="refresh-outline" size={20} color="#DC2626" />
                    <Text variant="body" style={{ marginLeft: spacing.sm, fontWeight: '500', color: '#DC2626' }}>
                      Régénérer le code
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={() => setShowCodeModal(false)}
                  style={({ pressed }) => [styles.closeCodeBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, marginTop: spacing.lg, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text variant="body" style={{ fontWeight: '600' }}>Fermer</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  stickyFooter: { borderTopWidth: 1 },
  pickerContent: { maxHeight: '50%' },
  pickerItem: { flexDirection: 'row', alignItems: 'center' },
  // Color picker
  colorSwatch: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  // Code section in card
  codeSection: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
  // Actions row
  actionsRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, flex: 1, justifyContent: 'center' },
  actionDivider: { width: 1, height: 20 },
  // Code modal
  codeModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  codeModalContent: { width: '100%', padding: 24 },
  codeIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  codeDisplay: { paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center' },
  codeActionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  closeCodeBtn: { paddingVertical: 14, alignItems: 'center' },
});
