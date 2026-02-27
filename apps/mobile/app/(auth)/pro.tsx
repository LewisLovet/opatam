/**
 * Pro Registration Screen
 * Native multi-step wizard for provider registration (6 steps)
 * Replaces the old Safari redirect for Apple compliance (Guideline 4.0)
 *
 * UI inspired by client registration: gradient background + floating bubbles
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Switch as RNSwitch,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button, Input, useToast } from '../../components';
import {
  authService,
  providerService,
  locationService,
  memberService,
  serviceRepository,
  schedulingService,
} from '@booking-app/firebase';
import { CATEGORIES, DAYS_OF_WEEK } from '@booking-app/shared/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  isOpen: boolean;
  slots: TimeSlot[];
}

interface WizardData {
  // Step 1 — Business
  businessName: string;
  category: string;
  description: string;
  // Step 2 — Location
  locationName: string;
  address: string;
  postalCode: string;
  city: string;
  // Step 3 — Service
  serviceName: string;
  serviceDuration: number;
  servicePrice: string;
  serviceDescription: string;
  // Step 4 — Schedule
  availability: Record<number, DayAvailability>;
  // Step 6 — Account
  displayName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const DEFAULT_AVAILABILITY: Record<number, DayAvailability> = {
  0: { isOpen: false, slots: [{ start: '09:00', end: '18:00' }] },
  1: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  2: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  3: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  4: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  5: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  6: { isOpen: false, slots: [{ start: '09:00', end: '18:00' }] },
};

const DEFAULT_DATA: WizardData = {
  businessName: '',
  category: '',
  description: '',
  locationName: '',
  address: '',
  postalCode: '',
  city: '',
  serviceName: '',
  serviceDuration: 60,
  servicePrice: '',
  serviceDescription: '',
  availability: DEFAULT_AVAILABILITY,
  displayName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

const STEPS = [
  { label: 'Activité', icon: 'business-outline' as const, subtitle: 'Parlez-nous de votre activité' },
  { label: 'Lieu', icon: 'location-outline' as const, subtitle: 'Où exercez-vous ?' },
  { label: 'Prestation', icon: 'pricetag-outline' as const, subtitle: 'Votre première prestation' },
  { label: 'Horaires', icon: 'time-outline' as const, subtitle: 'Vos disponibilités' },
  { label: 'Aperçu', icon: 'eye-outline' as const, subtitle: 'Vérifiez vos informations' },
  { label: 'Compte', icon: 'person-outline' as const, subtitle: 'Créez votre accès' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];

// Map Lucide icon names to Ionicons equivalents
const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sparkles: 'sparkles-outline',
  heart: 'heart-outline',
  dumbbell: 'barbell-outline',
  lightbulb: 'bulb-outline',
  camera: 'camera-outline',
  laptop: 'laptop-outline',
  wrench: 'construct-outline',
  home: 'home-outline',
  book: 'book-outline',
  music: 'musical-notes-outline',
  briefcase: 'briefcase-outline',
  car: 'car-outline',
  paw: 'paw-outline',
  palette: 'color-palette-outline',
  'more-horizontal': 'ellipsis-horizontal-outline',
};

// Days for schedule display (Mon-Sun, French style)
const SCHEDULE_DAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
];

// ---------------------------------------------------------------------------
// Floating Bubbles Background
// ---------------------------------------------------------------------------

interface BubbleConfig {
  size: number;
  startX: number;
  startY: number;
  color: string;
  duration: number;
  delay: number;
}

const BUBBLES: BubbleConfig[] = [
  { size: 120, startX: -40, startY: SCREEN_HEIGHT * 0.06, color: 'rgba(26, 109, 175, 0.12)', duration: 9000, delay: 0 },
  { size: 80, startX: SCREEN_WIDTH - 50, startY: SCREEN_HEIGHT * 0.12, color: 'rgba(41, 139, 206, 0.10)', duration: 11000, delay: 300 },
  { size: 60, startX: SCREEN_WIDTH * 0.35, startY: SCREEN_HEIGHT * 0.45, color: 'rgba(26, 109, 175, 0.08)', duration: 13000, delay: 700 },
  { size: 90, startX: SCREEN_WIDTH - 70, startY: SCREEN_HEIGHT * 0.55, color: 'rgba(41, 139, 206, 0.10)', duration: 10000, delay: 150 },
  { size: 70, startX: 20, startY: SCREEN_HEIGHT * 0.7, color: 'rgba(26, 109, 175, 0.09)', duration: 12000, delay: 500 },
  { size: 50, startX: SCREEN_WIDTH * 0.55, startY: SCREEN_HEIGHT * 0.3, color: 'rgba(41, 139, 206, 0.07)', duration: 14000, delay: 800 },
];

function FloatingBubble({ bubble }: { bubble: BubbleConfig }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 1000,
      delay: bubble.delay,
      useNativeDriver: true,
    }).start();

    const floatY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -25, duration: bubble.duration / 2, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: bubble.duration / 2, useNativeDriver: true }),
      ])
    );

    const floatX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 12, duration: bubble.duration / 2 + 800, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -12, duration: bubble.duration / 2 + 800, useNativeDriver: true }),
      ])
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: bubble.duration / 2, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.85, duration: bubble.duration / 2, useNativeDriver: true }),
      ])
    );

    setTimeout(() => {
      floatY.start();
      floatX.start();
      pulse.start();
    }, bubble.delay);

    return () => {
      floatY.stop();
      floatX.stop();
      pulse.stop();
    };
  }, []);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: bubble.size,
          height: bubble.size,
          borderRadius: bubble.size / 2,
          backgroundColor: bubble.color,
          left: bubble.startX,
          top: bubble.startY,
          transform: [{ translateY }, { translateX }, { scale }],
          opacity,
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Address Autocomplete (BAN — api-adresse.data.gouv.fr)
// ---------------------------------------------------------------------------

interface AddressSuggestion {
  label: string;
  name: string;
  city: string;
  postcode: string;
  coordinates: { latitude: number; longitude: number };
}

const BAN_API_URL = 'https://api-adresse.data.gouv.fr/search';

async function searchAddress(query: string, limit = 5): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const response = await fetch(`${BAN_API_URL}?${params}`);
  if (!response.ok) return [];
  const json = await response.json();
  return (json.features ?? []).map((f: any) => ({
    label: f.properties.label,
    name: f.properties.name,
    city: f.properties.city,
    postcode: f.properties.postcode,
    coordinates: {
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    },
  }));
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ProRegisterScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDurationModal, setShowDurationModal] = useState(false);

  // Address autocomplete
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const stepSlideAnim = useRef(new Animated.Value(0)).current;

  // Initial entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // Step transition animation
  const animateStepTransition = (direction: 'forward' | 'back') => {
    const startX = direction === 'forward' ? 30 : -30;
    stepFadeAnim.setValue(0);
    stepSlideAnim.setValue(startX);
    Animated.parallel([
      Animated.timing(stepFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(stepSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const updateField = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  // Address handlers
  const handleAddressSearch = useCallback((query: string) => {
    setAddressQuery(query);
    updateField('address', query);
    if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setAddressLoading(false);
      return;
    }
    setAddressLoading(true);
    addressDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchAddress(query);
        setAddressSuggestions(results);
        setShowAddressSuggestions(results.length > 0);
      } catch {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      } finally {
        setAddressLoading(false);
      }
    }, 300);
  }, []);

  const handleAddressSelect = useCallback((suggestion: AddressSuggestion) => {
    setAddressQuery(suggestion.name);
    updateField('address', suggestion.name);
    updateField('city', suggestion.city);
    updateField('postalCode', suggestion.postcode);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  }, []);

  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const validateStep = (): string | null => {
    switch (currentStep) {
      case 0:
        if (!data.businessName.trim()) return 'Le nom de votre activité est requis';
        if (!data.category) return 'Veuillez choisir une catégorie';
        return null;
      case 1:
        if (!data.locationName.trim()) return 'Le nom du lieu est requis';
        if (!data.city.trim()) return 'La ville est requise';
        if (!data.postalCode.trim()) return 'Le code postal est requis';
        return null;
      case 2:
        if (!data.serviceName.trim()) return 'Le nom de la prestation est requis';
        if (!data.servicePrice.trim() || isNaN(Number(data.servicePrice)) || Number(data.servicePrice) < 0)
          return 'Le prix doit être un nombre positif';
        return null;
      case 3: {
        const hasOpenDay = Object.values(data.availability).some((d) => d.isOpen);
        if (!hasOpenDay) return 'Au moins un jour doit être ouvert';
        return null;
      }
      case 4:
        return null;
      case 5:
        if (!data.displayName.trim()) return 'Votre nom est requis';
        if (!data.email.trim()) return "L'email est requis";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return "Format d'email invalide";
        if (!data.phone.trim()) return 'Le téléphone est requis';
        if (!/^0[67]\d{8}$/.test(data.phone.replace(/\s/g, ''))) return 'Format téléphone invalide (ex: 06 12 34 56 78)';
        if (!data.password || data.password.length < 6) return 'Le mot de passe doit contenir au moins 6 caractères';
        if (data.password !== data.confirmPassword) return 'Les mots de passe ne correspondent pas';
        return null;
      default:
        return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleNext = () => {
    const error = validateStep();
    if (error) {
      showToast({ variant: 'error', message: error });
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      animateStepTransition('forward');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      animateStepTransition('back');
    } else {
      router.back();
    }
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    const error = validateStep();
    if (error) {
      showToast({ variant: 'error', message: error });
      return;
    }

    setIsSubmitting(true);

    try {
      const { user: _userData, credential } = await authService.registerProvider({
        email: data.email.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
        displayName: data.displayName.trim(),
        phone: data.phone.replace(/\s/g, ''),
      });

      const userId = credential.user.uid;

      const provider = await providerService.createProvider(userId, {
        businessName: data.businessName.trim(),
        category: data.category,
        description: data.description.trim() || undefined,
      });

      const location = await locationService.createLocation(provider.id, {
        name: data.locationName.trim(),
        address: data.address.trim() || '',
        postalCode: data.postalCode.trim(),
        city: data.city.trim(),
        country: 'France',
        geopoint: null,
        description: null,
        type: 'fixed',
        travelRadius: null,
        photoURLs: [],
      });

      const defaultMember = await memberService.createDefaultMember(
        provider.id,
        data.displayName.trim() || data.businessName.trim(),
        data.email.trim(),
        location.id
      );

      await serviceRepository.create(provider.id, {
        name: data.serviceName.trim(),
        description: data.serviceDescription.trim() || null,
        duration: data.serviceDuration,
        price: Math.round(Number(data.servicePrice) * 100),
        bufferTime: 0,
        categoryId: null,
        isActive: true,
        locationIds: [location.id],
        memberIds: [defaultMember.id],
        sortOrder: 0,
      });

      const schedule = Object.entries(data.availability).map(([dayOfWeek, dayData]) => ({
        dayOfWeek: parseInt(dayOfWeek),
        isOpen: dayData.isOpen,
        slots: dayData.isOpen ? dayData.slots : [],
      }));

      await schedulingService.setWeeklySchedule(
        provider.id,
        defaultMember.id,
        location.id,
        schedule
      );

      await authService.logout();

      showToast({
        variant: 'success',
        message: 'Compte créé avec succès ! Connectez-vous pour commencer.',
      });

      router.replace('/(auth)/login');
    } catch (err: any) {
      console.error('Registration error:', err);
      const msg = err?.message || "Erreur lors de l'inscription";
      showToast({ variant: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Schedule helpers
  // ---------------------------------------------------------------------------

  const toggleDay = (dayValue: number) => {
    setData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [dayValue]: {
          ...prev.availability[dayValue],
          isOpen: !prev.availability[dayValue].isOpen,
        },
      },
    }));
  };

  const updateSlotTime = (dayValue: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    setData((prev) => {
      const day = prev.availability[dayValue];
      const newSlots = [...day.slots];
      newSlots[slotIndex] = { ...newSlots[slotIndex], [field]: value };
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [dayValue]: { ...day, slots: newSlots },
        },
      };
    });
  };

  const addSlot = (dayValue: number) => {
    setData((prev) => {
      const day = prev.availability[dayValue];
      const lastSlot = day.slots[day.slots.length - 1];
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [dayValue]: {
            ...day,
            slots: [...day.slots, { start: lastSlot?.end || '14:00', end: '18:00' }],
          },
        },
      };
    });
  };

  const removeSlot = (dayValue: number, slotIndex: number) => {
    setData((prev) => {
      const day = prev.availability[dayValue];
      if (day.slots.length <= 1) return prev;
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [dayValue]: {
            ...day,
            slots: day.slots.filter((_, i) => i !== slotIndex),
          },
        },
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Time picker modal
  // ---------------------------------------------------------------------------

  const [timePickerState, setTimePickerState] = useState<{
    visible: boolean;
    dayValue: number;
    slotIndex: number;
    field: 'start' | 'end';
    currentValue: string;
  } | null>(null);

  const TIME_OPTIONS: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Render Steps
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <View style={{ gap: spacing.md }}>
      <Input
        label="Nom de votre activité"
        placeholder="Ex: Studio Beauté Marie"
        value={data.businessName}
        onChangeText={(t) => updateField('businessName', t)}
        autoCapitalize="words"
      />

      <View>
        <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
          Catégorie
        </Text>
        <Pressable
          onPress={() => setShowCategoryModal(true)}
          style={({ pressed }) => [
            styles.selectButton,
            {
              borderColor: data.category ? colors.primary : colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              backgroundColor: 'rgba(255,255,255,0.8)',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {data.category ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons
                name={CATEGORY_ICONS[CATEGORIES.find((c) => c.id === data.category)?.icon || ''] || 'ellipsis-horizontal-outline'}
                size={20}
                color={colors.primary}
              />
              <Text variant="body" style={{ flex: 1 }}>
                {CATEGORIES.find((c) => c.id === data.category)?.label}
              </Text>
            </View>
          ) : (
            <Text variant="body" color="textMuted">Choisir une catégorie</Text>
          )}
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Input
        label="Description (optionnel)"
        placeholder="Décrivez votre activité en quelques mots"
        value={data.description}
        onChangeText={(t) => updateField('description', t)}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={{ gap: spacing.md }}>
      <Input
        label="Nom du lieu"
        placeholder="Ex: Salon principal"
        value={data.locationName}
        onChangeText={(t) => updateField('locationName', t)}
        autoCapitalize="words"
      />

      {/* Address with autocomplete */}
      <View style={{ zIndex: 10 }}>
        <Input
          label="Adresse"
          placeholder="Saisissez une adresse..."
          value={addressQuery || data.address}
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
        {showAddressSuggestions && addressSuggestions.length > 0 && (
          <View
            style={[
              styles.suggestionsContainer,
              {
                backgroundColor: '#FFFFFF',
                borderColor: colors.border,
                borderRadius: radius.lg,
              },
            ]}
          >
            {addressSuggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion.label + index}
                onPress={() => handleAddressSelect(suggestion)}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  {
                    padding: spacing.md,
                    backgroundColor: pressed ? colors.primaryLight : 'transparent',
                    borderTopWidth: index > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="location" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text variant="bodySmall" style={{ fontWeight: '500' }}>{suggestion.name}</Text>
                  <Text variant="caption" color="textMuted">
                    {suggestion.postcode} {suggestion.city}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Code postal"
            placeholder="75001"
            value={data.postalCode}
            onChangeText={(t) => updateField('postalCode', t)}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 2 }}>
          <Input
            label="Ville"
            placeholder="Paris"
            value={data.city}
            onChangeText={(t) => updateField('city', t)}
            autoCapitalize="words"
          />
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={{ gap: spacing.md }}>
      <Input
        label="Nom de la prestation"
        placeholder="Ex: Coupe femme"
        value={data.serviceName}
        onChangeText={(t) => updateField('serviceName', t)}
        autoCapitalize="sentences"
      />
      <View>
        <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
          Durée
        </Text>
        <Pressable
          onPress={() => setShowDurationModal(true)}
          style={({ pressed }) => [
            styles.selectButton,
            {
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              backgroundColor: 'rgba(255,255,255,0.8)',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text variant="body">
            {data.serviceDuration >= 60
              ? `${Math.floor(data.serviceDuration / 60)}h${data.serviceDuration % 60 > 0 ? String(data.serviceDuration % 60).padStart(2, '0') : ''}`
              : `${data.serviceDuration} min`}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      <Input
        label="Prix (€)"
        placeholder="0"
        value={data.servicePrice}
        onChangeText={(t) => updateField('servicePrice', t)}
        keyboardType="decimal-pad"
      />
      <Input
        label="Description (optionnel)"
        placeholder="Décrivez cette prestation"
        value={data.serviceDescription}
        onChangeText={(t) => updateField('serviceDescription', t)}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const renderStep4 = () => (
    <View style={{ gap: spacing.sm }}>
      {SCHEDULE_DAYS.map(({ value, label }) => {
        const day = data.availability[value];
        return (
          <View
            key={value}
            style={[
              styles.dayRow,
              {
                backgroundColor: day.isOpen ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)',
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: day.isOpen ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <RNSwitch
                  value={day.isOpen}
                  onValueChange={() => toggleDay(value)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFF"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                <Text variant="body" style={{ fontWeight: '600', minWidth: 80 }}>{label}</Text>
              </View>
              {day.isOpen && day.slots.length < 3 && (
                <Pressable onPress={() => addSlot(value)} hitSlop={8}>
                  <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                </Pressable>
              )}
            </View>
            {day.isOpen && day.slots.map((slot, si) => (
              <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, paddingLeft: 52 }}>
                <Pressable
                  onPress={() => setTimePickerState({ visible: true, dayValue: value, slotIndex: si, field: 'start', currentValue: slot.start })}
                  style={[styles.timePill, { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}
                >
                  <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>{slot.start}</Text>
                </Pressable>
                <Text variant="caption" color="textMuted">—</Text>
                <Pressable
                  onPress={() => setTimePickerState({ visible: true, dayValue: value, slotIndex: si, field: 'end', currentValue: slot.end })}
                  style={[styles.timePill, { backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}
                >
                  <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>{slot.end}</Text>
                </Pressable>
                {day.slots.length > 1 && (
                  <Pressable onPress={() => removeSlot(value, si)} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                  </Pressable>
                )}
              </View>
            ))}
            {!day.isOpen && (
              <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs, paddingLeft: 52 }}>Fermé</Text>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderStep5 = () => {
    const selectedCategory = CATEGORIES.find((c) => c.id === data.category);

    return (
      <View style={{ gap: spacing.md }}>
        {/* Business */}
        <View style={[styles.previewCard, { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.previewIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="business-outline" size={16} color={colors.primary} />
            </View>
            <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>Activité</Text>
          </View>
          <Text variant="h3">{data.businessName}</Text>
          <Text variant="bodySmall" color="textSecondary">{selectedCategory?.label}</Text>
          {data.description ? <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>{data.description}</Text> : null}
        </View>

        {/* Location */}
        <View style={[styles.previewCard, { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.previewIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="location-outline" size={16} color={colors.primary} />
            </View>
            <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>Lieu</Text>
          </View>
          <Text variant="body" style={{ fontWeight: '500' }}>{data.locationName}</Text>
          <Text variant="bodySmall" color="textSecondary">
            {[data.address, data.postalCode, data.city].filter(Boolean).join(', ')}
          </Text>
        </View>

        {/* Service */}
        <View style={[styles.previewCard, { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.previewIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
            </View>
            <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>Prestation</Text>
          </View>
          <Text variant="body" style={{ fontWeight: '500' }}>{data.serviceName}</Text>
          <Text variant="bodySmall" color="textSecondary">
            {data.serviceDuration} min • {Number(data.servicePrice).toFixed(2)} €
          </Text>
        </View>

        {/* Schedule */}
        <View style={[styles.previewCard, { backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={[styles.previewIconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="time-outline" size={16} color={colors.primary} />
            </View>
            <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>Horaires</Text>
          </View>
          {SCHEDULE_DAYS.map(({ value, label }) => {
            const day = data.availability[value];
            return (
              <View key={value} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                <Text variant="bodySmall" style={{ fontWeight: '500', minWidth: 80 }}>{label}</Text>
                <Text variant="bodySmall" color={day.isOpen ? 'text' : 'textMuted'}>
                  {day.isOpen ? day.slots.map((s) => `${s.start}-${s.end}`).join(', ') : 'Fermé'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderStep6 = () => (
    <View style={{ gap: spacing.md }}>
      <Input
        label="Nom complet"
        placeholder="Votre nom"
        value={data.displayName}
        onChangeText={(t) => updateField('displayName', t)}
        autoCapitalize="words"
        autoComplete="name"
      />
      <Input
        label="Email"
        placeholder="votre@email.com"
        value={data.email}
        onChangeText={(t) => updateField('email', t)}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Input
        label="Téléphone"
        placeholder="06 12 34 56 78"
        value={data.phone}
        onChangeText={(t) => updateField('phone', t)}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Input
        label="Mot de passe"
        placeholder="Min. 6 caractères"
        value={data.password}
        onChangeText={(t) => updateField('password', t)}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoComplete="new-password"
        helperText="Min. 6 caractères"
        rightIcon={
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textSecondary}
          />
        }
        onRightIconPress={() => setShowPassword(!showPassword)}
      />
      <Input
        label="Confirmer le mot de passe"
        placeholder="Confirmez votre mot de passe"
        value={data.confirmPassword}
        onChangeText={(t) => updateField('confirmPassword', t)}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
      />
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      case 4: return renderStep5();
      case 5: return renderStep6();
      default: return null;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <LinearGradient
      colors={['#e4effa', '#f2f8fd', '#FFFFFF']}
      style={styles.gradientContainer}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Animated bubbles background */}
      <View style={styles.bubblesContainer} pointerEvents="none">
        {BUBBLES.map((bubble, index) => (
          <FloatingBubble key={index} bubble={bubble} />
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + 100,
              paddingHorizontal: spacing.lg,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header: Back + Step Dots */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.backButton,
                  {
                    backgroundColor: '#FFFFFF',
                    borderRadius: radius.full,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={22} color={colors.primary} />
              </Pressable>

              {/* Step Dots */}
              <View style={styles.stepDots}>
                {STEPS.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: index <= currentStep ? colors.primary : 'rgba(59, 130, 246, 0.2)',
                        width: index === currentStep ? 24 : 8,
                      },
                    ]}
                  />
                ))}
              </View>

              <View style={{ width: 44 }} />
            </View>
          </Animated.View>

          {/* Step Title + Subtitle */}
          <Animated.View
            style={[
              { marginTop: spacing.xl },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.stepIconCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={STEPS[currentStep].icon} size={22} color={colors.primary} />
              </View>
              <View>
                <Text variant="h2" style={{ fontWeight: '700' }}>
                  {STEPS[currentStep].label}
                </Text>
                <Text variant="bodySmall" color="textSecondary">
                  {STEPS[currentStep].subtitle}
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Step Content */}
          <Animated.View
            style={[
              { marginTop: spacing.xl },
              { opacity: stepFadeAnim, transform: [{ translateX: stepSlideAnim }] },
            ]}
          >
            {renderCurrentStep()}
          </Animated.View>

          {/* Legal text on last step */}
          {isLastStep && (
            <Animated.View style={{ marginTop: spacing.lg, opacity: stepFadeAnim }}>
              <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
                En créant un compte, vous acceptez nos CGU et notre Politique de confidentialité.
              </Text>
            </Animated.View>
          )}

          {/* Footer link on first step */}
          {currentStep === 0 && (
            <Animated.View style={[styles.footerLink, { marginTop: spacing.xl, opacity: fadeAnim }]}>
              <Text variant="body" color="textSecondary">Déjà un compte ? </Text>
              <Pressable onPress={() => router.push('/(auth)/login')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text variant="body" color="primary" style={{ fontWeight: '600' }}>Se connecter</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>

        {/* Sticky Footer Button */}
        <View
          style={[
            styles.stickyFooter,
            {
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + spacing.sm,
              paddingTop: spacing.md,
            },
          ]}
        >
          {isLastStep ? (
            <Button
              variant="primary"
              title={isSubmitting ? 'Création en cours...' : 'Créer mon compte'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              fullWidth
            />
          ) : (
            <Button
              variant="primary"
              title="Continuer"
              onPress={handleNext}
              fullWidth
            />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Category Modal ── */}
      <Modal visible={showCategoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Catégorie</Text>
              <Pressable onPress={() => setShowCategoryModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <FlatList
              data={CATEGORIES}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    updateField('category', item.id);
                    setShowCategoryModal(false);
                  }}
                  style={({ pressed }) => [
                    styles.listItem,
                    {
                      padding: spacing.md,
                      paddingHorizontal: spacing.lg,
                      backgroundColor: data.category === item.id
                        ? colors.primaryLight
                        : pressed
                          ? 'rgba(0,0,0,0.03)'
                          : 'transparent',
                    },
                  ]}
                >
                  <View style={[
                    styles.listItemIcon,
                    { backgroundColor: data.category === item.id ? colors.primary : 'rgba(0,0,0,0.05)' },
                  ]}>
                    <Ionicons
                      name={CATEGORY_ICONS[item.icon] || 'ellipsis-horizontal-outline'}
                      size={18}
                      color={data.category === item.id ? '#FFFFFF' : colors.textSecondary}
                    />
                  </View>
                  <Text
                    variant="body"
                    style={{ flex: 1, marginLeft: spacing.sm, fontWeight: data.category === item.id ? '600' : '400' }}
                    color={data.category === item.id ? 'primary' : 'text'}
                  >
                    {item.label}
                  </Text>
                  {data.category === item.id && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </Pressable>
              )}
              style={{ maxHeight: 400 }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Duration Modal ── */}
      <Modal visible={showDurationModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Durée</Text>
              <Pressable onPress={() => setShowDurationModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <FlatList
              data={DURATION_OPTIONS}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => {
                const label = item >= 60
                  ? `${Math.floor(item / 60)}h${item % 60 > 0 ? String(item % 60).padStart(2, '0') : ''}`
                  : `${item} min`;
                return (
                  <Pressable
                    onPress={() => {
                      updateField('serviceDuration', item);
                      setShowDurationModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.listItem,
                      {
                        padding: spacing.md,
                        paddingHorizontal: spacing.lg,
                        backgroundColor: data.serviceDuration === item
                          ? colors.primaryLight
                          : pressed
                            ? 'rgba(0,0,0,0.03)'
                            : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={18}
                      color={data.serviceDuration === item ? colors.primary : colors.textMuted}
                    />
                    <Text
                      variant="body"
                      style={{ flex: 1, marginLeft: spacing.sm, fontWeight: data.serviceDuration === item ? '600' : '400' }}
                      color={data.serviceDuration === item ? 'primary' : 'text'}
                    >
                      {label}
                    </Text>
                    {data.serviceDuration === item && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Time Picker Modal ── */}
      {timePickerState?.visible && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
              <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
                <Text variant="h3">
                  {timePickerState.field === 'start' ? 'Heure de début' : 'Heure de fin'}
                </Text>
                <Pressable onPress={() => setTimePickerState(null)}>
                  <Ionicons name="close-circle" size={28} color={colors.textMuted} />
                </Pressable>
              </View>
              <FlatList
                data={TIME_OPTIONS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      updateSlotTime(timePickerState.dayValue, timePickerState.slotIndex, timePickerState.field, item);
                      setTimePickerState(null);
                    }}
                    style={({ pressed }) => [
                      styles.listItem,
                      {
                        padding: spacing.md,
                        paddingHorizontal: spacing.lg,
                        backgroundColor: timePickerState.currentValue === item
                          ? colors.primaryLight
                          : pressed
                            ? 'rgba(0,0,0,0.03)'
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      variant="body"
                      style={{ fontWeight: timePickerState.currentValue === item ? '600' : '400' }}
                      color={timePickerState.currentValue === item ? 'primary' : 'text'}
                    >
                      {item}
                    </Text>
                    {timePickerState.currentValue === item && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                )}
                style={{ maxHeight: 400 }}
                initialScrollIndex={TIME_OPTIONS.indexOf(timePickerState.currentValue)}
                getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
              />
            </View>
          </View>
        </Modal>
      )}
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  bubblesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    height: 8,
    borderRadius: 4,
  },
  stepIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
  },
  footerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  dayRow: {},
  timePill: {},
  previewCard: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
