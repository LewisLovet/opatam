'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Checkbox,
  GoogleAddressAutocomplete,
  CountrySelect,
  ConfirmDialog,
  type GoogleAddressSuggestion,
} from '@/components/ui';
import { Loader2, Trash2, Building2, Car, Lock, Plus, X } from 'lucide-react';
import type { Location, LocationType, TravelZoneTier } from '@booking-app/shared';
import { isValidTravelZone } from '@booking-app/shared';
import { isValidPostalCode } from '@booking-app/shared/schemas';
import { auth as firebaseAuth } from '@booking-app/firebase';

type WithId<T> = { id: string } & T;

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: WithId<Location> | null;
  onSave: (data: LocationFormData) => Promise<void>;
  onDelete?: (locationId: string) => Promise<void>;
}

export interface LocationFormData {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  countryCode: string;
  description: string | null;
  isDefault: boolean;
  type: LocationType;
  travelRadius: number | null;
  protectAddress: boolean;
  approxArea: string | null;
  accessInstructions: string | null;
  geopoint?: { latitude: number; longitude: number } | null;
  region?: string | null;
  /**
   * Frais de déplacement (lieu mobile). undefined = ne pas toucher ;
   * { originPlaceId: null, tiers: null } = désactiver. Sauvegardé par la
   * route /api/pro/locations/[id]/travel-zone (l'origine est PRIVÉE —
   * jamais écrite sur le document public du lieu).
   */
  travel?: { originPlaceId: string | null; tiers: TravelZoneTier[] | null };
}

/** Ligne d'édition d'un palier (saisies en texte, converties à la sauvegarde). */
interface TierRow {
  maxKm: string;
  feeEuros: string;
}

/** Convertit les lignes saisies en paliers (centimes) ; null si illisible. */
function parseTierRows(rows: TierRow[]): TravelZoneTier[] | null {
  const tiers: TravelZoneTier[] = [];
  for (const row of rows) {
    const maxKm = Number(row.maxKm.replace(',', '.'));
    const feeEuros = Number(row.feeEuros.replace(',', '.'));
    if (!Number.isFinite(maxKm) || !Number.isFinite(feeEuros)) return null;
    tiers.push({ maxKm, fee: Math.round(feeEuros * 100) });
  }
  return tiers;
}

export function LocationModal({
  isOpen,
  onClose,
  location,
  onSave,
  onDelete,
}: LocationModalProps) {
  const isEditing = !!location;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cityOnly, setCityOnly] = useState(false);

  // Frais de déplacement — l'origine (privée) et les paliers viennent de la
  // route dédiée, pas du document public.
  const [travelEnabled, setTravelEnabled] = useState(false);
  const [tierRows, setTierRows] = useState<TierRow[]>([{ maxKm: '10', feeEuros: '0' }]);
  const [originPlaceId, setOriginPlaceId] = useState<string | null>(null);
  const [originAddress, setOriginAddress] = useState('');
  const [originQuery, setOriginQuery] = useState('');

  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    countryCode: 'FR',
    description: null,
    isDefault: false,
    type: 'fixed',
    travelRadius: null,
    protectAddress: false,
    approxArea: null,
    accessInstructions: null,
  });

  // Initialize form when modal opens or location changes
  useEffect(() => {
    if (isOpen) {
      if (location) {
        setFormData({
          name: location.name,
          address: location.address,
          postalCode: location.postalCode,
          city: location.city,
          countryCode: location.countryCode || 'FR',
          description: location.description,
          isDefault: location.isDefault,
          type: location.type || 'fixed',
          travelRadius: location.travelRadius,
          // Keep the existing coordinates so editing (without re-picking the
          // address) doesn't trip the "select an address from the list" check.
          geopoint: location.geopoint ?? null,
          protectAddress: location.protectAddress ?? false,
          approxArea: location.approxArea ?? null,
          accessInstructions: location.accessInstructions ?? null,
        });
        setCityOnly(location.type === 'fixed' && !location.address);
        // Hydrate la zone de déplacement depuis la route (origine privée).
        setTravelEnabled(false);
        setTierRows([{ maxKm: '10', feeEuros: '0' }]);
        setOriginPlaceId(null);
        setOriginAddress('');
        setOriginQuery('');
        if (location.type === 'mobile') {
          void (async () => {
            try {
              const user = firebaseAuth.currentUser;
              if (!user) return;
              const res = await fetch(`/api/pro/locations/${location.id}/travel-zone`, {
                headers: { Authorization: `Bearer ${await user.getIdToken()}` },
              });
              if (!res.ok) return;
              const data = await res.json();
              if (Array.isArray(data.tiers) && data.tiers.length > 0) {
                setTravelEnabled(true);
                setTierRows(
                  data.tiers.map((t: TravelZoneTier) => ({
                    maxKm: String(t.maxKm),
                    feeEuros: (t.fee / 100).toString(),
                  })),
                );
              }
              if (data.origin) {
                setOriginPlaceId(data.origin.placeId ?? null);
                setOriginAddress(data.origin.address ?? '');
                setOriginQuery(data.origin.address ?? '');
              }
            } catch {
              // silencieux : la section reste vierge, le pro re-choisit
            }
          })();
        }
      } else {
        setFormData({
          name: '',
          address: '',
          postalCode: '',
          city: '',
          countryCode: 'FR',
          description: null,
          isDefault: false,
          type: 'fixed',
          travelRadius: null,
          protectAddress: false,
          approxArea: null,
          accessInstructions: null,
        });
        setCityOnly(false);
        setTravelEnabled(false);
        setTierRows([{ maxKm: '10', feeEuros: '0' }]);
        setOriginPlaceId(null);
        setOriginAddress('');
        setOriginQuery('');
      }
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, location]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || null,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleTypeChange = (type: LocationType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      // Reset travelRadius when switching to fixed
      travelRadius: type === 'fixed' ? null : prev.travelRadius || 15,
      // Clear address when switching to mobile (optional)
      address: type === 'mobile' ? '' : prev.address,
      // Un lieu mobile ne porte JAMAIS de geopoint public : sans cette purge,
      // les coordonnées de l'ancienne adresse fixe resteraient sur le doc.
      geopoint: type === 'mobile' ? null : prev.geopoint,
    }));
    setErrors((prev) => ({ ...prev, type: '', travelRadius: '', address: '' }));
  };

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setFormData((prev) => ({
      ...prev,
      travelRadius: isNaN(value) ? null : Math.min(100, Math.max(1, value)),
    }));
    setErrors((prev) => ({ ...prev, travelRadius: '' }));
  };

  const handleAddressSelect = (suggestion: GoogleAddressSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.formattedAddress,
      postalCode: suggestion.postalCode ?? '',
      city: suggestion.locality ?? '',
      geopoint: suggestion.coordinates,
      region: suggestion.adminArea1,
    }));
    setErrors((prev) => ({ ...prev, address: '', postalCode: '', city: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
    }

    if (formData.type === 'fixed') {
      if (cityOnly) {
        // City-only: must select a city from autocomplete
        if (!formData.city?.trim()) {
          newErrors.city = 'Veuillez sélectionner une ville';
        }
      } else {
        // Full address: must select from autocomplete
        if (!formData.address?.trim()) {
          newErrors.address = "L'adresse est requise";
        } else if (!formData.geopoint && formData.address !== location?.address) {
          // Require a fresh autocomplete pick only when the address was actually
          // changed (or it's a new location). Editing an existing one without
          // touching the address — even a legacy one missing coordinates — passes.
          newErrors.address = 'Veuillez sélectionner une adresse dans la liste';
        }
      }
    }

    // Postal code: required for full FIXED address only — a mobile location
    // keeps its public address fields empty (privacy: the pro's start point
    // lives in the private travelOrigin doc).
    const needsPostalCode = formData.type === 'fixed' && !cityOnly;
    if (needsPostalCode && formData.postalCode?.trim() && !isValidPostalCode(formData.postalCode, formData.countryCode)) {
      newErrors.postalCode = 'Code postal invalide';
    }
    if (needsPostalCode && !formData.postalCode?.trim()) {
      newErrors.postalCode = 'Le code postal est requis';
    }

    if (!formData.city?.trim()) {
      newErrors.city = newErrors.city || 'La ville est requise';
    } else if (formData.city.length < 2) {
      newErrors.city = 'La ville doit contenir au moins 2 caractères';
    }

    // Travel radius required for mobile type (quand les frais automatiques
    // sont actifs, le rayon est dérivé du dernier palier — pas de saisie).
    if (formData.type === 'mobile' && !travelEnabled) {
      if (!formData.travelRadius || formData.travelRadius < 1) {
        newErrors.travelRadius = 'Le rayon de déplacement est requis';
      } else if (formData.travelRadius > 100) {
        newErrors.travelRadius = 'Le rayon ne peut pas dépasser 100 km';
      }
    }

    // Frais de déplacement : origine + paliers valides exigés ensemble.
    if (formData.type === 'mobile' && travelEnabled) {
      if (!originPlaceId) {
        newErrors.travelOrigin = 'Sélectionnez votre adresse ou ville de départ';
      }
      const tiers = parseTierRows(tierRows);
      if (!tiers || !isValidTravelZone(tiers)) {
        newErrors.travelTiers =
          'Paliers invalides : bornes croissantes (max 300 km), frais positifs, 8 paliers maximum';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      let dataToSave: LocationFormData = cityOnly
        ? { ...formData, address: '', geopoint: null }
        : formData;
      if (formData.type === 'mobile') {
        // Champs publics vidés : le point de départ du pro est privé.
        dataToSave = {
          ...dataToSave,
          address: '',
          postalCode: '',
          geopoint: null,
          travel: travelEnabled
            ? { originPlaceId, tiers: parseTierRows(tierRows) }
            : { originPlaceId: null, tiers: null },
        };
      }
      await onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!location || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(location.id);
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden max-h-[inherit]">
        <ModalHeader
          title={isEditing ? 'Modifier le lieu' : 'Nouveau lieu'}
          onClose={onClose}
        />

        <ModalBody className="space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Type de lieu
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('fixed')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${formData.type === 'fixed'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${formData.type === 'fixed'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                `}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${formData.type === 'fixed' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                    Lieu fixe
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Salon, cabinet...
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('mobile')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${formData.type === 'mobile'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${formData.type === 'mobile'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                `}>
                  <Car className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${formData.type === 'mobile' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                    Déplacement
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    A domicile
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Name */}
          <Input
            label="Nom du lieu"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={formData.type === 'fixed' ? 'Ex: Mon salon' : 'Ex: A domicile'}
            error={errors.name}
            required
          />

          {/* City-only option for fixed type */}
          {formData.type === 'fixed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type de localisation
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCityOnly(false);
                    setErrors((prev) => ({ ...prev, address: '', city: '', postalCode: '' }));
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    !cityOnly
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Adresse precise
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCityOnly(true);
                    setFormData((prev) => ({
                      ...prev,
                      address: '',
                      geopoint: null,
                      postalCode: '',
                      city: '',
                    }));
                    setErrors((prev) => ({ ...prev, address: '', city: '', postalCode: '' }));
                  }}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    cityOnly
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  Ville uniquement
                </button>
              </div>
            </div>
          )}

          {/* Country selector */}
          <CountrySelect
            value={formData.countryCode}
            onChange={(code) => setFormData((prev) => ({
              ...prev,
              countryCode: code,
              address: '',
              postalCode: '',
              city: '',
              geopoint: null,
              region: null,
            }))}
          />

          {/* Address autocomplete for fixed type without city-only */}
          {formData.type === 'fixed' && !cityOnly && (
            <GoogleAddressAutocomplete
              label="Adresse"
              value={formData.address}
              onChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  address: value,
                  postalCode: '',
                  city: '',
                  geopoint: null,
                }));
                setErrors((prev) => ({ ...prev, address: '' }));
              }}
              onSelect={handleAddressSelect}
              countries={[formData.countryCode.toLowerCase()]}
              placeholder="Rechercher une adresse..."
              error={errors.address}
              required
            />
          )}

          {/* City autocomplete for fixed type with city-only */}
          {formData.type === 'fixed' && cityOnly && (
            <GoogleAddressAutocomplete
              label="Ville"
              value={formData.city}
              onChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  city: value,
                  postalCode: '',
                  geopoint: null,
                }));
                setErrors((prev) => ({ ...prev, city: '' }));
              }}
              onSelect={(suggestion: GoogleAddressSuggestion) => {
                setFormData((prev) => ({
                  ...prev,
                  city: suggestion.locality ?? '',
                  postalCode: suggestion.postalCode ?? '',
                  geopoint: suggestion.coordinates,
                  region: suggestion.adminArea1,
                }));
                setErrors((prev) => ({ ...prev, city: '', postalCode: '' }));
              }}
              countries={[formData.countryCode.toLowerCase()]}
              placeholder="Rechercher une ville..."
              error={errors.city}
              required
            />
          )}

          {/* City and Postal Code - readonly when auto-filled, postal code hidden in city-only mode */}
          <div className={`grid gap-4 ${cityOnly || formData.type === 'mobile' ? 'grid-cols-1' : 'grid-cols-3'}`}>
            {!cityOnly && formData.type === 'fixed' && (
              <Input
                label="Code postal"
                name="postalCode"
                value={formData.postalCode}
                onChange={formData.type === 'fixed' ? undefined : handleChange}
                readOnly={formData.type === 'fixed'}
                placeholder="75001"
                error={errors.postalCode}
                required
                className={formData.type === 'fixed' ? 'bg-gray-50 dark:bg-gray-900 cursor-default' : ''}
              />
            )}

            <div className={cityOnly || formData.type === 'mobile' ? '' : 'col-span-2'}>
              <Input
                label={formData.type === 'fixed' ? 'Ville' : 'Zone centrale'}
                name="city"
                value={formData.city}
                onChange={formData.type === 'fixed' ? undefined : handleChange}
                readOnly={formData.type === 'fixed'}
                placeholder="Paris"
                error={errors.city}
                required
                className={formData.type === 'fixed' ? 'bg-gray-50 dark:bg-gray-900 cursor-default' : ''}
              />
            </div>
          </div>

          {/* Travel radius - only for mobile type, saisi seulement quand les
              frais automatiques sont désactivés (sinon dérivé du dernier palier) */}
          {formData.type === 'mobile' && !travelEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rayon de deplacement
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={formData.travelRadius || 15}
                  onChange={handleRadiusChange}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.travelRadius || ''}
                    onChange={handleRadiusChange}
                    className="w-16 px-2 py-1.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">km</span>
                </div>
              </div>
              {errors.travelRadius && (
                <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">
                  {errors.travelRadius}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Zone de deplacement autour de {formData.city || 'la ville'}
              </p>
            </div>
          )}

          {/* Frais de déplacement automatiques (lieu mobile) */}
          {formData.type === 'mobile' && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Frais de déplacement automatiques
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    La cliente saisit son adresse, la distance routière est calculée et le
                    frais du palier s&apos;ajoute au total. Au-delà du dernier palier, la
                    réservation en ligne est refusée.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={travelEnabled}
                  onClick={() => setTravelEnabled((v) => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                    travelEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      travelEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {travelEnabled && (
                <>
                  <div>
                    <GoogleAddressAutocomplete
                      label="Adresse ou ville de départ"
                      value={originQuery}
                      onChange={(value) => {
                        setOriginQuery(value);
                        setOriginPlaceId(null);
                        setErrors((prev) => ({ ...prev, travelOrigin: '' }));
                      }}
                      onSelect={(suggestion: GoogleAddressSuggestion) => {
                        setOriginPlaceId(suggestion.placeId ?? null);
                        setOriginAddress(suggestion.formattedAddress);
                        setOriginQuery(suggestion.formattedAddress);
                        setFormData((prev) => ({
                          ...prev,
                          city: prev.city || suggestion.locality || '',
                        }));
                        setErrors((prev) => ({ ...prev, travelOrigin: '' }));
                      }}
                      countries={[formData.countryCode.toLowerCase()]}
                      placeholder="D'où partez-vous ? (adresse précise ou ville)"
                      error={errors.travelOrigin}
                      hint="Point de départ des trajets — jamais montré aux clientes."
                    />
                    {originPlaceId && originAddress && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Départ : {originAddress}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Paliers (jusqu&apos;à … km → frais)
                    </p>
                    {tierRows.map((row, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-14 flex-shrink-0">
                          {i === 0 ? "Jusqu'à" : '→'}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="300"
                          value={row.maxKm}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTierRows((rows) => rows.map((r, j) => (j === i ? { ...r, maxKm: v } : r)));
                            setErrors((prev) => ({ ...prev, travelTiers: '' }));
                          }}
                          className="w-20 px-2 py-1.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">km :</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.feeEuros}
                          onChange={(e) => {
                            const v = e.target.value;
                            setTierRows((rows) => rows.map((r, j) => (j === i ? { ...r, feeEuros: v } : r)));
                            setErrors((prev) => ({ ...prev, travelTiers: '' }));
                          }}
                          className="w-20 px-2 py-1.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex-1">
                          {Number(row.feeEuros.replace(',', '.')) === 0 ? '€ — offert' : '€'}
                        </span>
                        {tierRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setTierRows((rows) => rows.filter((_, j) => j !== i))}
                            className="p-1 text-gray-400 hover:text-error-600"
                            aria-label="Supprimer ce palier"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {errors.travelTiers && (
                      <p className="text-sm text-error-600 dark:text-error-400">{errors.travelTiers}</p>
                    )}
                    {tierRows.length < 8 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTierRows((rows) => {
                            const lastKm = Number(rows[rows.length - 1]?.maxKm) || 10;
                            return [...rows, { maxKm: String(lastKm + 5), feeEuros: '' }];
                          })
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
                      >
                        <Plus className="w-3.5 h-3.5" /> Ajouter un palier
                      </button>
                    )}
                    {(() => {
                      const last = Number(tierRows[tierRows.length - 1]?.maxKm.replace(',', '.'));
                      return Number.isFinite(last) && last > 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 rounded-md bg-gray-50 dark:bg-gray-900/40 px-2.5 py-2">
                          Au-delà de {last} km : réservation en ligne impossible.
                        </p>
                      ) : null;
                    })()}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Description */}
          <Textarea
            label="Description"
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            placeholder={formData.type === 'mobile' ? 'Ex: Frais de deplacement : 10€' : 'Ex: Parking gratuit disponible'}
            rows={3}
            hint="Optionnel - informations complementaires"
          />

          {/* Address privacy — only for a fixed location with a precise address */}
          {formData.type === 'fixed' && !cityOnly && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
              <Checkbox
                name="protectAddress"
                checked={formData.protectAddress}
                onChange={handleCheckboxChange}
                label="Protéger mon adresse"
                description="L'adresse exacte n'est communiquée à la cliente que ~48h avant le rendez-vous (par email et dans l'app), une fois la réservation confirmée. Avant, elle ne voit que la zone."
              />

              {formData.protectAddress && (
                <div className="space-y-4 pl-1">
                  <Input
                    label="Zone affichée avant révélation"
                    name="approxArea"
                    value={formData.approxArea || ''}
                    onChange={handleChange}
                    placeholder="Ex: Batignolles, Paris 17e"
                    hint="Ce que voit la cliente avant la révélation. Par défaut : la ville."
                  />
                  <Textarea
                    label="Infos d'accès (révélées avec l'adresse)"
                    name="accessInstructions"
                    value={formData.accessInstructions || ''}
                    onChange={handleChange}
                    placeholder="Ex: Interphone 1346, 2e étage, sonner à 203. Parking visiteurs au sous-sol."
                    rows={3}
                    hint="Communiquées en même temps que l'adresse. Ne les mettez plus dans « Information libre »."
                  />
                  <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    Adresse et infos d'accès restent masquées tant que la réservation n'est pas confirmée et qu'on n'est pas à moins de 48h du rendez-vous.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Default checkbox */}
          <Checkbox
            name="isDefault"
            checked={formData.isDefault}
            onChange={handleCheckboxChange}
            label="Définir comme lieu principal"
            disabled={location?.isDefault}
            description={location?.isDefault ? 'Ce lieu est déjà le lieu principal' : undefined}
          />

          {/* Error message */}
          {errors.submit && (
            <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {/* Delete button (editing only) */}
          {isEditing && onDelete && (
            <div className="flex-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-error-600 hover:text-error-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          )}

          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditing ? 'Mise à jour...' : 'Création...'}
              </>
            ) : isEditing ? (
              'Mettre à jour'
            ) : (
              'Enregistrer'
            )}
          </Button>
        </ModalFooter>
      </form>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Supprimer le lieu"
        message="Êtes-vous sûr de vouloir supprimer ce lieu ? Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleting}
        variant="danger"
      />
    </Modal>
  );
}
