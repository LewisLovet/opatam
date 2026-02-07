'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Building2,
  MapPin,
  Scissors,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Phone,
  Plus,
  X,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { StepIndicator } from '@/components/common/StepIndicator';
import {
  authService,
  providerService,
  locationRepository,
  serviceRepository,
  schedulingService,
  memberService,
} from '@booking-app/firebase';
import { CATEGORIES, DAYS_OF_WEEK } from '@booking-app/shared';

// Storage key for localStorage
const STORAGE_KEY = 'opatam-register-wizard';

// Duration options for services
const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
];

// Step definitions
const STEPS = [
  { label: 'Activite' },
  { label: 'Lieu' },
  { label: 'Prestation' },
  { label: 'Horaires' },
  { label: 'Apercu' },
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
  address: string;
  postalCode: string;
  city: string;
  // Step 3 - Service
  serviceName: string;
  serviceDuration: number;
  servicePrice: number;
  serviceDescription: string;
  // Step 4 - Availability (supports multiple slots per day)
  availability: {
    [key: number]: DayAvailability;
  };
  // Step 6 - Account
  displayName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
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
  locationName: '',
  address: '',
  postalCode: '',
  city: '',
  serviceName: '',
  serviceDuration: 60,
  servicePrice: 0,
  serviceDescription: '',
  availability: DEFAULT_AVAILABILITY,
  displayName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
};

// Google icon
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Error message helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Un compte existe deja avec cet email';
      case 'auth/invalid-email':
        return 'Adresse email invalide';
      case 'auth/weak-password':
        return 'Le mot de passe doit contenir au moins 6 caracteres';
      case 'auth/popup-closed-by-user':
        return 'Inscription annulee';
      default:
        return error.message || 'Une erreur est survenue';
    }
  }
  return 'Une erreur est survenue';
}


export default function RegisterPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

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
    // Dispatch event for layout to update
    window.dispatchEvent(new CustomEvent('register-step-change', { detail: currentStep }));
  }, [data, currentStep]);

  const updateData = useCallback((updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const validateStep = (step: number): boolean => {
    setError('');
    switch (step) {
      case 1:
        if (!data.businessName.trim()) {
          setError('Veuillez entrer le nom de votre activite');
          return false;
        }
        if (!data.category) {
          setError('Veuillez selectionner une categorie');
          return false;
        }
        return true;
      case 2:
        if (!data.locationName.trim()) {
          setError('Veuillez entrer le nom du lieu');
          return false;
        }
        if (!data.address.trim()) {
          setError("Veuillez entrer l'adresse");
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
        return true;
      case 3:
        if (!data.serviceName.trim()) {
          setError('Veuillez entrer le nom de la prestation');
          return false;
        }
        if (data.servicePrice <= 0) {
          setError('Veuillez entrer un prix valide');
          return false;
        }
        return true;
      case 4:
        const hasOpenDay = Object.values(data.availability).some((day) => day.isOpen);
        if (!hasOpenDay) {
          setError("Veuillez selectionner au moins un jour d'ouverture");
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
        if (!data.phone.trim()) {
          setError('Veuillez entrer votre numero de telephone');
          return false;
        }
        if (!/^0[67]\d{8}$/.test(data.phone)) {
          setError('Numero de telephone invalide (format: 06/07 + 8 chiffres)');
          return false;
        }
        if (!data.password || data.password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caracteres');
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

    // Create Location
    const locationId = await locationRepository.create(provider.id, {
      name: data.locationName,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      geopoint: null,
      description: null,
      isDefault: true,
      isActive: true,
      type: 'fixed',
      travelRadius: null,
    });

    // Create default member (represents the provider owner)
    // NOUVEAU MODÈLE: 1 membre = 1 lieu = 1 agenda
    const defaultMember = await memberService.createDefaultMember(
      provider.id,
      data.displayName || data.businessName,
      data.email,
      locationId
    );

    // Create Service
    await serviceRepository.create(provider.id, {
      name: data.serviceName,
      description: data.serviceDescription || null,
      duration: data.serviceDuration,
      price: data.servicePrice * 100, // Convert to cents
      bufferTime: 0,
      isActive: true,
      locationIds: [locationId],
      memberIds: [defaultMember.id], // Associate with default member
      sortOrder: 0,
    });

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

      // Sign out after registration so user must log in
      await authService.logout();

      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('register-step');

      // Redirect to login with success message
      router.push('/login?registered=true');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    // Validate all previous steps
    for (let step = 1; step <= 5; step++) {
      if (!validateStep(step)) {
        changeStep(step, 'left');
        return;
      }
    }

    if (!data.acceptTerms) {
      setError("Veuillez accepter les conditions d'utilisation");
      return;
    }

    setGoogleLoading(true);
    setError('');

    try {
      const { user } = await authService.loginWithGoogle();
      await createProviderWithData(user.id);
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('register-step');
      router.push('/pro');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGoogleLoading(false);
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
          Parlez-nous de votre activite
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Ces informations apparaitront sur votre page publique
        </p>
      </div>

      <Input
        label="Nom de l'entreprise / activite"
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
          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
        <p className="mt-1 text-xs text-gray-500">{data.description.length}/500</p>
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

      <Input
        label="Nom du lieu"
        placeholder="Ex: Mon salon, A domicile..."
        value={data.locationName}
        onChange={(e) => updateData({ locationName: e.target.value })}
      />

      <Input
        label="Adresse"
        placeholder="123 Rue de la Paix"
        value={data.address}
        onChange={(e) => updateData({ address: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Code postal"
          placeholder="75001"
          value={data.postalCode}
          onChange={(e) => updateData({ postalCode: e.target.value })}
        />
        <Input
          label="Ville"
          placeholder="Paris"
          value={data.city}
          onChange={(e) => updateData({ city: e.target.value })}
        />
      </div>
    </div>
  );

  // Step 3 - Service
  const renderStep3 = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-3">
          <Scissors className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          Creez votre premiere prestation
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Vous pourrez en ajouter d'autres plus tard
        </p>
      </div>

      <Input
        label="Nom de la prestation"
        placeholder="Ex: Coupe femme, Massage relaxant..."
        value={data.serviceName}
        onChange={(e) => updateData({ serviceName: e.target.value })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Duree
          </label>
          <select
            value={data.serviceDuration}
            onChange={(e) => updateData({ serviceDuration: parseInt(e.target.value) })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Input
          type="number"
          label="Prix (EUR)"
          placeholder="0"
          value={data.servicePrice || ''}
          onChange={(e) => updateData({ servicePrice: parseFloat(e.target.value) || 0 })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Description (optionnel)
        </label>
        <textarea
          value={data.serviceDescription}
          onChange={(e) => updateData({ serviceDescription: e.target.value })}
          placeholder="Details sur la prestation..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
        />
      </div>
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
          Cliquez sur + pour ajouter une pause dejeuner
        </p>
      </div>

      <div className="space-y-1.5">
        {DAYS_OF_WEEK.map((day) => {
          // Ensure dayData and slots always exist (fallback to default)
          const dayData = data.availability[day.value] || DEFAULT_AVAILABILITY[day.value];
          const slots = dayData.slots || [{ start: '09:00', end: '18:00' }];
          return (
            <div
              key={day.value}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
            >
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
                className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${
                  dayData.isOpen ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    dayData.isOpen ? 'left-[14px]' : 'left-0.5'
                  }`}
                />
              </button>

              {/* Day name */}
              <span className="w-12 text-xs font-medium text-gray-900 dark:text-white truncate">
                {day.label.slice(0, 3)}
              </span>

              {/* Time slots or "Ferme" */}
              {!dayData.isOpen ? (
                <span className="text-xs text-gray-400 ml-auto">Ferme</span>
              ) : (
                <div className="flex items-center gap-1 flex-1 flex-wrap">
                  {slots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-0.5">
                      {slotIndex > 0 && <span className="text-gray-300 text-xs mx-0.5">|</span>}
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => updateSlot(day.value, slotIndex, 'start', e.target.value)}
                        className="w-[70px] px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[11px] text-gray-900 dark:text-gray-100"
                      />
                      <span className="text-gray-400 text-[10px]">-</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => updateSlot(day.value, slotIndex, 'end', e.target.value)}
                        className="w-[70px] px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-[11px] text-gray-900 dark:text-gray-100"
                      />
                      {/* Remove slot button (only if more than one slot) */}
                      {slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlotFromDay(day.value, slotIndex)}
                          className="p-0.5 text-gray-400 hover:text-error-500 transition-colors"
                          title="Supprimer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {/* Add slot button */}
                  <button
                    type="button"
                    onClick={() => addSlotToDay(day.value)}
                    className="p-0.5 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors ml-1"
                    title="Ajouter un créneau"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Step 5 - Preview
  const renderStep5 = () => {
    const categoryLabel = CATEGORIES.find((c) => c.id === data.category)?.label || data.category;
    const openDays = DAYS_OF_WEEK.filter((d) => data.availability[d.value]?.isOpen);

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

        {/* Preview Card */}
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-primary-500 to-primary-600" />
          <div className="p-4 -mt-6">
            <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-700 border-2 border-white dark:border-gray-800 flex items-center justify-center mb-3 shadow">
              <Building2 className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {data.businessName || 'Votre activite'}
            </h3>
            <p className="text-xs text-primary-600 dark:text-primary-400">{categoryLabel}</p>

            {data.description && (
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                {data.description}
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  {data.locationName} - {data.city}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Scissors className="w-3.5 h-3.5" />
                <span>
                  {data.serviceName} - {data.servicePrice} EUR
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {openDays.length > 0
                    ? `${openDays[0]?.label} - ${openDays[openDays.length - 1]?.label}`
                    : 'Horaires à définir'}
                </span>
              </div>
            </div>
          </div>
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
          Creez votre compte
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          7 jours d'essai gratuit, sans engagement
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Input
            label="Nom complet"
            placeholder="Jean Dupont"
            value={data.displayName}
            onChange={(e) => updateData({ displayName: e.target.value })}
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
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

        <Button type="submit" fullWidth size="lg" loading={loading} disabled={googleLoading}>
          Creer mon compte et publier
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white dark:bg-gray-800 text-gray-500">Ou</span>
        </div>
      </div>

      {/* Google button */}
      <Button
        type="button"
        variant="outline"
        fullWidth
        size="lg"
        onClick={handleGoogleSignup}
        loading={googleLoading}
        disabled={loading}
        leftIcon={!googleLoading ? <GoogleIcon /> : undefined}
        className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
      >
        Continuer avec Google
      </Button>

      {/* Login link */}
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Deja un compte ?{' '}
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
              disabled={loading || googleLoading}
              size="sm"
            >
              Retour
            </Button>
          ) : (
            <Link
              href="/login"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              J'ai deja un compte
            </Link>
          )}
          <Button
            onClick={handleNext}
            rightIcon={<ChevronRight className="w-4 h-4" />}
            disabled={loading || googleLoading}
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
            disabled={loading || googleLoading}
            size="sm"
            className="mx-auto"
          >
            Retour a l'apercu
          </Button>
        </div>
      )}
    </div>
  );
}
