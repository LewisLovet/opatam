'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  useToast,
} from '@/components/ui';
import { Loader2, Trash2, Copy, Mail, RefreshCw, AlertTriangle, Scissors, ChevronRight, ChevronLeft, User, MapPin, Key } from 'lucide-react';
import type { Member, Location, Service } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: WithId<Member> | null;
  locations: WithId<Location>[];
  services: WithId<Service>[];
  memberServiceIds: string[];
  onSave: (data: MemberFormData) => Promise<void>;
  onDelete?: (memberId: string) => Promise<void>;
  onRegenerateCode?: (memberId: string) => Promise<string>;
  onSendCode?: (memberId: string) => Promise<void>;
  upcomingBookingsCount?: number;
}

export interface MemberFormData {
  name: string;
  email: string;
  phone: string | null;
  locationId: string; // NOUVEAU MODÈLE: 1 membre = 1 lieu
  serviceIds: string[];
}

type TabId = 'info' | 'assignments' | 'code';

export function MemberModal({
  isOpen,
  onClose,
  member,
  locations,
  services,
  memberServiceIds,
  onSave,
  onDelete,
  onRegenerateCode,
  onSendCode,
  upcomingBookingsCount = 0,
}: MemberModalProps) {
  const toast = useToast();
  const isEditing = !!member;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentCode, setCurrentCode] = useState<string>('');

  // For editing: current tab | For creation: current step (1 or 2)
  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [creationStep, setCreationStep] = useState<1 | 2>(1);

  const [formData, setFormData] = useState<MemberFormData>({
    name: '',
    email: '',
    phone: null,
    locationId: '', // NOUVEAU MODÈLE: 1 membre = 1 lieu
    serviceIds: [],
  });

  // Active locations only (memoized to prevent infinite loops)
  const activeLocations = useMemo(
    () => locations.filter((loc) => loc.isActive),
    [locations]
  );

  // Active services only
  const activeServices = useMemo(
    () => services.filter((svc) => svc.isActive),
    [services]
  );

  // Services available for selected location
  const availableServices = useMemo(() => {
    if (!formData.locationId) return [];
    return activeServices.filter((svc) =>
      svc.locationIds.includes(formData.locationId)
    );
  }, [activeServices, formData.locationId]);

  // Get location name for a service (only show if it matches member's location)
  const getServiceLocationName = (service: WithId<Service>): string | null => {
    if (!service.locationIds.includes(formData.locationId)) return null;
    const loc = locations.find((l) => l.id === formData.locationId);
    return loc?.name || null;
  };

  // Initialize form when modal opens or member changes
  useEffect(() => {
    if (isOpen) {
      if (member) {
        setFormData({
          name: member.name,
          email: member.email,
          phone: member.phone,
          locationId: member.locationId, // NOUVEAU MODÈLE: 1 membre = 1 lieu
          serviceIds: memberServiceIds,
        });
        setCurrentCode(member.accessCode);
        setActiveTab('info');
      } else {
        // Default to first active location for new members
        const firstActiveLocation = locations.find((loc) => loc.isActive);
        const defaultLocationId = firstActiveLocation?.id || '';
        // Default to all available services for that location
        const availableServiceIds = services
          .filter((svc) => svc.isActive && defaultLocationId && svc.locationIds.includes(defaultLocationId))
          .map((s) => s.id);
        setFormData({
          name: '',
          email: '',
          phone: null,
          locationId: defaultLocationId, // NOUVEAU MODÈLE: 1 membre = 1 lieu
          serviceIds: availableServiceIds,
        });
        setCurrentCode('');
        setCreationStep(1);
      }
      setErrors({});
      setShowDeleteConfirm(false);
      setShowRegenerateConfirm(false);
    }
  }, [isOpen, member, locations, services, memberServiceIds]);

  // When location changes, remove services that are no longer available
  useEffect(() => {
    if (!isOpen) return;

    setFormData((prev) => {
      const stillAvailableServiceIds = prev.serviceIds.filter((serviceId) => {
        const service = services.find((s) => s.id === serviceId);
        if (!service) return false;
        return service.locationIds.includes(prev.locationId);
      });

      if (stillAvailableServiceIds.length !== prev.serviceIds.length) {
        return { ...prev, serviceIds: stillAvailableServiceIds };
      }
      return prev;
    });
  }, [isOpen, formData.locationId, services]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      // Only use null for phone field when empty, keep empty string for other fields
      [name]: name === 'phone' ? (value || null) : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleLocationSelect = (locationId: string) => {
    setFormData((prev) => ({ ...prev, locationId }));
    setErrors((prev) => ({ ...prev, locationId: '' }));
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData((prev) => {
      const newServiceIds = prev.serviceIds.includes(serviceId)
        ? prev.serviceIds.filter((id) => id !== serviceId)
        : [...prev.serviceIds, serviceId];
      return { ...prev, serviceIds: newServiceIds };
    });
  };

  const validateStep1 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
    }

    if (!formData.email?.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "L'email n'est pas valide";
    }

    if (formData.phone && !/^(\+33|0)[1-9](\d{2}){4}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Le numéro de téléphone n\'est pas valide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.locationId) {
      newErrors.locationId = 'Un lieu doit être sélectionné';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate = (): boolean => {
    return validateStep1() && validateStep2();
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setCreationStep(2);
    }
  };

  const handlePrevStep = () => {
    setCreationStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For creation mode step 1, go to next step instead of submitting
    if (!isEditing && creationStep === 1) {
      handleNextStep();
      return;
    }

    if (!validate()) return;

    setLoading(true);
    try {
      await onSave(formData);
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
    if (!member || !onDelete) return;

    // Check for upcoming bookings
    if (upcomingBookingsCount > 0) {
      setErrors({
        submit: `Ce membre a ${upcomingBookingsCount} rendez-vous à venir. Veuillez les réassigner ou les annuler avant de supprimer ce membre.`,
      });
      setShowDeleteConfirm(false);
      return;
    }

    setDeleting(true);
    try {
      await onDelete(member.id);
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

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      toast.success('Code copié dans le presse-papier');
    } catch {
      toast.error('Erreur lors de la copie');
    }
  };

  const handleSendEmail = async () => {
    if (!member || !onSendCode) return;

    setSendingEmail(true);
    try {
      await onSendCode(member.id);
      toast.success('Email envoyé avec succès');
    } catch (error) {
      console.error('Send email error:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleRegenerateCode = async () => {
    if (!member || !onRegenerateCode) return;

    setRegenerating(true);
    try {
      const newCode = await onRegenerateCode(member.id);
      setCurrentCode(newCode);
      toast.success('Code régénéré avec succès');
      setShowRegenerateConfirm(false);
    } catch (error) {
      console.error('Regenerate code error:', error);
      toast.error('Erreur lors de la régénération du code');
    } finally {
      setRegenerating(false);
    }
  };

  // Tab definitions for editing mode
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Informations', icon: <User className="w-4 h-4" /> },
    { id: 'assignments', label: 'Lieux & Prestations', icon: <MapPin className="w-4 h-4" /> },
    { id: 'code', label: 'Code', icon: <Key className="w-4 h-4" /> },
  ];

  // JSX for Info section (inline to preserve focus)
  const infoContent = (
    <div className="space-y-4">
      {/* Name */}
      <Input
        label="Nom"
        name="name"
        value={formData.name}
        onChange={handleChange}
        placeholder="Ex: Marie Dupont"
        error={errors.name}
        required
      />

      {/* Email */}
      <Input
        label="Email"
        name="email"
        type="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="marie.dupont@example.com"
        error={errors.email}
        required
      />

      {/* Phone */}
      <Input
        label="Téléphone"
        name="phone"
        type="tel"
        value={formData.phone || ''}
        onChange={handleChange}
        placeholder="06 12 34 56 78"
        error={errors.phone}
        hint="Optionnel"
      />
    </div>
  );

  // JSX for Assignments section (inline to preserve focus)
  const assignmentsContent = (
    <div className="space-y-5">
      {/* Location single select (NOUVEAU MODÈLE: 1 membre = 1 lieu) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Lieu assigné <span className="text-error-500">*</span>
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Chaque membre est associé à un seul lieu
        </p>
        <div className="space-y-2 max-h-36 overflow-y-auto">
          {activeLocations.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              Aucun lieu actif disponible
            </p>
          ) : (
            activeLocations.map((location) => (
              <label
                key={location.id}
                className={`
                  flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                  ${formData.locationId === location.id
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <input
                  type="radio"
                  name="location"
                  checked={formData.locationId === location.id}
                  onChange={() => handleLocationSelect(location.id)}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {location.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {location.city}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
        {errors.locationId && (
          <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">
            {errors.locationId}
          </p>
        )}
      </div>

      {/* Services multi-select */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Prestations assignées
        </label>
        {!formData.locationId ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center flex items-center justify-center gap-2">
              <Scissors className="w-4 h-4" />
              Sélectionnez d&apos;abord un lieu
            </p>
          </div>
        ) : availableServices.length === 0 ? (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Aucune prestation disponible pour ce lieu
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {availableServices.map((service) => {
              const locationName = getServiceLocationName(service);
              return (
                <label
                  key={service.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                    ${formData.serviceIds.includes(service.id)
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={formData.serviceIds.includes(service.id)}
                    onChange={() => handleServiceToggle(service.id)}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {service.name}
                    </p>
                    {locationName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {locationName}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {service.duration} min
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // JSX for Code section (inline to preserve focus)
  const codeContent = (
    <div className="space-y-4">
      {currentCode ? (
        <>
          {/* Code display */}
          <div className="flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
            <span className="text-3xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
              {currentCode}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
            >
              <Copy className="w-4 h-4 mr-1.5" />
              Copier
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendEmail}
              disabled={sendingEmail}
            >
              {sendingEmail ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-1.5" />
              )}
              Envoyer par email
            </Button>

            {showRegenerateConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Confirmer ?</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRegenerateConfirm(false)}
                  disabled={regenerating}
                >
                  Non
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateCode}
                  disabled={regenerating}
                  className="text-warning-600 hover:text-warning-700"
                >
                  {regenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Oui'
                  )}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowRegenerateConfirm(true)}
                className="text-warning-600 border-warning-300 hover:bg-warning-50"
              >
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Régénérer
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ce code permet au membre d&apos;accéder à son planning sur la page /planning
          </p>
        </>
      ) : (
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-center">
          <Key className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Le code d&apos;accès sera généré automatiquement lors de la création
          </p>
        </div>
      )}
    </div>
  );

  // Render modal content based on mode
  const renderContent = () => {
    if (isEditing) {
      // Editing mode: Tab system
      return (
        <>
          {/* Tab navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}
                `}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[280px]">
            {activeTab === 'info' && infoContent}
            {activeTab === 'assignments' && assignmentsContent}
            {activeTab === 'code' && codeContent}
          </div>
        </>
      );
    } else {
      // Creation mode: Two-step wizard
      return (
        <>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
              ${creationStep >= 1 ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}
            `}>
              1
            </div>
            <div className={`w-12 h-0.5 ${creationStep >= 2 ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            <div className={`
              flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
              ${creationStep >= 2 ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}
            `}>
              2
            </div>
          </div>

          {/* Step title */}
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
            {creationStep === 1 ? 'Informations du membre' : 'Lieux et prestations'}
          </p>

          {/* Step content */}
          <div className="min-h-[240px]">
            {creationStep === 1 && infoContent}
            {creationStep === 2 && assignmentsContent}
          </div>
        </>
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden max-h-[inherit]">
        <ModalHeader
          title={isEditing ? 'Modifier le membre' : 'Nouveau membre'}
          onClose={onClose}
        />

        <ModalBody>
          {renderContent()}

          {/* Error message */}
          {errors.submit && (
            <div className="mt-4 p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errors.submit}</span>
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {isEditing ? (
            <>
              {/* Delete button (editing only) */}
              {onDelete && (
                <div className="flex-1">
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Confirmer ?</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleting}
                      >
                        Non
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="text-error-600 hover:text-error-700"
                      >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oui, supprimer'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-error-600 hover:text-error-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  )}
                </div>
              )}

              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Annuler
              </Button>

              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mise à jour...
                  </>
                ) : (
                  'Mettre à jour'
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Creation mode navigation */}
              {creationStep === 1 ? (
                <>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Annuler
                  </Button>
                  <Button type="submit">
                    Suivant
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={handlePrevStep}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Retour
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création...
                      </>
                    ) : (
                      'Créer le membre'
                    )}
                  </Button>
                </>
              )}
            </>
          )}
        </ModalFooter>
      </form>
    </Modal>
  );
}
