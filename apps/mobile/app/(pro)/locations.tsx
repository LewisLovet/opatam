/**
 * Locations Management Screen
 * List, create, edit, delete, toggle active/inactive locations.
 * Shows assigned members per location with reassignment bottom sheet.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
import { Text, Button, Input, Card, Avatar, useToast } from '../../components';
import { useProvider } from '../../contexts';
import { locationService, memberService, type WithId } from '@booking-app/firebase';
import type { Location, Member } from '@booking-app/shared/types';

// ---------------------------------------------------------------------------
// Address Autocomplete (Google Places + BAN fallback)
// ---------------------------------------------------------------------------

interface AddressSuggestion {
  label: string;
  name: string;
  city: string;
  postcode: string;
  coordinates: { latitude: number; longitude: number } | null;
  placeId: string;
}

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

async function searchAddress(query: string, countryCode: string = 'fr', limit = 5): Promise<AddressSuggestion[]> {
  if (GOOGLE_API_KEY) {
    try {
      const body = {
        input: query,
        includedRegionCodes: [countryCode.toLowerCase()],
        includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route', 'locality'],
      };
      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      );
      if (response.ok) {
        const json = await response.json();
        const results = (json.suggestions ?? []).slice(0, limit).map((s: any) => ({
          label: s.placePrediction?.text?.text ?? '',
          name: s.placePrediction?.structuredFormat?.mainText?.text ?? '',
          city: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
          postcode: '',
          coordinates: null,
          placeId: s.placePrediction?.placeId ?? '',
        }));
        if (results.length > 0) return results;
      }
    } catch { /* fall through to BAN */ }
  }
  // Fallback BAN (France only)
  if (countryCode.toLowerCase() !== 'fr') return [];
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`https://api-adresse.data.gouv.fr/search?${params}`);
  if (!response.ok) return [];
  const json = await response.json();
  return (json.features ?? []).map((f: any) => ({
    label: f.properties.label,
    name: f.properties.name,
    city: f.properties.city,
    postcode: f.properties.postcode,
    coordinates: { latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] },
    placeId: '',
  }));
}

async function fetchPlaceDetails(placeId: string): Promise<{
  city: string; postcode: string; region: string; coordinates: { latitude: number; longitude: number } | null; formattedAddress: string;
} | null> {
  if (!GOOGLE_API_KEY || !placeId) return null;
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?key=${GOOGLE_API_KEY}&fields=formattedAddress,addressComponents,location,id`
  );
  if (!response.ok) return null;
  const place = await response.json();
  const components: any[] = place.addressComponents ?? [];
  const getComp = (type: string) => components.find((c: any) => c.types?.includes(type));
  const locality = getComp('locality') ?? getComp('postal_town') ?? getComp('administrative_area_level_3');
  const postalCode = getComp('postal_code');
  const adminArea1 = getComp('administrative_area_level_1');
  return {
    city: locality?.longText ?? '',
    region: adminArea1?.longText ?? '',
    postcode: postalCode?.longText ?? '',
    formattedAddress: place.formattedAddress ?? '',
    coordinates: place.location ? { latitude: place.location.latitude, longitude: place.location.longitude } : null,
  };
}

const COUNTRY_OPTIONS = [
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'BE', label: '🇧🇪 Belgique' },
  { code: 'LU', label: '🇱🇺 Luxembourg' },
  { code: 'CH', label: '🇨🇭 Suisse' },
  { code: 'DE', label: '🇩🇪 Allemagne' },
  { code: 'ES', label: '🇪🇸 Espagne' },
  { code: 'IT', label: '🇮🇹 Italie' },
  { code: 'NL', label: '🇳🇱 Pays-Bas' },
  { code: 'PT', label: '🇵🇹 Portugal' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationFormData {
  name: string;
  countryCode: string;
  address: string;
  postalCode: string;
  city: string;
  region: string;
  description: string;
  type: 'fixed' | 'mobile';
  travelRadius: string;
  cityOnly: boolean;
}

const DEFAULT_FORM: LocationFormData = {
  name: '',
  countryCode: 'FR',
  address: '',
  postalCode: '',
  city: '',
  region: '',
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
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assignment modal
  const [assignLocationId, setAssignLocationId] = useState<string | null>(null);
  const [assignLocationName, setAssignLocationName] = useState('');
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [isSavingAssign, setIsSavingAssign] = useState(false);

  // Group members by locationId
  const membersByLocation = useMemo(() => {
    const map: Record<string, WithId<Member>[]> = {};
    for (const m of members) {
      if (!m.isActive) continue;
      const key = m.locationId;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    }
    return map;
  }, [members]);

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
      const [locs, mems] = await Promise.all([
        locationService.getByProvider(providerId),
        memberService.getActiveByProvider(providerId),
      ]);
      setLocations(locs);
      setMembers(mems);
    } catch (err) {
      showToast({ variant: 'error', message: 'Erreur lors du chargement' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  // Pickers
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLocationNamePicker, setShowLocationNamePicker] = useState(false);

  // Address search (Google Places + BAN fallback)
  const handleAddressSearch = useCallback((query: string) => {
    setAddressQuery(query);
    setForm((p) => ({ ...p, address: query }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 3) { setSuggestions([]); setShowSuggestions(false); setAddressLoading(false); return; }
    setAddressLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(query, form.countryCode);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch { setSuggestions([]); setShowSuggestions(false); }
      finally { setAddressLoading(false); }
    }, 300);
  }, [form.countryCode]);

  const handleAddressSelect = async (s: AddressSuggestion) => {
    setAddressQuery(s.name);
    setShowSuggestions(false);
    setSuggestions([]);
    if (s.placeId) {
      setAddressLoading(true);
      try {
        const details = await fetchPlaceDetails(s.placeId);
        if (details) {
          setForm((p) => ({ ...p, address: details.formattedAddress, city: details.city, postalCode: details.postcode, region: details.region }));
          return;
        }
      } catch { /* fallback */ }
      finally { setAddressLoading(false); }
    }
    setForm((p) => ({ ...p, address: s.label || s.name, city: s.city, postalCode: s.postcode }));
  };

  // City search (Google Places + BAN fallback)
  const handleCitySearch = useCallback((query: string) => {
    setCityQuery(query);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (query.length < 2) { setCitySuggestions([]); setShowCitySuggestions(false); setCityLoading(false); return; }
    setCityLoading(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(query, form.countryCode);
        setCitySuggestions(results);
        setShowCitySuggestions(results.length > 0);
      } catch { setCitySuggestions([]); setShowCitySuggestions(false); }
      finally { setCityLoading(false); }
    }, 300);
  }, [form.countryCode]);

  const handleCitySelect = async (s: AddressSuggestion) => {
    setCityQuery(s.city || s.name);
    setShowCitySuggestions(false);
    if (s.placeId) {
      setCityLoading(true);
      try {
        const details = await fetchPlaceDetails(s.placeId);
        if (details) {
          setForm((p) => ({ ...p, city: details.city, postalCode: details.postcode, region: details.region }));
          return;
        }
      } catch { /* fallback */ }
      finally { setCityLoading(false); }
    }
    setForm((p) => ({ ...p, city: s.city || s.name, postalCode: s.postcode }));
    setCitySuggestions([]);
  };

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
      countryCode: loc.countryCode || 'FR',
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
    if (!form.cityOnly && !form.postalCode.trim()) { showToast({ variant: 'error', message: 'Le code postal est requis' }); return; }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.cityOnly ? '' : form.address.trim(),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        country: 'France' as const,
        countryCode: form.countryCode,
        region: form.region || null,
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

  // Open assignment sheet
  const openAssignSheet = (loc: WithId<Location>) => {
    setAssignLocationId(loc.id);
    setAssignLocationName(loc.name);
    // Build current assignments: memberId → locationId
    const current: Record<string, string> = {};
    for (const m of members) {
      if (!m.isActive) continue;
      current[m.id] = m.locationId;
    }
    setPendingAssignments(current);
  };

  // Toggle member in pending assignments
  const toggleMemberAssignment = (memberId: string) => {
    if (!assignLocationId) return;
    setPendingAssignments((prev) => {
      const current = prev[memberId];
      if (current === assignLocationId) {
        // Can't unassign — every member needs a location, do nothing
        return prev;
      }
      return { ...prev, [memberId]: assignLocationId };
    });
  };

  // Save assignments
  const handleSaveAssignments = async () => {
    if (!providerId || !assignLocationId) return;
    setIsSavingAssign(true);
    try {
      const changes: Promise<void>[] = [];
      for (const m of members) {
        if (!m.isActive) continue;
        const newLocId = pendingAssignments[m.id];
        if (newLocId && newLocId !== m.locationId) {
          changes.push(memberService.changeLocation(providerId, m.id, newLocId));
        }
      }
      if (changes.length > 0) {
        await Promise.all(changes);
        showToast({ variant: 'success', message: 'Membres mis à jour' });
        loadData();
      }
      setAssignLocationId(null);
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    } finally {
      setIsSavingAssign(false);
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

                  {/* Members assigned to this location */}
                  <View style={[styles.membersDivider, { backgroundColor: colors.border }]} />
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); openAssignSheet(loc); }}
                    style={({ pressed }) => [styles.membersRow, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    {(membersByLocation[loc.id] || []).length > 0 ? (
                      <>
                        <View style={styles.avatarStack}>
                          {(membersByLocation[loc.id] || []).slice(0, 4).map((m, i) => (
                            <View key={m.id} style={[styles.avatarWrapper, { marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i }]}>
                              <Avatar
                                imageUrl={m.photoURL}
                                name={m.name}
                                size="sm"
                                color={m.color}
                              />
                            </View>
                          ))}
                          {(membersByLocation[loc.id] || []).length > 4 && (
                            <View style={[styles.avatarWrapper, styles.avatarMore, { marginLeft: -8, backgroundColor: colors.surfaceSecondary }]}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>
                                +{(membersByLocation[loc.id] || []).length - 4}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text variant="caption" color="textSecondary" style={{ flex: 1, marginLeft: 8 }}>
                          {(membersByLocation[loc.id] || []).map((m) => m.name.split(' ')[0]).join(', ')}
                        </Text>
                      </>
                    ) : (
                      <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                        Aucun membre assigné
                      </Text>
                    )}
                    <View style={[styles.assignButton, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="person-add-outline" size={14} color={colors.primary} />
                    </View>
                  </Pressable>
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
                  {/* Location name — dropdown with presets + custom */}
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>Nom du lieu</Text>
                    <Pressable
                      onPress={() => setShowLocationNamePicker((v) => !v)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
                        borderRadius: radius.lg, borderWidth: 1,
                        borderColor: showLocationNamePicker ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Text variant="body" style={{ fontWeight: '500', color: form.name ? colors.text : colors.textMuted }}>
                        {form.name || 'Choisir un nom'}
                      </Text>
                      <Ionicons name={showLocationNamePicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                    </Pressable>
                    {showLocationNamePicker && (
                      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.xs, overflow: 'hidden' }}>
                        {['Mon salon', 'Mon cabinet', 'Mon studio', 'Mon atelier', 'A domicile', 'Mon bureau', 'RDV en ligne', 'Consultation téléphonique', 'Consultation vidéo', 'Autre...'].map((opt) => {
                          const isOther = opt === 'Autre...';
                          const isSelected = isOther
                            ? !['Mon salon', 'Mon cabinet', 'Mon studio', 'Mon atelier', 'A domicile', 'Mon bureau', 'RDV en ligne'].includes(form.name)
                            : form.name === opt;
                          return (
                            <Pressable
                              key={opt}
                              onPress={() => {
                                if (isOther) {
                                  setForm((p) => ({ ...p, name: '' }));
                                } else {
                                  setForm((p) => ({ ...p, name: opt }));
                                }
                                setShowLocationNamePicker(false);
                              }}
                              style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                                backgroundColor: isSelected ? (colors.primaryLight || '#e4effa') : 'transparent',
                              }}
                            >
                              <Text variant="bodySmall" style={{ fontWeight: isSelected ? '600' : '400', color: isSelected ? colors.primary : colors.text }}>
                                {opt}
                              </Text>
                              {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    {!['Mon salon', 'Mon cabinet', 'Mon studio', 'Mon atelier', 'A domicile', 'Mon bureau', 'RDV en ligne', 'Consultation téléphonique', 'Consultation vidéo', ''].includes(form.name) || (form.name === '' && !showLocationNamePicker) ? (
                      <Input
                        placeholder="Nom personnalisé du lieu"
                        value={form.name}
                        onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
                        autoCapitalize="words"
                      />
                    ) : null}
                  </View>

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

                  {/* Country selector — inline expandable (Modal-in-Modal doesn't work on RN) */}
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>Pays</Text>
                    <Pressable
                      onPress={() => setShowCountryPicker((v) => !v)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingHorizontal: spacing.md, paddingVertical: spacing.md,
                        borderRadius: radius.lg, borderWidth: 1,
                        borderColor: showCountryPicker ? colors.primary : colors.border,
                        backgroundColor: colors.surface,
                      }}
                    >
                      <Text variant="body" style={{ fontWeight: '600' }}>
                        {COUNTRY_OPTIONS.find((c) => c.code === form.countryCode)?.label || '🇫🇷 France'}
                      </Text>
                      <Ionicons name={showCountryPicker ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                    </Pressable>
                    {showCountryPicker && (
                      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.xs, overflow: 'hidden' }}>
                        {COUNTRY_OPTIONS.map((item) => {
                          const isSelected = form.countryCode === item.code;
                          return (
                            <Pressable
                              key={item.code}
                              onPress={() => {
                                setForm((p) => ({ ...p, countryCode: item.code, address: '', city: '', postalCode: '', region: '' }));
                                setAddressQuery(''); setCityQuery('');
                                setShowCountryPicker(false);
                              }}
                              style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
                                backgroundColor: isSelected ? (colors.primaryLight || '#e4effa') : 'transparent',
                              }}
                            >
                              <Text variant="bodySmall" style={{ fontWeight: isSelected ? '600' : '400', color: isSelected ? colors.primary : colors.text }}>
                                {item.label}
                              </Text>
                              {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  {/* Address type selector (fixed type) */}
                  {form.type === 'fixed' && (
                    <View>
                      <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>Type de localisation</Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Pressable
                          onPress={() => {
                            setForm((p) => ({ ...p, cityOnly: false }));
                            setCityQuery(''); setCitySuggestions([]); setShowCitySuggestions(false);
                          }}
                          style={{
                            flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg,
                            borderWidth: 2, borderColor: !form.cityOnly ? colors.primary : colors.border,
                            backgroundColor: !form.cityOnly ? (colors.primaryLight || '#e4effa') : colors.surface,
                          }}
                        >
                          <Ionicons name="location-outline" size={20} color={!form.cityOnly ? colors.primary : colors.textMuted} />
                          <Text variant="bodySmall" style={{ fontWeight: '600', marginTop: 4, color: !form.cityOnly ? colors.primary : colors.text }}>
                            Adresse précise
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setForm((p) => ({ ...p, cityOnly: true, address: '', postalCode: '', city: '' }));
                            setAddressQuery(''); setSuggestions([]); setShowSuggestions(false);
                          }}
                          style={{
                            flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg,
                            borderWidth: 2, borderColor: form.cityOnly ? colors.primary : colors.border,
                            backgroundColor: form.cityOnly ? (colors.primaryLight || '#e4effa') : colors.surface,
                          }}
                        >
                          <Ionicons name="business-outline" size={20} color={form.cityOnly ? colors.primary : colors.textMuted} />
                          <Text variant="bodySmall" style={{ fontWeight: '600', marginTop: 4, color: form.cityOnly ? colors.primary : colors.text }}>
                            Ville uniquement
                          </Text>
                        </Pressable>
                      </View>
                    </View>
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
                                <Text variant="bodySmall" style={{ fontWeight: '500' }}>{s.name || s.city}</Text>
                                <Text variant="caption" color="textMuted">{s.city !== s.name ? s.city : ''} {s.postcode}</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    {!form.cityOnly && form.postalCode ? (
                      <View style={{ flex: 1 }}>
                        <Input label="Code postal" placeholder="—" value={form.postalCode} disabled />
                      </View>
                    ) : null}
                    <View style={{ flex: form.cityOnly ? 1 : 2 }}>
                      <Input label="Ville" placeholder="—" value={form.city} disabled />
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

      {/* ── Member Assignment Modal ── */}
      <Modal visible={assignLocationId !== null} transparent animationType="slide" onRequestClose={() => setAssignLocationId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setAssignLocationId(null)}>
          <Pressable style={[styles.assignModalContent, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]} onPress={(e) => e.stopPropagation()}>
            {/* Handle bar */}
            <View style={styles.handleBar}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>

            <View style={[styles.assignModalHeader, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
              <View style={{ flex: 1 }}>
                <Text variant="h3" style={{ fontWeight: '600' }}>Membres</Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>{assignLocationName}</Text>
              </View>
              <Pressable onPress={() => setAssignLocationId(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] }} showsVerticalScrollIndicator={false}>
              {members.filter((m) => m.isActive).length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'] }}>
                  <Ionicons name="people-outline" size={40} color={colors.textMuted} />
                  <Text variant="body" color="textMuted" align="center" style={{ marginTop: spacing.sm }}>
                    Aucun membre actif.{'\n'}Créez des membres depuis la page Équipe.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 2 }}>
                  {members.filter((m) => m.isActive).map((m) => {
                    const isAssigned = pendingAssignments[m.id] === assignLocationId;
                    const currentLoc = locations.find((l) => l.id === m.locationId);
                    const pendingLoc = locations.find((l) => l.id === pendingAssignments[m.id]);
                    const hasChanged = pendingAssignments[m.id] !== m.locationId;

                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => toggleMemberAssignment(m.id)}
                        style={({ pressed }) => [
                          styles.assignMemberRow,
                          {
                            backgroundColor: isAssigned ? colors.primaryLight : pressed ? colors.surfaceSecondary : 'transparent',
                            borderRadius: radius.md,
                          },
                        ]}
                      >
                        <Avatar
                          imageUrl={m.photoURL}
                          name={m.name}
                          size="sm"
                          color={m.color}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text variant="body" style={{ fontWeight: '500' }}>{m.name}</Text>
                          <Text variant="caption" color="textMuted">
                            {hasChanged
                              ? `${currentLoc?.name || '?'} → ${pendingLoc?.name || '?'}`
                              : isAssigned
                                ? 'Ce lieu'
                                : currentLoc?.name || '—'}
                          </Text>
                        </View>
                        <View style={[
                          styles.assignCheck,
                          {
                            backgroundColor: isAssigned ? colors.primary : 'transparent',
                            borderColor: isAssigned ? colors.primary : colors.border,
                          },
                        ]}>
                          {isAssigned && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={[styles.stickyFooter, { padding: spacing.lg, paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border }]}>
              <Button
                variant="primary"
                title={isSavingAssign ? 'Enregistrement...' : 'Confirmer'}
                onPress={handleSaveAssignments}
                loading={isSavingAssign}
                disabled={isSavingAssign}
                fullWidth
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '60%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text variant="h3">Pays</Text>
              <Pressable onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            {COUNTRY_OPTIONS.map((item) => {
              const isSelected = form.countryCode === item.code;
              return (
                <Pressable
                  key={item.code}
                  onPress={() => {
                    setForm((p) => ({ ...p, countryCode: item.code, address: '', city: '', postalCode: '' }));
                    setAddressQuery(''); setCityQuery('');
                    setShowCountryPicker(false);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
                    backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                  }}
                >
                  <Text variant="body" style={{ fontWeight: isSelected ? '600' : '400' }} color={isSelected ? 'primary' : 'text'}>
                    {item.label}
                  </Text>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                </Pressable>
              );
            })}
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
  // Member avatars in location card
  membersDivider: { height: 1, marginTop: 12, marginBottom: 0 },
  membersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 16,
  },
  avatarMore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Assignment modal
  assignModalContent: { maxHeight: '70%' },
  handleBar: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  assignModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assignCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
