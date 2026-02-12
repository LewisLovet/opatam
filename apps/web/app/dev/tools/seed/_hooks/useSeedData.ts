'use client';

import { useState, useCallback } from 'react';
import {
  db,
  providerSubcollections,
  collections,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from '@booking-app/firebase';
import { generateRandomProviders, type GeneratedProvider } from '../_data/random-generator';
import { formatLogTime } from '../_lib/seed-utils';

// Préfixe pour identifier les providers de test
const TEST_PREFIX = 'test-seed-';

export interface SeedLog {
  time: string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface SeedStats {
  providersCreated: number;
  servicesCreated: number;
  membersCreated: number;
  locationsCreated: number;
  availabilitiesCreated: number;
}

export interface UseSeedDataReturn {
  // State
  isCreating: boolean;
  isDeleting: boolean;
  logs: SeedLog[];
  stats: SeedStats;
  existingTestProviders: string[];
  providerCount: number;

  // Actions
  createTestData: () => Promise<void>;
  deleteTestData: () => Promise<void>;
  checkExistingTestData: () => Promise<void>;
  setProviderCount: (count: number) => void;
  clearLogs: () => void;
}

// Fonction pour générer un slug
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function useSeedData(): UseSeedDataReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logs, setLogs] = useState<SeedLog[]>([]);
  const [stats, setStats] = useState<SeedStats>({
    providersCreated: 0,
    servicesCreated: 0,
    membersCreated: 0,
    locationsCreated: 0,
    availabilitiesCreated: 0,
  });
  const [existingTestProviders, setExistingTestProviders] = useState<string[]>([]);
  const [providerCount, setProviderCount] = useState(10);

  const addLog = useCallback((type: SeedLog['type'], message: string) => {
    setLogs((prev) => [...prev, { time: formatLogTime(), type, message }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /**
   * Vérifie si des providers de test existent déjà
   */
  const checkExistingTestData = useCallback(async () => {
    try {
      const providersRef = collections.providers();
      const snapshot = await getDocs(providersRef);

      const testProviderIds = snapshot.docs
        .filter((doc) => doc.id.startsWith(TEST_PREFIX))
        .map((doc) => doc.id);

      setExistingTestProviders(testProviderIds);
    } catch (error) {
      console.error('Error checking existing test data:', error);
    }
  }, []);

  /**
   * Crée un provider de test complet avec toutes ses sous-collections
   */
  const createSingleProvider = async (provider: GeneratedProvider): Promise<void> => {
    const providerId = provider.id;
    const slug = slugify(provider.businessName);

    // 1. Créer le document provider
    const providerRef = doc(db, 'providers', providerId);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    await setDoc(providerRef, {
      userId: providerId,
      businessName: provider.businessName,
      description: provider.description,
      category: provider.category,
      slug,
      photoURL: provider.photoURL,
      coverPhotoURL: provider.coverPhotoURL,
      portfolioPhotos: [],
      socialLinks: {
        instagram: null,
        facebook: null,
        tiktok: null,
        website: null,
      },
      rating: provider.rating,
      settings: {
        reminderTimes: [24, 2],
        requiresConfirmation: false,
        defaultBufferTime: 15,
        timezone: 'Europe/Paris',
        minBookingNotice: 2,
        maxBookingAdvance: 60,
        allowClientCancellation: true,
        cancellationDeadline: 24,
      },
      subscription: {
        plan: 'trial',
        tier: 'standard',
        memberCount: 1,
        validUntil: Timestamp.fromDate(trialEndDate),
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        status: 'trialing',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      plan: 'trial',
      isPublished: true,
      isVerified: false,
      cities: [provider.city.toLowerCase()],
      minPrice: Math.min(...provider.services.map(s => s.price)),
      nextAvailableSlot: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    addLog('success', `Provider créé: ${provider.businessName} (${provider.city})`);

    // 2. Créer la location (avant le membre car on a besoin du locationId)
    const locationId = `${providerId}-loc1`;
    const locationRef = doc(providerSubcollections.locations(providerId), locationId);

    await setDoc(locationRef, {
      name: provider.businessName,
      address: provider.address,
      city: provider.city,
      postalCode: provider.postalCode,
      geopoint: {
        latitude: provider.latitude,
        longitude: provider.longitude,
      },
      description: null,
      type: 'fixed',
      travelRadius: null,
      isDefault: true,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    addLog('info', `  - Location: ${provider.address}, ${provider.city}`);

    // 3. Créer le membre propriétaire
    const memberId = `${providerId}-owner`;
    const memberRef = doc(providerSubcollections.members(providerId), memberId);

    await setDoc(memberRef, {
      name: provider.ownerName,
      email: provider.email,
      phone: provider.phone,
      photoURL: provider.photoURL,
      accessCode: provider.accessCode,
      locationId: locationId,
      isDefault: true,
      isActive: true,
      sortOrder: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    addLog('info', `  - Membre: ${provider.ownerName}`);

    // 4. Créer les services
    for (let i = 0; i < provider.services.length; i++) {
      const service = provider.services[i];
      const serviceId = `${providerId}-svc${i}`;

      const serviceRef = doc(providerSubcollections.services(providerId), serviceId);
      await setDoc(serviceRef, {
        name: service.name,
        description: service.description,
        duration: service.duration,
        price: service.price,
        bufferTime: 15,
        isActive: true,
        memberIds: [memberId],
        locationIds: [locationId],
        sortOrder: i,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    addLog('info', `  - ${provider.services.length} services créés`);

    // 5. Créer les disponibilités
    for (const daySchedule of provider.schedule) {
      const availabilityId = `${memberId}-${locationId}-${daySchedule.dayOfWeek}`;
      const availabilityRef = doc(providerSubcollections.availability(providerId), availabilityId);

      await setDoc(availabilityRef, {
        memberId,
        locationId,
        dayOfWeek: daySchedule.dayOfWeek,
        isOpen: daySchedule.isOpen,
        slots: daySchedule.slots,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    addLog('info', `  - 7 disponibilités créées`);

    // Mettre à jour les stats
    setStats((prev) => ({
      providersCreated: prev.providersCreated + 1,
      servicesCreated: prev.servicesCreated + provider.services.length,
      membersCreated: prev.membersCreated + 1,
      locationsCreated: prev.locationsCreated + 1,
      availabilitiesCreated: prev.availabilitiesCreated + 7,
    }));
  };

  /**
   * Crée les providers de test aléatoires
   */
  const createTestData = useCallback(async () => {
    setIsCreating(true);
    setStats({
      providersCreated: 0,
      servicesCreated: 0,
      membersCreated: 0,
      locationsCreated: 0,
      availabilitiesCreated: 0,
    });
    clearLogs();

    addLog('info', `Génération de ${providerCount} providers aléatoires...`);

    try {
      // Générer les providers aléatoires
      const providers = generateRandomProviders(providerCount);

      addLog('info', `Début de la création dans Firestore...`);

      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        addLog('info', `[${i + 1}/${providers.length}] ${provider.businessName}...`);

        try {
          await createSingleProvider(provider);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
          addLog('error', `Erreur pour ${provider.businessName}: ${errorMessage}`);
        }
      }

      addLog('success', `Création terminée ! ${providerCount} providers créés.`);
      await checkExistingTestData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      addLog('error', `Erreur globale: ${errorMessage}`);
    } finally {
      setIsCreating(false);
    }
  }, [providerCount, addLog, clearLogs, checkExistingTestData]);

  /**
   * Supprime un provider de test et toutes ses sous-collections
   */
  const deleteSingleProvider = async (providerId: string): Promise<void> => {
    // 1. Supprimer les membres
    const membersSnapshot = await getDocs(providerSubcollections.members(providerId));
    for (const memberDoc of membersSnapshot.docs) {
      await deleteDoc(memberDoc.ref);
    }

    // 2. Supprimer les locations
    const locationsSnapshot = await getDocs(providerSubcollections.locations(providerId));
    for (const locationDoc of locationsSnapshot.docs) {
      await deleteDoc(locationDoc.ref);
    }

    // 3. Supprimer les services
    const servicesSnapshot = await getDocs(providerSubcollections.services(providerId));
    for (const serviceDoc of servicesSnapshot.docs) {
      await deleteDoc(serviceDoc.ref);
    }

    // 4. Supprimer les disponibilités
    const availabilitySnapshot = await getDocs(providerSubcollections.availability(providerId));
    for (const availDoc of availabilitySnapshot.docs) {
      await deleteDoc(availDoc.ref);
    }

    // 5. Supprimer le provider
    const providerRef = doc(db, 'providers', providerId);
    await deleteDoc(providerRef);
  };

  /**
   * Supprime tous les providers de test
   */
  const deleteTestData = useCallback(async () => {
    setIsDeleting(true);
    clearLogs();

    addLog('info', 'Recherche des providers de test...');

    try {
      const providersRef = collections.providers();
      const snapshot = await getDocs(providersRef);

      const testProviders = snapshot.docs.filter((doc) => doc.id.startsWith(TEST_PREFIX));

      if (testProviders.length === 0) {
        addLog('warning', 'Aucun provider de test trouvé.');
        return;
      }

      addLog('info', `${testProviders.length} providers de test trouvés. Suppression...`);

      for (let i = 0; i < testProviders.length; i++) {
        const providerDoc = testProviders[i];
        const providerData = providerDoc.data();

        addLog('info', `[${i + 1}/${testProviders.length}] Suppression de ${providerData.businessName}...`);

        try {
          await deleteSingleProvider(providerDoc.id);
          addLog('success', `  - ${providerData.businessName} supprimé`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
          addLog('error', `Erreur pour ${providerData.businessName}: ${errorMessage}`);
        }
      }

      addLog('success', 'Suppression terminée !');
      setExistingTestProviders([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      addLog('error', `Erreur globale: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  }, [addLog, clearLogs]);

  return {
    isCreating,
    isDeleting,
    logs,
    stats,
    existingTestProviders,
    providerCount,
    createTestData,
    deleteTestData,
    checkExistingTestData,
    setProviderCount,
    clearLogs,
  };
}
