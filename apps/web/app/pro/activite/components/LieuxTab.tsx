'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import { locationService } from '@booking-app/firebase';
import { Plus, MapPin, Loader2 } from 'lucide-react';
import { LocationCard } from './LocationCard';
import { LocationModal, type LocationFormData } from './LocationModal';
import type { Location } from '@booking-app/shared';
import { PLAN_LIMITS } from '@booking-app/shared';
import { UpgradeTeamModal } from '@/components/modals/UpgradeTeamModal';

type WithId<T> = { id: string } & T;

export function LieuxTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WithId<Location> | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Plan location limit check
  const plan = provider?.plan || 'trial';
  const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? null;
  const maxLocations = planLimits?.maxLocations ?? Infinity;
  const activeLocations = locations.filter((l) => l.isActive);
  const isAtLocationLimit = activeLocations.length >= maxLocations;
  const isSoloPlan = plan === 'solo' || plan === 'trial';

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const locationsData = await locationService.getByProvider(provider.id);
      // Sort: default first, then by name
      setLocations(
        locationsData.sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return a.name.localeCompare(b.name);
        })
      );
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des lieux');
    } finally {
      setLoading(false);
    }
  }, [provider, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle active status
  const handleToggleActive = async (locationId: string, isActive: boolean) => {
    if (!provider) return;

    // Check plan limit before reactivating
    if (isActive && isAtLocationLimit) {
      toast.error(
        isSoloPlan
          ? 'Passez au plan Studio pour réactiver ce lieu'
          : `Limite de ${maxLocations} lieux actifs atteinte`
      );
      return;
    }

    // Optimistic update
    setLocations((prev) =>
      prev.map((l) => (l.id === locationId ? { ...l, isActive } : l))
    );

    try {
      if (isActive) {
        await locationService.reactivateLocation(provider.id, locationId);
      } else {
        await locationService.deactivateLocation(provider.id, locationId);
      }
      toast.success(isActive ? 'Lieu activé' : 'Lieu désactivé');
    } catch (error) {
      console.error('Toggle error:', error);
      // Revert on error
      setLocations((prev) =>
        prev.map((l) => (l.id === locationId ? { ...l, isActive: !isActive } : l))
      );
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };

  // Set as default
  const handleSetDefault = async (locationId: string) => {
    if (!provider) return;

    try {
      await locationService.setDefault(provider.id, locationId);
      toast.success('Lieu principal mis à jour');
      await fetchData();
    } catch (error) {
      console.error('Set default error:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };

  // Save location (create or update)
  const handleSaveLocation = async (data: LocationFormData) => {
    if (!provider) return;

    if (editingLocation) {
      // Update
      await locationService.updateLocation(provider.id, editingLocation.id, {
        name: data.name,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        description: data.description,
        type: data.type,
        travelRadius: data.travelRadius,
        geopoint: data.geopoint ?? null,
      });

      // If setting as default
      if (data.isDefault && !editingLocation.isDefault) {
        await locationService.setDefault(provider.id, editingLocation.id);
      }

      toast.success('Lieu mis à jour');
    } else {
      // Create
      const newLocation = await locationService.createLocation(provider.id, {
        name: data.name,
        address: data.address,
        postalCode: data.postalCode,
        city: data.city,
        country: 'France',
        description: data.description,
        photoURLs: [],
        type: data.type,
        travelRadius: data.travelRadius,
        geopoint: data.geopoint ?? null,
      });

      // If setting as default
      if (data.isDefault) {
        await locationService.setDefault(provider.id, newLocation.id);
      }

      toast.success('Lieu créé');
    }

    await fetchData();
  };

  // Delete location
  const handleDeleteLocation = async (locationId: string) => {
    if (!provider) return;

    await locationService.deleteLocation(provider.id, locationId);
    toast.success('Lieu supprimé');
    await fetchData();
  };

  // Open modal for creating
  const handleCreate = () => {
    setEditingLocation(null);
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (location: WithId<Location>) => {
    setEditingLocation(location);
    setModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingLocation(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vos lieux</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gérez les adresses où vous exercez
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={isAtLocationLimit ? () => setUpgradeModalOpen(true) : handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
          {isAtLocationLimit && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {isSoloPlan
                ? 'Passez au plan Studio pour ajouter des lieux'
                : `Limite de ${maxLocations} lieux atteinte`}
            </p>
          )}
        </div>
      </div>

      {/* Locations list */}
      {locations.length === 0 ? (
        <EmptyState onAdd={handleCreate} disabled={isAtLocationLimit} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              onToggleActive={handleToggleActive}
              onSetDefault={handleSetDefault}
              onClick={() => handleEdit(location)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <LocationModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        location={editingLocation}
        onSave={handleSaveLocation}
        onDelete={handleDeleteLocation}
      />

      {/* Upgrade modal */}
      <UpgradeTeamModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        context="locations"
      />
    </div>
  );
}

// Empty state component
function EmptyState({ onAdd, disabled }: { onAdd: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
        <MapPin className="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Aucun lieu
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-sm">
        Ajoutez votre premier lieu pour indiquer ou vous exercez vos prestations.
      </p>
      <Button onClick={onAdd} disabled={disabled}>
        <Plus className="w-4 h-4 mr-2" />
        Ajouter mon premier lieu
      </Button>
    </div>
  );
}
