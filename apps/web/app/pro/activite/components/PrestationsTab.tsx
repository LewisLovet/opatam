'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import { catalogService, locationService, memberService } from '@booking-app/firebase';
import { Plus, Scissors, Loader2 } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { ServiceModal, type ServiceFormData } from './ServiceModal';
import type { Service, Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export function PrestationsTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<WithId<Service> | null>(null);

  const isTeamPlan = provider?.plan === 'team';


  // Fetch data
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [servicesData, locationsData, membersData] = await Promise.all([
        catalogService.getByProvider(provider.id),
        locationService.getByProvider(provider.id),
        isTeamPlan ? memberService.getByProvider(provider.id) : Promise.resolve([]),
      ]);

      // Sort by sortOrder
      setServices(servicesData.sort((a, b) => a.sortOrder - b.sortOrder));
      setLocations(locationsData);
      setMembers(membersData);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des prestations');
    } finally {
      setLoading(false);
    }
  }, [provider, isTeamPlan, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Move service up or down
  const handleMove = async (serviceId: string, direction: 'up' | 'down') => {
    if (!provider) return;

    const currentIndex = services.findIndex((s) => s.id === serviceId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= services.length) return;

    // Swap services
    const newServices = [...services];
    [newServices[currentIndex], newServices[newIndex]] = [newServices[newIndex], newServices[currentIndex]];

    // Optimistic update
    setServices(newServices);

    // Update backend
    try {
      const orderedIds = newServices.map((s) => s.id);
      await catalogService.reorderServices(provider.id, orderedIds);
    } catch (error) {
      console.error('Reorder error:', error);
      // Revert on error
      setServices(services);
      toast.error('Erreur lors de la reorganisation');
    }
  };

  // Toggle active status
  const handleToggleActive = async (serviceId: string, isActive: boolean) => {
    if (!provider) return;

    // Optimistic update
    setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, isActive } : s)));

    try {
      if (isActive) {
        await catalogService.reactivateService(provider.id, serviceId);
      } else {
        await catalogService.deactivateService(provider.id, serviceId);
      }
      toast.success(isActive ? 'Prestation activée' : 'Prestation désactivée');
    } catch (error) {
      console.error('Toggle error:', error);
      // Revert on error
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, isActive: !isActive } : s)));
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
    }
  };

  // Save service (create or update)
  const handleSaveService = async (data: ServiceFormData) => {
    if (!provider) return;

    if (editingService) {
      // Update
      await catalogService.updateService(provider.id, editingService.id, data);
      toast.success('Prestation mise à jour');
    } else {
      // Create - add required default values
      await catalogService.createService(provider.id, {
        ...data,
        isOnline: false,
        requiresDeposit: false,
      });
      toast.success('Prestation créée');
    }

    await fetchData();
  };

  // Delete service
  const handleDeleteService = async (serviceId: string) => {
    if (!provider) return;

    await catalogService.deleteService(provider.id, serviceId);
    toast.success('Prestation supprimée');
    await fetchData();
  };

  // Open modal for creating
  const handleCreate = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  // Open modal for editing
  const handleEdit = (service: WithId<Service>) => {
    setEditingService(service);
    setModalOpen(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingService(null);
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vos prestations</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gérez les services que vous proposez
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {/* Services list */}
      {services.length === 0 ? (
        <EmptyState onAdd={handleCreate} />
      ) : (
        <div className="space-y-3">
          {services.map((service, index) => (
            <ServiceCard
              key={service.id}
              service={service}
              onToggleActive={handleToggleActive}
              onClick={() => handleEdit(service)}
              onMoveUp={() => handleMove(service.id, 'up')}
              onMoveDown={() => handleMove(service.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < services.length - 1}
              showOrder={services.length > 1}
              orderNumber={index + 1}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <ServiceModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        service={editingService}
        locations={locations}
        members={members}
        isTeamPlan={isTeamPlan}
        onSave={handleSaveService}
        onDelete={handleDeleteService}
      />
    </div>
  );
}

// Empty state component
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
        <Scissors className="w-8 h-8 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Aucune prestation
      </h3>
      <p className="text-gray-500 dark:text-gray-400 text-center mb-6 max-w-sm">
        Commencez par créer votre première prestation pour que vos clients puissent réserver.
      </p>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4 mr-2" />
        Créer ma première prestation
      </Button>
    </div>
  );
}
