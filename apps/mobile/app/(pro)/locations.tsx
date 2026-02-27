/**
 * Locations Management Screen
 * List, create, edit, delete, toggle active/inactive locations.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button, Input, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import { locationService, type WithId } from '@booking-app/firebase';
import type { Location } from '@booking-app/shared/types';

// ---------------------------------------------------------------------------
// Address Autocomplete (BAN)
// ---------------------------------------------------------------------------

interface AddressSuggestion {
  label: string;
  name: string;
  city: string;
  postcode: string;
  coordinates: { latitude: number; longitude: number };
}

async function searchAddress(query: string, limit = 5, type?: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (type) params.set('type', type);
  const response = await fetch(`https://api-adresse.data.gouv.fr/search?${params}`);
  if (!response.ok) return [];
  const json = await response.json();
  return (json.features ?? []).map((f: any) => ({
    label: f.properties.label,
    name: f.properties.name,
    city: f.properties.city,
    postcode: f.properties.postcode,
    coordinates: { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] },
  }));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationFormData {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  description: string;
  type: 'fixed' | 'mobile';
  travelRadius: string;
  cityOnly: boolean;
}

const DEFAULT_FORM: LocationFormData = {
  name: '',
  address: '',
  postalCode: '',
  city: '',
  description: '',
  type: 'fixed',
  travelRadius: '20',
  cityOnly: false,
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function LocationsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { providerId } = useProvider();

  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Address autocomplete
  const [addressQuery, setAddressQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // City autocomplete (for cityOnly mode)
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<AddressSuggestion[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const locs = await locationService.getByProvider(providerId);
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

  // Address search
  const handleAddressSearch = useCallback((query: string) => {
    setAddressQuery(query);
    setForm((p) => ({ ...p, address: query }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setSuggestions([]); setShowSuggestions(false); setAddressLoading(false); return; }
    setAddressLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(query);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch { setSuggestions([]); setShowSuggestions(false); }
      finally { setAddressLoading(false); }
    }, 300);
  }, []);

  const handleAddressSelect = useCallback((s: AddressSuggestion) => {
    setAddressQuery(s.name);
    setForm((p) => ({ ...p, address: s.name, city: s.city, postalCode: s.postcode }));
    setShowSuggestions(false);
    setSuggestions([]);
  }, []);

  // City search (municipality type)
  const handleCitySearch = useCallback((query: string) => {
    setCityQuery(query);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (query.length < 2) { setCitySuggestions([]); setShowCitySuggestions(false); setCityLoading(false); return; }
    setCityLoading(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(query, 5, 'municipality');
        setCitySuggestions(results);
        setShowCitySuggestions(results.length > 0);
      } catch { setCitySuggestions([]); setShowCitySuggestions(false); }
      finally { setCityLoading(false); }
    }, 300);
  }, []);

  const handleCitySelect = useCallback((s: AddressSuggestion) => {
    setCityQuery(s.city);
    setForm((p) => ({ ...p, city: s.city, postalCode: s.postcode }));
    setShowCitySuggestions(false);
    setCitySuggestions([]);
  }, []);

  useEffect(() => { return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
  }; }, []);

  // Modal open
  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setAddressQuery('');
    setCityQuery('');
    setShowModal(true);
  };

  const openEdit = (loc: WithId<Location>) => {
    setEditingId(loc.id);
    const isCityOnly = loc.type === 'fixed' && !loc.address;
    setForm({
      name: loc.name,
      address: loc.address || '',
      postalCode: loc.postalCode,
      city: loc.city,
      description: loc.description || '',
      type: loc.type || 'fixed',
      travelRadius: loc.travelRadius ? String(loc.travelRadius) : '20',
      cityOnly: isCityOnly,
    });
    setAddressQuery(loc.address || '');
    setCityQuery(loc.city || '');
    setShowModal(true);
  };

  // Save
  const handleSave = async () => {
    if (!providerId) return;
    if (!form.name.trim()) { showToast({ variant: 'error', message: 'Le nom est requis' }); return; }
    if (!form.city.trim()) { showToast({ variant: 'error', message: 'La ville est requise' }); return; }
    if (!form.postalCode.trim()) { showToast({ variant: 'error', message: 'Le code postal est requis' }); return; }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.cityOnly ? '' : form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        country: 'France' as const,
        geopoint: null,
        description: form.description.trim() || null,
        type: form.type,
        travelRadius: form.type === 'mobile' ? Number(form.travelRadius) || 20 : null,
        photoURLs: [],
      };

      if (editingId) {
        await locationService.updateLocation(providerId, editingId, payload);
        showToast({ variant: 'success', message: 'Lieu modifié' });
      } else {
        await locationService.createLocation(providerId, payload);
        showToast({ variant: 'success', message: 'Lieu créé' });
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
  const handleDelete = (loc: WithId<Location>) => {
    if (loc.isDefault) {
      showToast({ variant: 'error', message: 'Impossible de supprimer le lieu principal' });
      return;
    }
    Alert.alert('Supprimer le lieu', `Supprimer "${loc.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (!providerId) return;
          try {
            await locationService.deleteLocation(providerId, loc.id);
            showToast({ variant: 'success', message: 'Lieu supprimé' });
            loadData();
          } catch (err: any) {
            showToast({ variant: 'error', message: err?.message || 'Erreur' });
          }
        },
      },
    ]);
  };

  // Set default
  const handleSetDefault = async (loc: WithId<Location>) => {
    if (!providerId || loc.isDefault) return;
    try {
      await locationService.setDefault(providerId, loc.id);
      showToast({ variant: 'success', message: `${loc.name} est maintenant le lieu principal` });
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    }
  };

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
          <Text variant="h3" style={{ fontWeight: '600' }}>Lieux</Text>
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
        {locations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="location-outline" size={32} color={colors.primary} />
            </View>
            <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>Aucun lieu</Text>
            <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
              Ajoutez un lieu pour accueillir vos clients.
            </Text>
            <Button variant="primary" title="Ajouter un lieu" onPress={openCreate} style={{ marginTop: spacing.lg }} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {locations.map((loc) => (
              <Pressable key={loc.id} onPress={() => openEdit(loc)} style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}>
                <Card padding="md" shadow="sm">
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                        <Text variant="body" style={{ fontWeight: '600' }}>{loc.name}</Text>
                        {loc.isDefault && (
                          <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                            <Text variant="caption" color="primary" style={{ fontWeight: '600', fontSize: 10 }}>Principal</Text>
                          </View>
                        )}
                        {!loc.isActive && (
                          <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                            <Text variant="caption" style={{ color: '#DC2626', fontWeight: '600', fontSize: 10 }}>Inactif</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <Ionicons name={loc.type === 'mobile' ? 'car-outline' : 'business-outline'} size={14} color={colors.textMuted} />
                        <Text variant="caption" color="textSecondary">
                          {loc.type === 'mobile'
                            ? `Déplacement ${loc.travelRadius ? `${loc.travelRadius} km` : ''} autour de ${loc.city}`
                            : loc.address
                              ? `${loc.address}, ${loc.postalCode} ${loc.city}`
                              : `${loc.postalCode} ${loc.city}`
                          }
                        </Text>
                      </View>
                      {!loc.isDefault && loc.isActive && (
                        <Pressable onPress={() => handleSetDefault(loc)} style={{ marginTop: spacing.xs }}>
                          <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>Définir comme principal</Text>
                        </Pressable>
                      )}
                    </View>
                    {!loc.isDefault && (
                      <Pressable onPress={() => handleDelete(loc)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                      </Pressable>
                    )}
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Create/Edit Modal ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">{editingId ? 'Modifier le lieu' : 'Nouveau lieu'}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>

              <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
                <View style={{ gap: spacing.md }}>
                  <Input label="Nom du lieu" placeholder="Ex: Salon principal" value={form.name} onChangeText={(t) => setForm((p) => ({ ...p, name: t }))} autoCapitalize="words" />

                  {/* Type */}
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}>Type</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {(['fixed', 'mobile'] as const).map((type) => (
                        <Pressable
                          key={type}
                          onPress={() => setForm((p) => ({ ...p, type }))}
                          style={[
                            styles.typeChip,
                            {
                              backgroundColor: form.type === type ? colors.primaryLight : colors.surfaceSecondary,
                              borderRadius: radius.md,
                              borderColor: form.type === type ? colors.primary : 'transparent',
                              padding: spacing.sm,
                              paddingHorizontal: spacing.md,
                            },
                          ]}
                        >
                          <Ionicons name={type === 'fixed' ? 'business-outline' : 'car-outline'} size={18} color={form.type === type ? colors.primary : colors.textMuted} />
                          <Text variant="bodySmall" color={form.type === type ? 'primary' : 'textSecondary'} style={{ marginLeft: spacing.xs, fontWeight: form.type === type ? '600' : '400' }}>
                            {type === 'fixed' ? 'Fixe' : 'Mobile'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* City only toggle (fixed type) */}
                  {form.type === 'fixed' && (
                    <Pressable
                      onPress={() => {
                        const newCityOnly = !form.cityOnly;
                        setForm((p) => ({
                          ...p,
                          cityOnly: newCityOnly,
                          ...(newCityOnly ? { address: '' } : {}),
                        }));
                        if (newCityOnly) {
                          setAddressQuery('');
                          setSuggestions([]);
                          setShowSuggestions(false);
                        } else {
                          setCityQuery('');
                          setCitySuggestions([]);
                          setShowCitySuggestions(false);
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
                    >
                      <Ionicons
                        name={form.cityOnly ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={form.cityOnly ? colors.primary : colors.textMuted}
                      />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text variant="bodySmall" style={{ fontWeight: '500' }}>Ville uniquement</Text>
                        <Text variant="caption" color="textMuted">Ne pas afficher d'adresse précise</Text>
                      </View>
                    </Pressable>
                  )}

                  {/* Address autocomplete (only if not cityOnly) */}
                  {!form.cityOnly && (
                    <View style={{ zIndex: 10 }}>
                      <Input
                        label="Adresse"
                        placeholder="Saisissez une adresse..."
                        value={addressQuery || form.address}
                        onChangeText={handleAddressSearch}
                        autoCapitalize="words"
                        rightIcon={
                          addressLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Ionicons name="location-outline" size={18} color={colors.textMuted} />
                          )
                        }
                      />
                      {showSuggestions && suggestions.length > 0 && (
                        <View style={[styles.suggestionsBox, { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: radius.lg }]}>
                          {suggestions.map((s, i) => (
                            <Pressable
                              key={s.label + i}
                              onPress={() => handleAddressSelect(s)}
                              style={({ pressed }) => [styles.suggestionItem, { padding: spacing.md, backgroundColor: pressed ? colors.primaryLight : 'transparent', borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }]}
                            >
                              <Ionicons name="location" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                <Text variant="bodySmall" style={{ fontWeight: '500' }}>{s.name}</Text>
                                <Text variant="caption" color="textMuted">{s.postcode} {s.city}</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  {/* City autocomplete (cityOnly mode) */}
                  {form.cityOnly && (
                    <View style={{ zIndex: 10 }}>
                      <Input
                        label="Rechercher une ville"
                        placeholder="Saisissez une ville..."
                        value={cityQuery}
                        onChangeText={handleCitySearch}
                        autoCapitalize="words"
                        rightIcon={
                          cityLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                          )
                        }
                      />
                      {showCitySuggestions && citySuggestions.length > 0 && (
                        <View style={[styles.suggestionsBox, { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: radius.lg }]}>
                          {citySuggestions.map((s, i) => (
                            <Pressable
                              key={s.label + i}
                              onPress={() => handleCitySelect(s)}
                              style={({ pressed }) => [styles.suggestionItem, { padding: spacing.md, backgroundColor: pressed ? colors.primaryLight : 'transparent', borderTopWidth: i > 0 ? 1 : 0, borderTopColor: colors.border }]}
                            >
                              <Ionicons name="location" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                                <Text variant="bodySmall" style={{ fontWeight: '500' }}>{s.city}</Text>
                                <Text variant="caption" color="textMuted">{s.postcode}</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Input label="Code postal" placeholder="75001" value={form.postalCode} disabled />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Input label="Ville" placeholder="Paris" value={form.city} disabled />
                    </View>
                  </View>

                  {form.type === 'mobile' && (
                    <Input label="Rayon de déplacement (km)" placeholder="20" value={form.travelRadius} onChangeText={(t) => setForm((p) => ({ ...p, travelRadius: t }))} keyboardType="number-pad" />
                  )}

                  <Input label="Description (optionnel)" placeholder="Informations complémentaires" value={form.description} onChangeText={(t) => setForm((p) => ({ ...p, description: t }))} multiline numberOfLines={3} />
                </View>
              </ScrollView>

            <View style={[styles.stickyFooter, { padding: spacing.lg, paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border }]}>
              <Button variant="primary" title={isSaving ? 'Enregistrement...' : 'Enregistrer'} onPress={handleSave} loading={isSaving} disabled={isSaving} fullWidth />
            </View>
          </View>
        </View>
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
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  typeChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  stickyFooter: { borderTopWidth: 1 },
  suggestionsBox: { position: 'absolute', top: '100%', left: 0, right: 0, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, marginTop: 4 },
  suggestionItem: { flexDirection: 'row', alignItems: 'flex-start' },
});
