'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import { catalogService, locationService, memberService } from '@booking-app/firebase';
import { Plus, FolderPlus, Pencil, ChevronDown, ChevronRight, Scissors, Loader2 } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { ServiceModal, type ServiceFormData } from './ServiceModal';
import { CategoryModal, type CategoryFormData } from './CategoryModal';
import type { Service, ServiceCategory, Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export function PrestationsTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [categories, setCategories] = useState<WithId<ServiceCategory>[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<WithId<Service> | null>(null);

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<WithId<ServiceCategory> | null>(null);

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const isTeamPlan = provider?.plan === 'team';


  // Fetch data
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [servicesData, locationsData, membersData, categoriesData] = await Promise.all([
        catalogService.getByProvider(provider.id),
        locationService.getByProvider(provider.id),
        isTeamPlan ? memberService.getByProvider(provider.id) : Promise.resolve([]),
        catalogService.getCategoriesByProvider(provider.id),
      ]);

      // Sort by sortOrder
      setServices(servicesData.sort((a, b) => a.sortOrder - b.sortOrder));
      setLocations(locationsData);
      setMembers(membersData);
      setCategories(categoriesData.sort((a, b) => a.sortOrder - b.sortOrder));
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
      toast.error('Erreur lors de la réorganisation');
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

  // ─── Category handlers ──────────────────────────────────────────

  const handleCreateCategory = async (data: CategoryFormData) => {
    if (!provider) return;

    await catalogService.createCategory(provider.id, data);
    toast.success('Catégorie créée');
    await fetchData();
  };

  const handleUpdateCategory = async (data: CategoryFormData) => {
    if (!provider || !editingCategory) return;

    await catalogService.updateCategory(provider.id, editingCategory.id, data);
    toast.success('Catégorie mise à jour');
    await fetchData();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!provider) return;

    await catalogService.deleteCategory(provider.id, categoryId);
    toast.success('Catégorie supprimée');
    await fetchData();
  };

  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCategoryModalOpen(true);
  };

  const handleEditCategory = (category: WithId<ServiceCategory>) => {
    setEditingCategory(category);
    setCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const toggleCategoryCollapse = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // ─── Grouping logic ─────────────────────────────────────────────

  const hasCategories = categories.length > 0;

  const getServicesByCategory = () => {
    if (!hasCategories) return null;

    const categoryIds = new Set(categories.map((c) => c.id));
    const grouped: Record<string, WithId<Service>[]> = {};

    // Initialize groups for each category
    for (const cat of categories) {
      grouped[cat.id] = [];
    }

    // Uncategorized bucket
    const uncategorized: WithId<Service>[] = [];

    for (const service of services) {
      if (service.categoryId && categoryIds.has(service.categoryId)) {
        grouped[service.categoryId].push(service);
      } else {
        uncategorized.push(service);
      }
    }

    return { grouped, uncategorized };
  };

  // ─── Render helpers ─────────────────────────────────────────────

  const renderServiceList = (list: WithId<Service>[]) => (
    <div className="space-y-3">
      {list.map((service, index) => (
        <ServiceCard
          key={service.id}
          service={service}
          onToggleActive={handleToggleActive}
          onClick={() => handleEdit(service)}
          onMoveUp={() => handleMove(service.id, 'up')}
          onMoveDown={() => handleMove(service.id, 'down')}
          canMoveUp={index > 0}
          canMoveDown={index < list.length - 1}
          showOrder={list.length > 1}
          orderNumber={index + 1}
        />
      ))}
    </div>
  );

  const renderCategorySection = (category: WithId<ServiceCategory>, categoryServices: WithId<Service>[]) => {
    const isCollapsed = collapsedCategories.has(category.id);

    return (
      <div key={category.id} className="space-y-3">
        {/* Category header */}
        <div className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => toggleCategoryCollapse(category.id)}
            className="flex items-center gap-2 flex-1 min-w-0 group"
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 flex-shrink-0" />
            )}
            <span className="font-semibold text-gray-900 dark:text-white truncate">
              {category.name}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
              ({categoryServices.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleEditCategory(category)}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label={`Modifier la catégorie ${category.name}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {/* Category services */}
        {!isCollapsed && (
          categoryServices.length > 0 ? (
            renderServiceList(categoryServices)
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic pl-7">
              Aucune prestation dans cette catégorie
            </p>
          )
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  const groupedData = getServicesByCategory();

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleOpenCreateCategory}>
            <FolderPlus className="w-4 h-4 mr-2" />
            Nouvelle catégorie
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Services list */}
      {services.length === 0 ? (
        <EmptyState onAdd={handleCreate} />
      ) : groupedData ? (
        // Grouped by category
        <div className="space-y-6">
          {categories.map((category) =>
            renderCategorySection(category, groupedData.grouped[category.id] || [])
          )}

          {/* Uncategorized services */}
          {groupedData.uncategorized.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 py-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  Autres prestations
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({groupedData.uncategorized.length})
                </span>
              </div>
              {renderServiceList(groupedData.uncategorized)}
            </div>
          )}
        </div>
      ) : (
        // Flat list (no categories)
        renderServiceList(services)
      )}

      {/* Service Modal */}
      <ServiceModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        service={editingService}
        locations={locations}
        members={members}
        categories={categories}
        isTeamPlan={isTeamPlan}
        onSave={handleSaveService}
        onDelete={handleDeleteService}
      />

      {/* Category Modal */}
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={handleCloseCategoryModal}
        category={editingCategory}
        onSave={editingCategory ? handleUpdateCategory : handleCreateCategory}
        onDelete={handleDeleteCategory}
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
