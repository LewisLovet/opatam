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
  serviceCategoryRepository,
  schedulingService,
} from '@booking-app/firebase';
import { CATEGORIES, DAYS_OF_WEEK, SERVICE_CATEGORY_SUGGESTIONS } from '@booking-app/shared/constants';

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
  countryCode: string;
  locationType: 'fixed' | 'mobile';
  cityOnly: boolean;
  address: string;
  postalCode: string;
  city: string;
  geopoint: { latitude: number; longitude: number } | null;
  // Step 3 — Services (multiple)
  services: { name: string; duration: number; price: string; priceMax: string; description: string; category: string }[];
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
  locationName: 'Mon salon',
  countryCode: 'FR',
  locationType: 'fixed',
  cityOnly: false,
  address: '',
  postalCode: '',
  city: '',
  geopoint: null,
  services: [{ name: '', duration: 60, price: '', priceMax: '', description: '', category: '' }],
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
  { label: 'Prestation', icon: 'pricetag-outline' as const, subtitle: 'Ajoutez vos prestations' },
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
// Address Autocomplete (Google Places API New)
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
  if (!GOOGLE_API_KEY) return [];
  const body: Record<string, unknown> = {
    input: query,
    includedRegionCodes: [countryCode.toLowerCase()],
    includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route', 'locality'],
  };
  const response = await fetch(
    `https://places.googleapis.com/v1/places:autocomplete?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!response.ok) return [];
  const json = await response.json();
  return (json.suggestions ?? []).slice(0, limit).map((s: any) => ({
    label: s.placePrediction?.text?.text ?? '',
    name: s.placePrediction?.structuredFormat?.mainText?.text ?? s.placePrediction?.text?.text ?? '',
    city: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
    postcode: '',
    coordinates: null,
    placeId: s.placePrediction?.placeId ?? '',
  }));
}

async function fetchPlaceDetails(placeId: string): Promise<{
  city: string; postcode: string; coordinates: { latitude: number; longitude: number } | null; formattedAddress: string;
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
  return {
    city: locality?.longText ?? '',
    postcode: postalCode?.longText ?? '',
    formattedAddress: place.formattedAddress ?? '',
    coordinates: place.location ? { latitude: place.location.latitude, longitude: place.location.longitude } : null,
  };
}

// Fallback: French government API (BAN) if Google fails or no API key
async function searchAddressFallbackBAN(query: string, limit = 5, type?: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  if (type) params.set('type', type);
  try {
    const response = await fetch(`https://api-adresse.data.gouv.fr/search?${params}`);
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
      placeId: '',
    }));
  } catch {
    return [];
  }
}

const SUPPORTED_COUNTRIES = [
  { code: 'FR', label: '\u{1F1EB}\u{1F1F7} France' },
  { code: 'BE', label: '\u{1F1E7}\u{1F1EA} Belgique' },
  { code: 'LU', label: '\u{1F1F1}\u{1F1FA} Luxembourg' },
  { code: 'CH', label: '\u{1F1E8}\u{1F1ED} Suisse' },
  { code: 'DE', label: '\u{1F1E9}\u{1F1EA} Allemagne' },
  { code: 'ES', label: '\u{1F1EA}\u{1F1F8} Espagne' },
  { code: 'IT', label: '\u{1F1EE}\u{1F1F9} Italie' },
  { code: 'NL', label: '\u{1F1F3}\u{1F1F1} Pays-Bas' },
  { code: 'PT', label: '\u{1F1F5}\u{1F1F9} Portugal' },
];

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
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState('');
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);
  const [editingServiceIndex, setEditingServiceIndex] = useState(0);
  const [showLocationNameModal, setShowLocationNameModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);

  // Address autocomplete
  const [addressQuery, setAddressQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const addressDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // City autocomplete (for cityOnly mode)
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<AddressSuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  const updateFields = (fields: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...fields }));
  };

  // Address handlers (Google Places + BAN fallback for FR)
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
        let results = await searchAddress(query, data.countryCode);
        // Fallback to BAN for France if Google returns nothing
        if (results.length === 0 && data.countryCode === 'FR') {
          results = await searchAddressFallbackBAN(query);
        }
        setAddressSuggestions(results);
        setShowAddressSuggestions(results.length > 0);
      } catch {
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      } finally {
        setAddressLoading(false);
      }
    }, 300);
  }, [data.countryCode]);

  const handleAddressSelect = async (suggestion: AddressSuggestion) => {
    setAddressQuery(suggestion.name);
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);

    // If we have a placeId (Google), fetch details for city/postcode/coordinates
    if (suggestion.placeId) {
      setAddressLoading(true);
      try {
        const details = await fetchPlaceDetails(suggestion.placeId);
        if (details) {
          updateFields({
            address: details.formattedAddress,
            city: details.city,
            postalCode: details.postcode,
            geopoint: details.coordinates,
          });
          return;
        }
      } catch {
        // fall through to basic data
      } finally {
        setAddressLoading(false);
      }
    }

    // Fallback: use data from autocomplete directly (BAN or incomplete Google)
    updateFields({
      address: suggestion.label || suggestion.name,
      city: suggestion.city,
      postalCode: suggestion.postcode,
      geopoint: suggestion.coordinates,
    });
  };

  // City search (Google Places + BAN fallback for FR)
  const handleCitySearch = useCallback((query: string) => {
    setCityQuery(query);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (query.length < 2) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      setCityLoading(false);
      return;
    }
    setCityLoading(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        let results = await searchAddress(query, data.countryCode);
        // Fallback to BAN municipality search for France
        if (results.length === 0 && data.countryCode === 'FR') {
          results = await searchAddressFallbackBAN(query, 5, 'municipality');
        }
        setCitySuggestions(results);
        setShowCitySuggestions(results.length > 0);
      } catch {
        setCitySuggestions([]);
        setShowCitySuggestions(false);
      } finally {
        setCityLoading(false);
      }
    }, 300);
  }, [data.countryCode]);

  const handleCitySelect = async (suggestion: AddressSuggestion) => {
    setCityQuery(suggestion.city || suggestion.name);
    setShowCitySuggestions(false);
    setCitySuggestions([]);

    // If we have a placeId (Google), fetch details
    if (suggestion.placeId) {
      setCityLoading(true);
      try {
        const details = await fetchPlaceDetails(suggestion.placeId);
        if (details) {
          updateFields({
            city: details.city,
            postalCode: details.postcode,
            address: '',
            geopoint: details.coordinates,
          });
          return;
        }
      } catch {
        // fall through
      } finally {
        setCityLoading(false);
      }
    }

    // Fallback
    updateFields({
      city: suggestion.city || suggestion.name,
      postalCode: suggestion.postcode,
      address: '',
      geopoint: suggestion.coordinates,
    });
  };

  useEffect(() => {
    return () => {
      if (addressDebounceRef.current) clearTimeout(addressDebounceRef.current);
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
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
        if (!data.city.trim())
          return data.cityOnly
            ? 'Veuillez selectionner une ville dans les suggestions'
            : 'Veuillez selectionner une adresse dans les suggestions';
        if (!data.cityOnly && !data.postalCode.trim())
          return 'Veuillez selectionner une adresse dans les suggestions';
        return null;
      case 2:
        if (data.services.length === 0) return 'Ajoutez au moins une prestation';
        for (let i = 0; i < data.services.length; i++) {
          if (!data.services[i].name.trim()) return `Le nom de la prestation ${i + 1} est requis`;
          if (!data.services[i].price.trim() || isNaN(Number(data.services[i].price)) || Number(data.services[i].price) < 0)
            return `Le prix de la prestation ${i + 1} doit etre un nombre positif`;
        }
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
        const cleanPhone = data.phone.replace(/[\s.\-]/g, '');
        if (cleanPhone.length < 8 || !/^(\+\d{8,15}|0\d{8,10})$/.test(cleanPhone))
          return 'Numero de telephone invalide';
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
        address: data.cityOnly ? '' : data.address.trim(),
        postalCode: data.postalCode.trim(),
        city: data.city.trim(),
        country: 'France',
        countryCode: data.countryCode,
        geopoint: data.geopoint,
        description: null,
        type: data.locationType,
        travelRadius: data.locationType === 'mobile' ? 20 : null,
        photoURLs: [],
      });

      const defaultMember = await memberService.createDefaultMember(
        provider.id,
        data.displayName.trim() || data.businessName.trim(),
        data.email.trim(),
        location.id
      );

      // Create ServiceCategories
      const categoryMap = new Map<string, string>();
      const uniqueCategories = [...new Set(
        data.services.map((s) => s.category?.trim()).filter(Boolean)
      )] as string[];
      for (let i = 0; i < uniqueCategories.length; i++) {
        const catId = await serviceCategoryRepository.create(provider.id, {
          name: uniqueCategories[i],
          sortOrder: i,
          isActive: true,
        });
        categoryMap.set(uniqueCategories[i], catId);
      }

      for (let i = 0; i < data.services.length; i++) {
        const svc = data.services[i];
        const catId = svc.category?.trim() ? categoryMap.get(svc.category.trim()) || null : null;
        const priceMaxCents = svc.priceMax?.trim() ? Math.round(Number(svc.priceMax) * 100) : null;
        await serviceRepository.create(provider.id, {
          name: svc.name.trim(),
          description: svc.description.trim() || null,
          photoURL: null,
          duration: svc.duration,
          price: Math.round(Number(svc.price) * 100),
          priceMax: priceMaxCents,
          bufferTime: 0,
          categoryId: catId,
          isActive: true,
          locationIds: [location.id],
          memberIds: [defaultMember.id],
          sortOrder: i,
        });
      }

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
        label={`Description (optionnel) ${data.description.length}/500`}
        placeholder="Décrivez votre activité en quelques mots"
        value={data.description}
        onChangeText={(t) => { if (t.length <= 500) updateField('description', t); }}
        multiline
        numberOfLines={3}
      />
    </View>
  );

  const LOCATION_NAME_OPTIONS = ['Mon salon', 'Mon cabinet', 'Mon studio', 'Mon atelier', 'A domicile', 'Mon bureau', 'RDV en ligne', 'Consultation téléphonique', 'Consultation vidéo'];

  const renderStep2 = () => (
    <View style={{ gap: spacing.md }}>
      {/* Location name — dropdown style */}
      <View>
        <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
          Nom du lieu
        </Text>
        <Pressable
          onPress={() => setShowLocationNameModal(true)}
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
          <Text variant="body">{data.locationName || 'Choisir...'}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
        {!LOCATION_NAME_OPTIONS.includes(data.locationName) && data.locationName !== 'Mon salon' && (
          <Input
            placeholder="Nom personnalise du lieu"
            value={LOCATION_NAME_OPTIONS.includes(data.locationName) ? '' : data.locationName}
            onChangeText={(t) => updateField('locationName', t)}
            autoCapitalize="words"
          />
        )}
      </View>

      {/* Country — dropdown style */}
      <View>
        <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
          Pays
        </Text>
        <Pressable
          onPress={() => setShowCountryModal(true)}
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
            {SUPPORTED_COUNTRIES.find((c) => c.code === data.countryCode)?.label ?? 'France'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Location type selector */}
      <View>
        <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
          Type de lieu
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {([
            { value: 'fixed' as const, label: 'Fixe', icon: 'storefront-outline' as const },
            { value: 'mobile' as const, label: 'Mobile', icon: 'car-outline' as const },
          ]).map((opt) => {
            const isSelected = data.locationType === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  updateField('locationType', opt.value);
                  if (opt.value === 'mobile') {
                    updateField('cityOnly', true);
                  }
                }}
                style={[
                  styles.typeOption,
                  {
                    flex: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? (colors.primaryLight || '#e4effa') : colors.surface,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    fontWeight: '600',
                    marginTop: 4,
                    color: isSelected ? colors.primary : colors.text,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Address type selector (only for fixed type) */}
      {data.locationType === 'fixed' && (
        <View>
          <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
            Type de localisation
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable
              onPress={() => {
                updateField('cityOnly', false);
                setCityQuery('');
                setCitySuggestions([]);
                setShowCitySuggestions(false);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: !data.cityOnly ? colors.primary : colors.border,
                backgroundColor: !data.cityOnly ? (colors.primaryLight || '#e4effa') : colors.surface,
              }}
            >
              <Ionicons name="location-outline" size={20} color={!data.cityOnly ? colors.primary : colors.textMuted} />
              <Text variant="bodySmall" style={{ fontWeight: '600', marginTop: 4, color: !data.cityOnly ? colors.primary : colors.text }}>
                Adresse precise
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                updateField('cityOnly', true);
                updateField('address', '');
                updateField('city', '');
                updateField('postalCode', '');
                updateField('geopoint', null);
                setAddressQuery('');
                setAddressSuggestions([]);
                setShowAddressSuggestions(false);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 2,
                borderColor: data.cityOnly ? colors.primary : colors.border,
                backgroundColor: data.cityOnly ? (colors.primaryLight || '#e4effa') : colors.surface,
              }}
            >
              <Ionicons name="business-outline" size={20} color={data.cityOnly ? colors.primary : colors.textMuted} />
              <Text variant="bodySmall" style={{ fontWeight: '600', marginTop: 4, color: data.cityOnly ? colors.primary : colors.text }}>
                Ville uniquement
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Address autocomplete (only if NOT cityOnly) */}
      {!data.cityOnly && (
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
      )}

      {/* City autocomplete (cityOnly or mobile mode) */}
      {data.cityOnly && (
        <View style={{ zIndex: 10 }}>
          <Input
            label="Ville"
            placeholder="Rechercher une ville..."
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
              {citySuggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion.label + index}
                  onPress={() => handleCitySelect(suggestion)}
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
                    <Text variant="bodySmall" style={{ fontWeight: '500' }}>{suggestion.name || suggestion.city}</Text>
                    <Text variant="caption" color="textMuted">
                      {suggestion.city !== suggestion.name ? suggestion.city : ''} {suggestion.postcode}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Postal code & city — read-only, filled by API. Hide postal code in city-only mode. */}
      {(data.postalCode || data.city) && (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {!data.cityOnly && data.postalCode ? (
            <View style={{ flex: 1 }}>
              <Input
                label="Code postal"
                placeholder="—"
                value={data.postalCode}
                onChangeText={() => {}}
                disabled
                keyboardType="number-pad"
              />
            </View>
          ) : null}
          <View style={{ flex: data.cityOnly ? 1 : 2 }}>
            <Input
              label="Ville"
              placeholder="—"
              value={data.city}
              onChangeText={() => {}}
              disabled
              autoCapitalize="words"
            />
          </View>
        </View>
      )}
    </View>
  );

  const updateServiceField = (index: number, field: string, value: string | number) => {
    const updated = [...data.services];
    updated[index] = { ...updated[index], [field]: value };
    updateField('services', updated);
  };

  const addServiceEntry = () => {
    updateField('services', [...data.services, { name: '', duration: 60, price: '', priceMax: '', description: '', category: '' }]);
  };

  const removeServiceEntry = (index: number) => {
    if (data.services.length <= 1) return;
    updateField('services', data.services.filter((_: unknown, i: number) => i !== index));
  };

  const formatDurationLabel = (min: number) =>
    min >= 60
      ? `${Math.floor(min / 60)}h${min % 60 > 0 ? String(min % 60).padStart(2, '0') : ''}`
      : `${min} min`;

  const renderStep3 = () => (
    <View style={{ gap: spacing.md }}>
      {data.services.map((svc: { name: string; duration: number; price: string; priceMax: string; description: string; category: string }, index: number) => (
        <View
          key={index}
          style={{
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: 'rgba(255,255,255,0.5)',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Prestation {index + 1}
            </Text>
            {data.services.length > 1 && (
              <Pressable onPress={() => removeServiceEntry(index)} hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          <Input
            label="Nom"
            placeholder="Ex: Coupe femme"
            value={svc.name}
            onChangeText={(t: string) => updateServiceField(index, 'name', t)}
            autoCapitalize="sentences"
          />

          {/* Category (optional) */}
          {svc.category ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text variant="caption" color="textSecondary">Catégorie :</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight || '#e4effa', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 }}>
                <Text variant="bodySmall" style={{ color: colors.primary, fontWeight: '600' }}>{svc.category}</Text>
                <Pressable onPress={() => updateServiceField(index, 'category', '')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Pressable
                onPress={() => {
                  setEditingServiceIndex(index);
                  setShowCategoryPicker(true);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text variant="bodySmall" style={{ color: colors.primary, fontWeight: '600' }}>
                  Ajouter une catégorie (facultatif)
                </Text>
              </Pressable>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                Durée
              </Text>
              <Pressable
                onPress={() => {
                  setEditingServiceIndex(index);
                  setShowDurationModal(true);
                }}
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
                <Text variant="body">{formatDurationLabel(svc.duration)}</Text>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={svc.priceMax ? 'Prix min (€)' : 'Prix (€)'}
                placeholder="0"
                value={svc.price}
                onChangeText={(t: string) => updateServiceField(index, 'price', t)}
                keyboardType="decimal-pad"
              />
            </View>
            {!!svc.priceMax && (
              <View style={{ flex: 1 }}>
                <Input
                  label="Prix max (€)"
                  placeholder="0"
                  value={svc.priceMax}
                  onChangeText={(t: string) => updateServiceField(index, 'priceMax', t)}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
          </View>

          {/* Price options */}
          <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => {
                if (svc.priceMax) {
                  updateServiceField(index, 'priceMax', '');
                } else {
                  updateServiceField(index, 'priceMax', svc.price ? String(Number(svc.price) + 10) : '10');
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons
                name={svc.priceMax ? 'checkbox' : 'square-outline'}
                size={22}
                color={svc.priceMax ? colors.primary : colors.textMuted}
              />
              <Text variant="bodySmall" style={{ color: svc.priceMax ? colors.primary : colors.textSecondary, fontWeight: svc.priceMax ? '600' : '400' }}>
                Fourchette de prix
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                const isFree = !svc.price || svc.price === '0';
                updateServiceField(index, 'price', isFree ? '' : '0');
                if (!isFree) updateServiceField(index, 'priceMax', '');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons
                name={(!svc.price || svc.price === '0') && !svc.priceMax ? 'checkbox' : 'square-outline'}
                size={22}
                color={(!svc.price || svc.price === '0') && !svc.priceMax ? colors.primary : colors.textMuted}
              />
              <Text variant="bodySmall" style={{ color: (!svc.price || svc.price === '0') && !svc.priceMax ? colors.primary : colors.textSecondary }}>
                RDV gratuit
              </Text>
            </Pressable>
          </View>

          {/* Description */}
          <Input
            label="Description (optionnel)"
            placeholder="Details sur la prestation..."
            value={svc.description}
            onChangeText={(t: string) => updateServiceField(index, 'description', t)}
            multiline
            numberOfLines={2}
          />
        </View>
      ))}

      <Pressable
        onPress={addServiceEntry}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.border,
        }}
      >
        <Ionicons name="add" size={20} color={colors.textMuted} />
        <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.textMuted }}>
          Ajouter une prestation
        </Text>
      </Pressable>
    </View>
  );

  const applyPreset = (preset: 'classic' | 'morning' | 'split') => {
    const presets: Record<string, Record<number, DayAvailability>> = {
      classic: {
        0: { isOpen: false, slots: [{ start: '09:00', end: '18:00' }] },
        1: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        2: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        3: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        4: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        5: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        6: { isOpen: false, slots: [{ start: '09:00', end: '18:00' }] },
      },
      morning: {
        0: { isOpen: false, slots: [{ start: '08:00', end: '13:00' }] },
        1: { isOpen: true, slots: [{ start: '08:00', end: '13:00' }] },
        2: { isOpen: true, slots: [{ start: '08:00', end: '13:00' }] },
        3: { isOpen: true, slots: [{ start: '08:00', end: '13:00' }] },
        4: { isOpen: true, slots: [{ start: '08:00', end: '13:00' }] },
        5: { isOpen: true, slots: [{ start: '08:00', end: '13:00' }] },
        6: { isOpen: false, slots: [{ start: '08:00', end: '13:00' }] },
      },
      split: {
        0: { isOpen: false, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        1: { isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        2: { isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        3: { isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        4: { isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        5: { isOpen: true, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        6: { isOpen: false, slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
      },
    };
    updateField('availability', presets[preset]);
  };

  const renderStep4 = () => (
    <View style={{ gap: spacing.sm }}>
      {/* Quick presets */}
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm }}>
        {[
          { key: 'classic' as const, label: '9h-18h', icon: 'time-outline' as const },
          { key: 'morning' as const, label: '8h-13h', icon: 'sunny-outline' as const },
          { key: 'split' as const, label: '9h-12h / 14h-19h', icon: 'swap-horizontal-outline' as const },
        ].map((p) => (
          <Pressable
            key={p.key}
            onPress={() => applyPreset(p.key)}
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
              paddingVertical: spacing.sm, borderRadius: radius.md,
              borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.8)',
            }}
          >
            <Ionicons name={p.icon} size={14} color={colors.primary} />
            <Text variant="caption" style={{ fontWeight: '600', color: colors.primary, fontSize: 11 }}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

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
              {day.isOpen && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  {/* Copy to other days */}
                  <Pressable
                    onPress={() => {
                      setCopyFromDay(value);
                      setCopyTargetDays([]);
                    }}
                    hitSlop={8}
                    style={{ paddingHorizontal: 6, paddingVertical: 2 }}
                  >
                    <Ionicons name="copy-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                  {/* Add slot */}
                  {day.slots.length < 3 && (
                    <Pressable onPress={() => addSlot(value)} hitSlop={8}>
                      <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
              )}
            </View>
            {day.isOpen && day.slots.map((slot, si) => (
              <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs, paddingLeft: 52 }}>
                <Pressable
                  onPress={() => setTimePickerState({ visible: true, dayValue: value, slotIndex: si, field: 'start', currentValue: slot.start })}
                  style={{ backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text variant="body" color="primary" style={{ fontWeight: '700', fontSize: 15 }}>{slot.start}</Text>
                  <Ionicons name="pencil" size={11} color={colors.primary} />
                </Pressable>
                <Text variant="bodySmall" color="textMuted" style={{ fontWeight: '500' }}>à</Text>
                <Pressable
                  onPress={() => setTimePickerState({ visible: true, dayValue: value, slotIndex: si, field: 'end', currentValue: slot.end })}
                  style={{ backgroundColor: colors.primaryLight, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.15)', flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text variant="body" color="primary" style={{ fontWeight: '700', fontSize: 15 }}>{slot.end}</Text>
                  <Ionicons name="pencil" size={11} color={colors.primary} />
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
            {data.locationType === 'mobile' ? 'Mobile' : 'Fixe'}{data.cityOnly ? ' — ville uniquement' : ''}
          </Text>
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
          <Text variant="body" style={{ fontWeight: '500' }}>
            {data.services.length} prestation{data.services.length > 1 ? 's' : ''}
          </Text>
          {data.services.map((svc: { name: string; duration: number; price: string; priceMax: string; category: string }, i: number) => (
            <Text key={i} variant="bodySmall" color="textSecondary">
              {svc.name || '—'} • {svc.duration} min • {svc.priceMax ? `${Number(svc.price || 0).toFixed(2)} – ${Number(svc.priceMax).toFixed(2)} €` : `${Number(svc.price || 0).toFixed(2)} €`}{svc.category ? ` • ${svc.category}` : ''}
            </Text>
          ))}
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
                      updateServiceField(editingServiceIndex, 'duration', item);
                      setShowDurationModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.listItem,
                      {
                        padding: spacing.md,
                        paddingHorizontal: spacing.lg,
                        backgroundColor: data.services[editingServiceIndex]?.duration === item
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
                      color={data.services[editingServiceIndex]?.duration === item ? colors.primary : colors.textMuted}
                    />
                    <Text
                      variant="body"
                      style={{ flex: 1, marginLeft: spacing.sm, fontWeight: data.services[editingServiceIndex]?.duration === item ? '600' : '400' }}
                      color={data.services[editingServiceIndex]?.duration === item ? 'primary' : 'text'}
                    >
                      {label}
                    </Text>
                    {data.services[editingServiceIndex]?.duration === item && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Service Category Picker Modal ── */}
      <Modal visible={showCategoryPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '60%' }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Catégorie de prestation</Text>
              <Pressable onPress={() => { setShowCategoryPicker(false); setCustomCategoryText(''); }}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              {/* Already used categories */}
              {[...new Set(data.services.map((s) => s.category?.trim()).filter(Boolean))].map((cat) => (
                <Pressable
                  key={`used-${cat}`}
                  onPress={() => {
                    updateServiceField(editingServiceIndex, 'category', cat!);
                    setShowCategoryPicker(false);
                    setCustomCategoryText('');
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
                    gap: spacing.sm,
                  })}
                >
                  <Ionicons name="pricetag" size={18} color={colors.primary} />
                  <Text variant="body" style={{ flex: 1, fontWeight: '500' }}>{cat}</Text>
                </Pressable>
              ))}

              {/* Divider */}
              {data.services.some((s) => s.category?.trim()) && (
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />
              )}

              {/* Suggestions based on activity */}
              {(SERVICE_CATEGORY_SUGGESTIONS[data.category] || [])
                .filter((s) => !data.services.some((sv) => sv.category?.trim() === s))
                .map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    onPress={() => {
                      updateServiceField(editingServiceIndex, 'category', suggestion);
                      setShowCategoryPicker(false);
                      setCustomCategoryText('');
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.sm,
                      borderRadius: radius.md,
                      backgroundColor: pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
                      gap: spacing.sm,
                    })}
                  >
                    <Ionicons name="pricetag-outline" size={18} color={colors.textMuted} />
                    <Text variant="body" style={{ flex: 1 }}>{suggestion}</Text>
                  </Pressable>
                ))}

              {/* Custom category */}
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm, marginBottom: spacing.xs }}>
                Ou entrez un nom personnalisé :
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label=""
                    placeholder="Autre catégorie..."
                    value={customCategoryText}
                    onChangeText={setCustomCategoryText}
                    autoCapitalize="sentences"
                  />
                </View>
                <Pressable
                  onPress={() => {
                    if (customCategoryText.trim()) {
                      updateServiceField(editingServiceIndex, 'category', customCategoryText.trim());
                      setShowCategoryPicker(false);
                      setCustomCategoryText('');
                    }
                  }}
                  style={{
                    backgroundColor: colors.primary,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.lg,
                    justifyContent: 'center',
                    opacity: customCategoryText.trim() ? 1 : 0.4,
                  }}
                >
                  <Text variant="bodySmall" style={{ color: '#FFF', fontWeight: '600' }}>OK</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Copy Schedule Modal ── */}
      <Modal visible={copyFromDay !== null} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCopyFromDay(null)}
        >
          <Pressable
            style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, width: '85%', maxWidth: 340 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="h3" style={{ marginBottom: 4 }}>Copier vers</Text>
            <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.md }}>
              Copier les horaires de {copyFromDay !== null ? SCHEDULE_DAYS.find((d) => d.value === copyFromDay)?.label : ''} vers :
            </Text>

            {SCHEDULE_DAYS.filter((d) => d.value !== copyFromDay).map((d) => {
              const isChecked = copyTargetDays.includes(d.value);
              return (
                <Pressable
                  key={d.value}
                  onPress={() => setCopyTargetDays((prev) => isChecked ? prev.filter((v) => v !== d.value) : [...prev, d.value])}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 }}
                >
                  <View style={{
                    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                    borderColor: isChecked ? colors.primary : colors.border,
                    backgroundColor: isChecked ? colors.primary : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isChecked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text variant="body">{d.label}</Text>
                </Pressable>
              );
            })}

            {/* Quick select */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md }}>
              <Pressable
                onPress={() => setCopyTargetDays(SCHEDULE_DAYS.filter((d) => d.value !== copyFromDay && d.value >= 1 && d.value <= 5).map((d) => d.value))}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryLight || '#e4effa' }}
              >
                <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Lun – Ven</Text>
              </Pressable>
              <Pressable
                onPress={() => setCopyTargetDays(SCHEDULE_DAYS.filter((d) => d.value !== copyFromDay).map((d) => d.value))}
                style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primaryLight || '#e4effa' }}
              >
                <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>Tous</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setCopyFromDay(null)}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text variant="body" style={{ fontWeight: '500' }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (copyFromDay === null || copyTargetDays.length === 0) return;
                  const sourceDay = data.availability[copyFromDay];
                  if (!sourceDay) return;
                  const updated = { ...data.availability };
                  copyTargetDays.forEach((dv) => {
                    updated[dv] = { isOpen: true, slots: [...sourceDay.slots] };
                  });
                  updateField('availability', updated);
                  setCopyFromDay(null);
                  setCopyTargetDays([]);
                }}
                disabled={copyTargetDays.length === 0}
                style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', opacity: copyTargetDays.length === 0 ? 0.4 : 1 }}
              >
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Copier</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Location Name Modal ── */}
      <Modal visible={showLocationNameModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Nom du lieu</Text>
              <Pressable onPress={() => setShowLocationNameModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <FlatList
              data={[...LOCATION_NAME_OPTIONS, '_other']}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const label = item === '_other' ? 'Autre...' : item;
                const isSelected = item === '_other'
                  ? !LOCATION_NAME_OPTIONS.includes(data.locationName)
                  : data.locationName === item;
                return (
                  <Pressable
                    onPress={() => {
                      updateField('locationName', item === '_other' ? '' : item);
                      setShowLocationNameModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.listItem,
                      {
                        padding: spacing.md,
                        paddingHorizontal: spacing.lg,
                        backgroundColor: isSelected ? colors.primaryLight : pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
                      },
                    ]}
                  >
                    <Ionicons
                      name={item === '_other' ? 'create-outline' : 'business-outline'}
                      size={20}
                      color={isSelected ? colors.primary : colors.textMuted}
                    />
                    <Text
                      variant="body"
                      style={{ flex: 1, marginLeft: spacing.sm, fontWeight: isSelected ? '600' : '400' }}
                      color={isSelected ? 'primary' : 'text'}
                    >
                      {label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Country Modal ── */}
      <Modal visible={showCountryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: '#FFFFFF', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Pays</Text>
              <Pressable onPress={() => setShowCountryModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <FlatList
              data={SUPPORTED_COUNTRIES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = data.countryCode === item.code;
                return (
                  <Pressable
                    onPress={() => {
                      updateField('countryCode', item.code);
                      updateField('address', '');
                      updateField('city', '');
                      updateField('postalCode', '');
                      updateField('geopoint', null);
                      setAddressQuery('');
                      setCityQuery('');
                      setShowCountryModal(false);
                    }}
                    style={({ pressed }) => [
                      styles.listItem,
                      {
                        padding: spacing.md,
                        paddingHorizontal: spacing.lg,
                        backgroundColor: isSelected ? colors.primaryLight : pressed ? 'rgba(0,0,0,0.03)' : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      variant="body"
                      style={{ flex: 1, fontWeight: isSelected ? '600' : '400' }}
                      color={isSelected ? 'primary' : 'text'}
                    >
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
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
  typeOption: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1.5,
  },
});
