'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  MapPin,
  Tag,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Phone,
  Plus,
  X,
} from 'lucide-react';
import { Button, Input, Checkbox, GoogleAddressAutocomplete, type GoogleAddressSuggestion, CountrySelect } from '@/components/ui';
import { StepIndicator } from '@/components/common/StepIndicator';
import {
  authService,
  providerService,
  locationService,
  serviceRepository,
  serviceCategoryRepository,
  schedulingService,
  memberService,
} from '@booking-app/firebase';
import { CATEGORIES, DAYS_OF_WEEK, getCountryLabel, SERVICE_CATEGORY_SUGGESTIONS, getServiceMinPrice, getServiceMinDuration } from '@booking-app/shared';
import type { ServiceVariation, ServiceOption, ServiceInfoField } from '@booking-app/shared';
import { RegisterLivePreview, type RegisterPreviewData } from './LivePreview';
import { trackEvent } from '@/lib/meta-pixel';
import { VariationsListEditor } from '@/app/pro/activite/prestations/components/VariationsListEditor';
import { OptionsListEditor } from '@/app/pro/activite/prestations/components/OptionsListEditor';
import { InfoFieldsListEditor } from '@/app/pro/activite/prestations/components/InfoFieldsListEditor';
import { sanitizeVariations, sanitizeOptions, sanitizeInfoFields } from '@/app/pro/activite/prestations/components/choiceHelpers';

// Storage key for localStorage
const STORAGE_KEY = 'opatam-register-wizard';


// Step definitions
const STEPS = [
  { label: 'Activité' },
  { label: 'Lieu' },
  { label: 'Prestation' },
  { label: 'Horaires' },
  { label: 'Aperçu' },
  { label: 'Compte' },
];

// Time slot interface for multiple slots per day
interface TimeSlot {
  start: string;
  end: string;
}

// Day availability with multiple slots
interface DayAvailability {
  isOpen: boolean;
  slots: TimeSlot[];
}

// Wizard data interface
interface WizardData {
  // Step 1 - Business
  businessName: string;
  category: string;
  description: string;
  // Step 2 - Location
  locationName: string;
  countryCode: string;
  cityOnly: boolean;
  address: string;
  postalCode: string;
  city: string;
  geopoint: { latitude: number; longitude: number } | null;
  region: string | null;
  // Step 3 - Services (multiple)
  services: {
    name: string;
    duration: number;
    price: number;
    priceMax: number | null;
    description: string;
    category: string;
    variations: ServiceVariation[];
    options: ServiceOption[];
    infoFields: ServiceInfoField[];
  }[];
  // Step 4 - Availability (supports multiple slots per day)
  availability: {
    [key: number]: DayAvailability;
  };
  // Step 6 - Account
  displayName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
  // Affiliation
  referralCode: string;
  referralInfo: { valid: boolean; affiliateId: string; affiliateName: string; discount: number | null; discountLabel: string | null } | null;
}

const DEFAULT_AVAILABILITY: { [key: number]: DayAvailability } = {
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
  cityOnly: false,
  address: '',
  postalCode: '',
  city: '',
  geopoint: null,
  region: null,
  services: [{ name: '', duration: 60, price: 0, priceMax: null as number | null, description: '', category: '', variations: [], options: [], infoFields: [] }],
  availability: DEFAULT_AVAILABILITY,
  displayName: '',
  email: '',
  confirmEmail: '',
  phone: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
  referralCode: '',
  referralInfo: null,
};

// Error message helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Un compte existe déjà avec cet email';
      case 'auth/invalid-email':
        return 'Adresse email invalide';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caractères';
      default:
        return error.message || 'Une erreur est survenue';
    }
  }
  return 'Une erreur est survenue';
}


export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);

  // Fire a `Lead` event on first mount — Meta uses this to model
  // the top-of-funnel pool for ad audiences. The pixel itself is
  // gated on consent, so calling here is safe even if the user
  // hasn't accepted yet (the helper no-ops).
  useEffect(() => {
    trackEvent('Lead', { content_name: 'register-wizard' });
  }, []);

  // Read ?ref= from URL and verify the code
  useEffect(() => {
    const ref = searchParams.get('ref')?.toUpperCase().trim();
    if (ref && !data.referralCode) {
      updateData({ referralCode: ref });
      fetch(`/api/affiliates/verify?code=${ref}`)
        .then((res) => res.json())
        .then((info) => {
          if (info.valid) {
            updateData({ referralInfo: info });
            // Track link click
            fetch('/api/affiliates/track-click', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: ref }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Lightweight payload for the live page preview (right panel on desktop,
  // modal on mobile). Recomputed from the wizard data only.
  const previewData = useMemo<RegisterPreviewData>(
    () => ({
      businessName: data.businessName,
      category: data.category,
      categoryLabel: CATEGORIES.find((c) => c.id === data.category)?.label ?? '',
      description: data.description,
      city: data.city,
      address: data.address,
      cityOnly: data.cityOnly,
      services: data.services.map((s) => {
        // Reflect variations in the preview: when a prestation has variations
        // the price/duration is defined by them ("à partir de …"); otherwise
        // it's the fixed base price. Base is in euros, variations in cents —
        // normalise to cents for getServiceMinPrice, then back to euros.
        const variable = (s.variations?.length ?? 0) > 0;
        const priceFromCents = getServiceMinPrice({
          price: s.price * 100,
          variations: s.variations ?? [],
        });
        const durationFrom = getServiceMinDuration({
          duration: s.duration,
          variations: s.variations ?? [],
        });
        return {
          name: s.name,
          priceFrom: priceFromCents / 100,
          durationFrom,
          variable,
        };
      }),
      openDays: Object.entries(data.availability)
        .filter(([, v]) => (v as DayAvailability).isOpen)
        .map(([k]) => parseInt(k, 10)),
    }),
    [data],
  );

  // Migrate old availability format to new slots format
  const migrateAvailability = (availability: Record<number, unknown>): { [key: number]: DayAvailability } => {
    const migrated: { [key: number]: DayAvailability } = {};
    for (let day = 0; day <= 6; day++) {
      const dayData = availability[day];
      if (!dayData || typeof dayData !== 'object') {
        // Missing day data, use default
        migrated[day] = DEFAULT_AVAILABILITY[day];
      } else {
        const d = dayData as Record<string, unknown>;
        // Check if it's old format (has start/end but no slots)
        if ('start' in d && 'end' in d && !('slots' in d)) {
          migrated[day] = {
            isOpen: d.isOpen as boolean ?? true,
            slots: [{ start: d.start as string, end: d.end as string }],
          };
        } else if ('slots' in d && Array.isArray(d.slots)) {
          // New format, keep as is
          migrated[day] = {
            isOpen: d.isOpen as boolean ?? true,
            slots: d.slots.length > 0 ? d.slots : [{ start: '09:00', end: '18:00' }],
          };
        } else {
          // Unknown format, use default
          migrated[day] = DEFAULT_AVAILABILITY[day];
        }
      }
    }
    return migrated;
  };

  // Load data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loadedData = { ...DEFAULT_DATA, ...parsed.data };
        // Migrate availability if needed
        if (loadedData.availability) {
          loadedData.availability = migrateAvailability(loadedData.availability);
        }
        setData(loadedData);
        if (parsed.step) {
          setCurrentStep(parsed.step);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save data to localStorage and sessionStorage (for layout)
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, step: currentStep }));
    sessionStorage.setItem('register-step', String(currentStep));
    // Dispatch events for the layout right-panel (step + live preview data).
    window.dispatchEvent(new CustomEvent('register-step-change', { detail: currentStep }));
    window.dispatchEvent(new CustomEvent('register-data-change', { detail: previewData }));
  }, [data, currentStep, previewData]);

  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const validateStep = (step: number): boolean => {
    setError('');
    switch (step) {
      case 1:
        if (!data.businessName.trim()) {
          setError('Veuillez entrer le nom de votre activité');
          return false;
        }
        if (!data.category) {
          setError('Veuillez sélectionner une catégorie');
          return false;
        }
        return true;
      case 2:
        if (!data.locationName.trim()) {
          setError('Veuillez entrer le nom du lieu');
          return false;
        }
        if (data.cityOnly) {
          if (!data.city.trim()) {
            setError('Veuillez sélectionner une ville dans la liste');
            return false;
          }
        } else {
          if (!data.address.trim()) {
            setError("Veuillez entrer l'adresse");
            return false;
          }
          if (!data.geopoint) {
            setError('Veuillez sélectionner une adresse dans la liste');
            return false;
          }
          if (!data.postalCode.trim()) {
            setError('Veuillez entrer le code postal');
            return false;
          }
          if (!data.city.trim()) {
            setError('Veuillez entrer la ville');
            return false;
          }
        }
        return true;
      case 3:
        if (data.services.length === 0) {
          setError('Ajoutez au moins une prestation');
          return false;
        }
        for (let i = 0; i < data.services.length; i++) {
          if (!data.services[i].name.trim()) {
            setError(`Veuillez entrer le nom de la prestation ${i + 1}`);
            return false;
          }
          if (data.services[i].price < 0) {
            setError(`Le prix de la prestation ${i + 1} ne peut pas être négatif`);
            return false;
          }
          if (data.services[i].priceMax !== null && data.services[i].priceMax! <= data.services[i].price) {
            setError(`Le prix max de la prestation ${i + 1} doit être supérieur au prix min`);
            return false;
          }
        }
        return true;
      case 4:
        const hasOpenDay = Object.values(data.availability).some((day) => day.isOpen);
        if (!hasOpenDay) {
          setError("Veuillez sélectionner au moins un jour d'ouverture");
          return false;
        }
        return true;
      case 5:
        return true;
      case 6:
        if (!data.displayName.trim()) {
          setError('Veuillez entrer votre nom');
          return false;
        }
        if (!data.email.trim()) {
          setError('Veuillez entrer votre email');
          return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          setError('Adresse email invalide');
          return false;
        }
        if (data.email.trim().toLowerCase() !== data.confirmEmail.trim().toLowerCase()) {
          setError('Les adresses email ne correspondent pas');
          return false;
        }
        if (!data.phone.trim()) {
          setError('Veuillez entrer votre numéro de téléphone');
          return false;
        }
        // Accept international formats: +XX..., 0X...
        const cleanPhone = data.phone.replace(/[\s.\-]/g, '');
        if (cleanPhone.length < 8 || !/^(\+\d{8,15}|0\d{8,10})$/.test(cleanPhone)) {
          setError('Numero de telephone invalide');
          return false;
        }
        if (!data.password || data.password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères');
          return false;
        }
        if (data.password !== data.confirmPassword) {
          setError('Les mots de passe ne correspondent pas');
          return false;
        }
        if (!data.acceptTerms) {
          setError("Veuillez accepter les conditions d'utilisation");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const changeStep = (newStep: number, direction: 'left' | 'right') => {
    setSlideDirection(direction);
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(newStep);
      setIsAnimating(false);
    }, 150);
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      changeStep(Math.min(currentStep + 1, 6), 'right');
    }
  };

  const handleBack = () => {
    setError('');
    changeStep(Math.max(currentStep - 1, 1), 'left');
  };

  const createProviderWithData = async (userId: string) => {
    // Create Provider
    const provider = await providerService.createProvider(userId, {
      businessName: data.businessName,
      category: data.category,
      description: data.description,
    });

    // If referral code, link affiliate to provider + increment stats
    if (data.referralInfo?.valid && data.referralInfo.affiliateId) {
      await providerService.updateProvider(provider.id, {
        affiliateCode: data.referralCode,
        affiliateId: data.referralInfo.affiliateId,
      } as any);

      // Increment affiliate trialReferrals
      fetch('/api/affiliates/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.referralCode, providerId: provider.id }),
      }).catch(() => {});
    }

    // Create Location (via service for validation + provider cities update)
    const location = await locationService.createLocation(provider.id, {
      name: data.locationName,
      address: data.cityOnly ? '' : data.address,
      postalCode: data.postalCode,
      city: data.city,
      country: getCountryLabel(data.countryCode),
      countryCode: data.countryCode,
      geopoint: data.cityOnly ? null : data.geopoint,
      description: null,
      type: 'fixed',
      travelRadius: null,
      photoURLs: [],
      region: data.region,
    });
    const locationId = location.id;

    // Create default member (represents the provider owner)
    // NOUVEAU MODÈLE: 1 membre = 1 lieu = 1 agenda
    const defaultMember = await memberService.createDefaultMember(
      provider.id,
      data.displayName || data.businessName,
      data.email,
      locationId
    );

    // Create ServiceCategories from unique category names
    const categoryMap = new Map<string, string>(); // name → id
    const uniqueCategories = [...new Set(
      data.services.map((s) => s.category?.trim()).filter(Boolean)
    )] as string[];

    for (let i = 0; i < uniqueCategories.length; i++) {
      const catName = uniqueCategories[i];
      const catId = await serviceCategoryRepository.create(provider.id, {
        name: catName,
        sortOrder: i,
        isActive: true,
      });
      categoryMap.set(catName, catId);
    }

    // Create Services
    for (let i = 0; i < data.services.length; i++) {
      const svc = data.services[i];
      const categoryId = svc.category?.trim()
        ? categoryMap.get(svc.category.trim()) || null
        : null;
      await serviceRepository.create(provider.id, {
        name: svc.name,
        description: svc.description || null,
        photoURL: null,
        duration: svc.duration,
        price: svc.price * 100, // Convert to cents
        priceMax: svc.priceMax ? svc.priceMax * 100 : null,
        bufferTime: 0,
        categoryId,
        isActive: true,
        locationIds: [locationId],
        memberIds: [defaultMember.id],
        sortOrder: i,
        variations: sanitizeVariations(svc.variations ?? []),
        options: sanitizeOptions(svc.options ?? []),
        infoFields: sanitizeInfoFields(svc.infoFields ?? []),
      });
    }

    // Create Availability for the default member
    // Supports multiple slots per day (ex: 8h-12h, 14h-19h)
    const schedule = Object.entries(data.availability).map(([dayOfWeek, dayData]) => ({
      dayOfWeek: parseInt(dayOfWeek),
      isOpen: dayData.isOpen,
      slots: dayData.isOpen ? dayData.slots : [],
    }));

    await schedulingService.setWeeklySchedule(provider.id, defaultMember.id, locationId, schedule);

    return provider;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(6)) return;

    setLoading(true);
    setError('');

    try {
      const { user } = await authService.registerProvider({
        email: data.email,
        password: data.password,
        confirmPassword: data.confirmPassword,
        displayName: data.displayName,
        phone: data.phone,
      });

      await createProviderWithData(user.id);

      // Send welcome email (fire-and-forget)
      fetch('/api/auth/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          displayName: data.displayName,
          businessName: data.businessName,
        }),
      }).catch(() => {});

      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('register-step');

      // Pixel: signal a completed registration. The `content_category`
      // helps differentiate this from any future B2C registration
      // event we might add. Meta uses this as the main top-of-funnel
      // conversion for ad optimisation.
      trackEvent('CompleteRegistration', {
        content_category: 'pro',
      });

      // Auto-login: the user is already signed in from registerProvider — we
      // DON'T log them out anymore. A hard navigation re-initialises the auth
      // context from scratch so the freshly-created provider doc (providerId
      // now set in Firestore) is loaded and the /pro route guard passes. The
      // `?welcome=1` lets the dashboard show a celebratory first-run state.
      window.location.assign('/pro?welcome=1');
    } catch (err) {
      console.error('[Register] ERROR:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 1 - Business Info
  const renderStep1 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-3">
          <Building2 className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Parlez-nous de votre activité
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Ces informations apparaîtront sur votre page publique
        </p>
      </div>

      <Input
        label="Nom de l'entreprise / activité"
        placeholder="Ex: Salon Marie Coiffure"
        value={data.businessName}
        onChange={(e) => updateData({ businessName: e.target.value })}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Catégorie
        </label>
        <select
          value={data.category}
          onChange={(e) => updateData({ category: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Sélectionnez une catégorie</option>
          {CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Description courte (optionnel)
        </label>
        <textarea
          value={data.description}
          onChange={(e) => updateData({ description: e.target.value.slice(0, 500) })}
          placeholder="Décrivez votre activité en quelques mots..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">{data.description.length}/500</p>
      </div>

      {/* Referral code */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Code parrain (facultatif)
        </label>
        <div className="flex gap-2">
          <Input
            placeholder="Ex: MARIE"
            value={data.referralCode}
            onChange={(e) => {
              const code = e.target.value.toUpperCase();
              updateData({ referralCode: code, referralInfo: null });
            }}
            className="uppercase"
          />
          {data.referralCode && !data.referralInfo && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/affiliates/verify?code=${data.referralCode}`);
                  const info = await res.json();
                  updateData({ referralInfo: info.valid ? info : null });
                  if (!info.valid) {
                    setError('Code parrain invalide');
                    setTimeout(() => setError(''), 3000);
                  }
                } catch {}
              }}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              Vérifier
            </button>
          )}
        </div>
        {data.referralInfo && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Code <span className="font-semibold">{data.referralCode}</span> validé
              {data.referralInfo.discountLabel && ` — ${data.referralInfo.discountLabel}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Step 2 - Location
  const renderStep2 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-3">
          <MapPin className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Ou exercez-vous ?
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Ajoutez l'adresse de votre etablissement
        </p>
      </div>

      {/* Location name — dropdown with common options + custom */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Nom du lieu
        </label>
        <select
          value={['Mon salon', 'Mon cabinet', 'Mon studio', 'Mon atelier', 'A domicile', 'Mon bureau', 'RDV en ligne', 'Consultation téléphonique', 'Consultation vidéo'].includes(data.locationName) ? data.locationName : '_other'}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '_other') {
              updateData({ locationName: '' });
            } else {
              updateData({ locationName: val });
            }
          }}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none cursor-pointer"
        >
          <option value="Mon salon">Mon salon</option>
          <option value="Mon cabinet">Mon cabinet</option>
          <option value="Mon studio">Mon studio</option>
          <option value="Mon atelier">Mon atelier</option>
          <option value="A domicile">A domicile</option>
          <option value="Mon bureau">Mon bureau</option>
          <option value="RDV en ligne">RDV en ligne</option>
          <option value="Consultation téléphonique">Consultation téléphonique</option>
          <option value="Consultation vidéo">Consultation vidéo</option>
          <option value="_other">Autre...</option>
        </select>
        {!['Mon salon', 'Mon cabinet', 'Mon studio', 'Mon atelier', 'A domicile', 'Mon bureau', 'RDV en ligne', 'Consultation téléphonique', 'Consultation vidéo'].includes(data.locationName) && (
          <Input
            placeholder="Nom personnalise du lieu"
            value={data.locationName}
            onChange={(e) => updateData({ locationName: e.target.value })}
            className="mt-2"
          />
        )}
      </div>

      <CountrySelect
        value={data.countryCode}
        onChange={(code) => updateData({
          countryCode: code,
          address: '',
          postalCode: '',
          city: '',
          geopoint: null,
          region: null,
        })}
      />

      {/* Address type selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type de localisation
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateData({ cityOnly: false })}
            className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              !data.cityOnly
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span>Adresse precise</span>
          </button>
          <button
            type="button"
            onClick={() => {
              updateData({
                cityOnly: true,
                address: '',
                geopoint: null,
                postalCode: '',
                city: '',
                region: null,
              });
            }}
            className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              data.cityOnly
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <span>Ville uniquement</span>
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          {data.cityOnly
            ? 'Seule votre ville sera visible par les clients'
            : 'Votre adresse complete sera visible par les clients'}
        </p>
      </div>

      {!data.cityOnly ? (
        <GoogleAddressAutocomplete
          label="Adresse"
          value={data.address}
          onChange={(value) => updateData({ address: value, postalCode: '', city: '', geopoint: null, region: null })}
          onSelect={(suggestion: GoogleAddressSuggestion) => {
            updateData({
              address: suggestion.formattedAddress,
              postalCode: suggestion.postalCode ?? '',
              city: suggestion.locality ?? '',
              geopoint: suggestion.coordinates,
              region: suggestion.adminArea1,
            });
          }}
          countries={[data.countryCode.toLowerCase()]}
          placeholder={`Rechercher une adresse...`}
          hint={!data.geopoint ? 'Selectionnez une adresse dans la liste' : undefined}
          required
        />
      ) : (
        <GoogleAddressAutocomplete
          label="Ville"
          value={data.city}
          onChange={(value) => updateData({ city: value, postalCode: '', geopoint: null, region: null })}
          onSelect={(suggestion: GoogleAddressSuggestion) => {
            updateData({
              city: suggestion.locality ?? '',
              postalCode: suggestion.postalCode ?? '',
              geopoint: suggestion.coordinates,
              region: suggestion.adminArea1,
            });
          }}
          countries={[data.countryCode.toLowerCase()]}
          placeholder="Rechercher une ville..."
          required
        />
      )}

      <div className={`grid gap-3 ${data.cityOnly ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {!data.cityOnly && (
          <Input
            label="Code postal"
            placeholder="75001"
            value={data.postalCode}
            readOnly
            className="bg-gray-50 dark:bg-gray-900 cursor-default"
          />
        )}
        <Input
          label="Ville"
          placeholder="Paris"
          value={data.city}
          readOnly
          className="bg-gray-50 dark:bg-gray-900 cursor-default"
        />
      </div>
    </div>
  );

  // Step 3 - Service
  const updateService = (index: number, field: string, value: string | number | null | ServiceVariation[] | ServiceOption[] | ServiceInfoField[]) => {
    const updated = [...data.services];
    updated[index] = { ...updated[index], [field]: value };
    updateData({ services: updated });
  };

  const addService = () => {
    updateData({ services: [...data.services, { name: '', duration: 60, price: 0, priceMax: null as number | null, description: '', category: '', variations: [], options: [], infoFields: [] }] });
  };

  const removeService = (index: number) => {
    if (data.services.length <= 1) return;
    updateData({ services: data.services.filter((_, i) => i !== index) });
  };

  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-3">
          <Tag className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Ajoutez vos prestations
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Vous pourrez en ajouter ou modifier plus tard
        </p>
      </div>

      {data.services.map((svc, index) => (
        <div key={index} className="relative p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
          {/* Header with number and delete */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Prestation {index + 1}
            </span>
            {data.services.length > 1 && (
              <button
                type="button"
                onClick={() => removeService(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Input
            label="Nom"
            placeholder="Ex: Coupe femme, Massage relaxant..."
            value={svc.name}
            onChange={(e) => updateService(index, 'name', e.target.value)}
          />

          {/* Category (optional) */}
          {svc.category ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Catégorie :</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
                {svc.category}
                <button
                  type="button"
                  onClick={() => updateService(index, 'category', '')}
                  className="ml-0.5 hover:text-primary-900"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  const btn = e.currentTarget;
                  const dropdown = btn.nextElementSibling as HTMLElement;
                  if (dropdown) dropdown.classList.toggle('hidden');
                }}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une catégorie (facultatif)
              </button>
              <div className="hidden absolute z-10 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                {/* Suggestions from already-used categories in this form */}
                {[...new Set(data.services.map((s) => s.category?.trim()).filter(Boolean))].map((cat) => (
                  <button
                    key={`used-${cat}`}
                    type="button"
                    onClick={(e) => {
                      updateService(index, 'category', cat!);
                      (e.currentTarget.closest('.relative')?.querySelector('.hidden') as HTMLElement)?.classList.add('hidden');
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {cat}
                  </button>
                ))}
                {/* Divider if there are used categories */}
                {data.services.some((s) => s.category?.trim()) && (
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                )}
                {/* Suggestions based on provider activity */}
                {(SERVICE_CATEGORY_SUGGESTIONS[data.category] || [])
                  .filter((s) => !data.services.some((sv) => sv.category?.trim() === s))
                  .map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={(e) => {
                        updateService(index, 'category', suggestion);
                        (e.currentTarget.closest('.relative')?.querySelector('.hidden') as HTMLElement)?.classList.add('hidden');
                      }}
                      className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {suggestion}
                    </button>
                  ))}
                {/* Custom option */}
                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                <div className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="Autre catégorie..."
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        e.preventDefault();
                        updateService(index, 'category', (e.target as HTMLInputElement).value.trim());
                        (e.currentTarget.closest('.relative')?.querySelector('.hidden') as HTMLElement)?.classList.add('hidden');
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 grid-cols-2">
            <Input
              label="Durée (min)"
              placeholder="60"
              numericValue={svc.duration ?? 0}
              onNumericChange={(d) => updateService(index, 'duration', Math.round(d))}
              min={5}
              max={480}
            />
            <Input
              label="Prix (€)"
              placeholder="0"
              numericValue={svc.price ?? 0}
              onNumericChange={(p) => updateService(index, 'price', p)}
              decimal
              min={0}
            />
          </div>

          {/* Price options — fixed price or free. Variable pricing is handled
              by variations below (the price range was removed). */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!svc.price || svc.price === 0}
                onChange={(e) => updateService(index, 'price', e.target.checked ? 0 : '')}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`text-sm ${!svc.price || svc.price === 0 ? 'text-primary-600 font-medium' : 'text-gray-500'}`}>
                RDV gratuit
              </span>
            </label>
            <span className="text-xs text-gray-400">
              Prix variable ? Ajoutez des variations ci-dessous.
            </span>
          </div>

          {/* Description */}
          <textarea
            value={svc.description}
            onChange={(e) => updateService(index, 'description', e.target.value)}
            placeholder="Details sur la prestation (optionnel)"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />

          {/* Variations / Options / Info fields (optional, collapsed) */}
          <details className="mt-3 group">
            <summary className="cursor-pointer select-none text-sm font-medium text-primary-600 dark:text-primary-400 list-none flex items-center gap-1.5">
              <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" />
              Variations &amp; options (optionnel)
            </summary>
            <div className="mt-3 space-y-5 pl-1">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Variations : un choix obligatoire qui définit le prix/la durée (ex : Longueur). Si vous en ajoutez, le prix de base ci-dessus est ignoré au profit des variations.</p>
                <VariationsListEditor variations={svc.variations ?? []} onChange={(next) => updateService(index, 'variations', next)} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Options : suppléments facultatifs qui s'ajoutent au prix (ex : Mèches).</p>
                <OptionsListEditor options={svc.options ?? []} onChange={(next) => updateService(index, 'options', next)} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Informations à demander au client (texte, oui/non, liste) — sans impact sur le prix.</p>
                <InfoFieldsListEditor fields={svc.infoFields ?? []} onChange={(next) => updateService(index, 'infoFields', next)} />
              </div>
            </div>
          </details>
        </div>
      ))}

      {/* Add service button */}
      <button
        type="button"
        onClick={addService}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Ajouter une prestation
      </button>
    </div>
  );

  // Helper functions for availability management
  const addSlotToDay = (dayValue: number) => {
    const dayData = data.availability[dayValue];
    const lastSlot = dayData.slots[dayData.slots.length - 1];
    // Default new slot starts 1 hour after last slot ends
    const newStart = lastSlot?.end || '14:00';
    const newEnd = '19:00';
    updateData({
      availability: {
        ...data.availability,
        [dayValue]: {
          ...dayData,
          slots: [...dayData.slots, { start: newStart, end: newEnd }],
        },
      },
    });
  };

  const removeSlotFromDay = (dayValue: number, slotIndex: number) => {
    const dayData = data.availability[dayValue];
    if (dayData.slots.length <= 1) return; // Keep at least one slot
    updateData({
      availability: {
        ...data.availability,
        [dayValue]: {
          ...dayData,
          slots: dayData.slots.filter((_, i) => i !== slotIndex),
        },
      },
    });
  };

  const updateSlot = (dayValue: number, slotIndex: number, field: 'start' | 'end', value: string) => {
    const dayData = data.availability[dayValue];
    const newSlots = dayData.slots.map((slot, i) =>
      i === slotIndex ? { ...slot, [field]: value } : slot
    );
    updateData({
      availability: {
        ...data.availability,
        [dayValue]: { ...dayData, slots: newSlots },
      },
    });
  };

  // Copy schedule picker state
  const [copyFromDay, setCopyFromDay] = useState<number | null>(null);
  const [copyTargetDays, setCopyTargetDays] = useState<number[]>([]);

  const openCopyPicker = (sourceDayValue: number) => {
    setCopyFromDay(sourceDayValue);
    setCopyTargetDays([]);
  };

  const applyCopyToDays = () => {
    if (copyFromDay === null || copyTargetDays.length === 0) return;
    const sourceDay = data.availability[copyFromDay];
    if (!sourceDay?.isOpen) return;
    const updated = { ...data.availability };
    copyTargetDays.forEach((dv) => {
      updated[dv] = { isOpen: true, slots: [...sourceDay.slots] };
    });
    updateData({ availability: updated });
    setCopyFromDay(null);
    setCopyTargetDays([]);
  };

  // Step 4 - Availability
  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 mb-2">
          <Clock className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Vos horaires
        </h1>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Cliquez sur les horaires pour les modifier
        </p>
      </div>

      {/* Presets */}
      <div className="flex gap-2">
        {[
          { label: '9h – 18h', slots: [{ start: '09:00', end: '18:00' }] },
          { label: '8h – 13h', slots: [{ start: '08:00', end: '13:00' }] },
          { label: '9h–12h / 14h–19h', slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '19:00' }] },
        ].map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              const updated = { ...data.availability };
              DAYS_OF_WEEK.forEach((d) => {
                if (updated[d.value]?.isOpen) {
                  updated[d.value] = { ...updated[d.value], slots: [...preset.slots] };
                }
              });
              updateData({ availability: updated });
            }}
            className="flex-1 py-2 px-1 text-[11px] font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 rounded-lg border border-primary-200 dark:border-primary-800 transition-colors text-center"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {DAYS_OF_WEEK.map((day) => {
          const dayData = data.availability[day.value] || DEFAULT_AVAILABILITY[day.value];
          const slots = dayData.slots || [{ start: '09:00', end: '18:00' }];
          return (
            <div
              key={day.value}
              className={`rounded-xl border transition-colors ${
                dayData.isOpen
                  ? 'border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-800'
                  : 'border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/30'
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() =>
                    updateData({
                      availability: {
                        ...data.availability,
                        [day.value]: { ...dayData, isOpen: !dayData.isOpen },
                      },
                    })
                  }
                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                    dayData.isOpen ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      dayData.isOpen ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </button>

                {/* Day name */}
                <span className={`w-20 text-sm font-semibold ${dayData.isOpen ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                  {day.label}
                </span>

                {/* Time slots or "Fermé" */}
                {!dayData.isOpen ? (
                  <span className="text-xs text-gray-400 italic ml-auto">Fermé</span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                    {slots.map((slot, slotIndex) => (
                      <div key={slotIndex} className="flex items-center gap-1">
                        {slotIndex > 0 && <span className="text-gray-300 text-xs mx-0.5">·</span>}
                        <div className="flex items-center gap-1 bg-primary-50 dark:bg-primary-900/30 rounded-lg px-1 border border-primary-100 dark:border-primary-800">
                          <input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(day.value, slotIndex, 'start', e.target.value)}
                            className="w-[80px] px-1 py-1 bg-transparent text-sm font-medium text-primary-700 dark:text-primary-300 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                          />
                          <span className="text-primary-400 text-xs font-medium">→</span>
                          <input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(day.value, slotIndex, 'end', e.target.value)}
                            className="w-[80px] px-1 py-1 bg-transparent text-sm font-medium text-primary-700 dark:text-primary-300 focus:outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute"
                          />
                        </div>
                        {slots.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSlotFromDay(day.value, slotIndex)}
                            className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    {/* Add slot (pause) */}
                    <button
                      type="button"
                      onClick={() => addSlotToDay(day.value)}
                      className="p-1 text-primary-500 hover:text-primary-600 transition-colors"
                      title="Ajouter une pause"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {/* Copy to other days */}
                    <button
                      type="button"
                      onClick={() => openCopyPicker(day.value)}
                      className="ml-auto p-1 text-gray-400 hover:text-primary-600 transition-colors"
                      title="Copier vers d'autres jours"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                        <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Copy-to modal */}
      {copyFromDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setCopyFromDay(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Copier vers</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Copier les horaires de <span className="font-semibold text-gray-700 dark:text-gray-200">{DAYS_OF_WEEK.find((d) => d.value === copyFromDay)?.label}</span> vers :
            </p>
            <div className="space-y-1.5">
              {DAYS_OF_WEEK.filter((d) => d.value !== copyFromDay).map((d) => {
                const isChecked = copyTargetDays.includes(d.value);
                return (
                  <label key={d.value} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => setCopyTargetDays((prev) => isChecked ? prev.filter((v) => v !== d.value) : [...prev, d.value])}
                      className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-200">{d.label}</span>
                  </label>
                );
              })}
            </div>
            {/* Quick select */}
            <div className="flex gap-2 mt-3 mb-4">
              <button
                type="button"
                onClick={() => setCopyTargetDays(DAYS_OF_WEEK.filter((d) => d.value !== copyFromDay && d.value >= 1 && d.value <= 5).map((d) => d.value))}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-900/20"
              >
                Lun – Ven
              </button>
              <button
                type="button"
                onClick={() => setCopyTargetDays(DAYS_OF_WEEK.filter((d) => d.value !== copyFromDay).map((d) => d.value))}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 px-2 py-1 rounded-md bg-primary-50 dark:bg-primary-900/20"
              >
                Tous
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCopyFromDay(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={applyCopyToDays}
                disabled={copyTargetDays.length === 0}
                className="flex-1 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-40"
              >
                Copier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Step 5 - Preview
  const renderStep5 = () => {
    const fmtEur = (euros: number) =>
      euros.toLocaleString('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    const fmtDur = (min: number) =>
      min < 60 ? `${min} min` : min % 60 === 0 ? `${Math.floor(min / 60)}h` : `${Math.floor(min / 60)}h${min % 60}`;
    const namedServices = data.services.filter((s) => s.name.trim());

    return (
      <div className="space-y-5">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-3">
            <Eye className="w-7 h-7 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Voici votre profil
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Vous pourrez modifier ces informations a tout moment
          </p>
        </div>

        {/* Récap DÉTAILLÉ des prestations (variations / options / infos).
            L'aperçu de droite montre déjà la fiche ; ici on récapitule ce
            qu'on a configuré — sans le dupliquer. */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {namedServices.length > 1 ? 'Vos prestations' : 'Votre prestation'}
          </p>

          {namedServices.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Aucune prestation ajoutée — vous pourrez en créer après l'inscription.
            </p>
          ) : (
            namedServices.map((s, idx) => {
              const hasVar = (s.variations?.length ?? 0) > 0;
              const priceFromCents = getServiceMinPrice({
                price: s.price * 100,
                variations: s.variations ?? [],
              });
              const durFrom = getServiceMinDuration({
                duration: s.duration,
                variations: s.variations ?? [],
              });
              const priceLabel = hasVar
                ? priceFromCents > 0
                  ? `à partir de ${fmtEur(priceFromCents / 100)}`
                  : '—'
                : s.price > 0
                  ? fmtEur(s.price)
                  : 'Gratuit';
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 p-3.5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold text-gray-900 dark:text-white">{s.name}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtDur(durFrom)} · {priceLabel}
                    </span>
                  </div>

                  {hasVar && (
                    <div className="mt-2 space-y-1">
                      {s.variations!.map((v) => (
                        <p key={v.id} className="text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {v.name || 'Variation'}
                          </span>
                          {' : '}
                          {v.options
                            .filter((o) => o.name.trim())
                            .map((o) => `${o.name} (${fmtEur(o.price / 100)})`)
                            .join(' · ') || '—'}
                        </p>
                      ))}
                    </div>
                  )}

                  {(s.options?.length ?? 0) > 0 && (
                    <div className="mt-1.5 space-y-0.5">
                      {s.options!
                        .filter((o) => o.name.trim())
                        .map((o) => (
                          <p key={o.id} className="text-xs text-gray-500 dark:text-gray-400">
                            + {o.name}
                            {o.price > 0 ? ` (+${fmtEur(o.price / 100)})` : ''}
                          </p>
                        ))}
                    </div>
                  )}

                  {(s.infoFields?.filter((f) => f.name.trim()).length ?? 0) > 0 && (
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      {s.infoFields!.filter((f) => f.name.trim()).length} info(s) demandée(s) au client
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Il ne reste plus qu'une étape : créer votre compte !
        </p>
      </div>
    );
  };

  // Step 6 - Account Creation
  const renderStep6 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-3">
          <User className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Créez votre compte
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          30 jours d'essai gratuit, sans engagement
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="Nom complet"
            placeholder="Jean Dupont"
            value={data.displayName}
            onChange={(e) => updateData({ displayName: e.target.value })}
            disabled={loading}
            className="pl-10"
          />
          <User className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <Input
            type="email"
            label="Adresse email"
            placeholder="vous@exemple.com"
            value={data.email}
            onChange={(e) => updateData({ email: e.target.value })}
            disabled={loading}
            className="pl-10"
          />
          <Mail className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <Input
            type="email"
            label="Confirmer l'adresse email"
            placeholder="vous@exemple.com"
            value={data.confirmEmail}
            onChange={(e) => updateData({ confirmEmail: e.target.value })}
            disabled={loading}
            className="pl-10"
          />
          <Mail className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <Input
            type="tel"
            label="Téléphone"
            placeholder="0612345678"
            value={data.phone}
            onChange={(e) => updateData({ phone: e.target.value })}
            disabled={loading}
            className="pl-10"
          />
          <Phone className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
        </div>

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Mot de passe"
            placeholder="Minimum 6 caractères"
            value={data.password}
            onChange={(e) => updateData({ password: e.target.value })}
            disabled={loading}
            className="pl-10 pr-10"
          />
          <Lock className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            label="Confirmer le mot de passe"
            placeholder="Retapez votre mot de passe"
            value={data.confirmPassword}
            onChange={(e) => updateData({ confirmPassword: e.target.value })}
            disabled={loading}
            className="pl-10"
          />
          <Lock className="absolute left-3 top-[38px] w-4 h-4 text-gray-400" />
        </div>

        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="accept-terms"
            checked={data.acceptTerms}
            onChange={(e) => updateData({ acceptTerms: e.target.checked })}
            disabled={loading}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="accept-terms" className="text-sm text-gray-600 dark:text-gray-400">
            J'accepte les{' '}
            <Link href="/cgu" className="text-primary-600 hover:text-primary-700">
              CGU
            </Link>{' '}
            et la{' '}
            <Link href="/confidentialite" className="text-primary-600 hover:text-primary-700">
              politique de confidentialite
            </Link>
          </label>
        </div>

        <Button type="submit" fullWidth size="lg" loading={loading}>
          Creer mon compte et publier
        </Button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mobile-only live preview trigger — the right preview panel is hidden
          below `lg`, so mobile users open the same fiche in a modal. */}
      <button
        type="button"
        onClick={() => setShowMobilePreview(true)}
        className="lg:hidden fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-600 text-white text-sm font-semibold shadow-lg shadow-primary-600/30 active:scale-95 transition-transform"
      >
        <Eye className="w-4 h-4" /> Aperçu
      </button>

      {showMobilePreview && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-600 dark:to-primary-800">
          <div className="flex items-center justify-end px-4 py-3">
            <button
              type="button"
              onClick={() => setShowMobilePreview(false)}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white active:scale-95 transition-transform"
              aria-label="Fermer l'aperçu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-10 flex items-start justify-center">
            <RegisterLivePreview data={previewData} />
          </div>
        </div>
      )}

      {/* Step indicator - compact for form container */}
      <div className="mb-4">
        <StepIndicator steps={STEPS} currentStep={currentStep} />
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
          <p className="text-sm text-error-700 dark:text-error-400">{error}</p>
        </div>
      )}

      {/* Step content with animation */}
      <div className="flex-1">
        <div
          className={`transition-all duration-150 ease-out ${
            isAnimating
              ? slideDirection === 'right'
                ? 'opacity-0 -translate-x-4'
                : 'opacity-0 translate-x-4'
              : 'opacity-100 translate-x-0'
          }`}
        >
          {renderCurrentStep()}
        </div>
      </div>

      {/* Navigation buttons */}
      {currentStep < 6 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          {currentStep > 1 ? (
            <Button
              variant="ghost"
              onClick={handleBack}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              disabled={loading}
              size="sm"
            >
              Retour
            </Button>
          ) : (
            <Link
              href="/login"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              J'ai déjà un compte
            </Link>
          )}
          <Button
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
            disabled={loading}
            size="sm"
          >
            Suivant
          </Button>
        </div>
      )}

      {/* Back button only on step 6 */}
      {currentStep === 6 && (
        <div className="mt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            leftIcon={<ChevronLeft className="w-4 h-4" />}
            disabled={loading}
            size="sm"
            className="mx-auto"
          >
            Retour à l'aperçu
          </Button>
        </div>
      )}
    </div>
  );
}
