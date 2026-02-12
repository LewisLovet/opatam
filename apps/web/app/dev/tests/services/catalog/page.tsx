'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { catalogService, serviceRepository } from '@booking-app/firebase';

export default function CatalogServiceTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Form states
  const [providerId, setProviderId] = useState('');
  const [serviceId, setServiceId] = useState('');

  // Create form
  const [createName, setCreateName] = useState('Coupe Homme');
  const [createDescription, setCreateDescription] = useState('Coupe classique homme');
  const [createDuration, setCreateDuration] = useState('30');
  const [createPrice, setCreatePrice] = useState('2500'); // en centimes = 25€
  const [createBufferTime, setCreateBufferTime] = useState('5');
  const [createLocationIds, setCreateLocationIds] = useState('');

  // Update form
  const [updateName, setUpdateName] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');
  const [updateDuration, setUpdateDuration] = useState('');
  const [updatePrice, setUpdatePrice] = useState('');

  // Filter form
  const [filterLocationId, setFilterLocationId] = useState('');
  const [filterMemberId, setFilterMemberId] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');

  const executeAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setLastAction(action);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = () =>
    executeAction('CREATE SERVICE', async () => {
      if (!providerId) throw new Error('Provider ID requis');

      const locationIds = createLocationIds
        ? createLocationIds.split(',').map((id) => id.trim()).filter(Boolean)
        : [];

      const service = await catalogService.createService(providerId, {
        name: createName,
        description: createDescription || undefined,
        duration: parseInt(createDuration, 10),
        price: parseInt(createPrice, 10),
        bufferTime: createBufferTime ? parseInt(createBufferTime, 10) : 0,
        locationIds,
        isOnline: false,
        requiresDeposit: false,
      });
      setServiceId(service.id);
      return {
        message: 'Prestation créée avec succès',
        service: {
          id: service.id,
          name: service.name,
          duration: service.duration,
          price: service.price,
          priceFormatted: `${(service.price / 100).toFixed(2)}€`,
          locationIds: service.locationIds,
        },
      };
    });

  const handleUpdateService = () =>
    executeAction('UPDATE SERVICE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');

      const updateData: Record<string, unknown> = {};
      if (updateName) updateData.name = updateName;
      if (updateDescription) updateData.description = updateDescription;
      if (updateDuration) updateData.duration = parseInt(updateDuration, 10);
      if (updatePrice) updateData.price = parseInt(updatePrice, 10);

      if (Object.keys(updateData).length === 0) {
        throw new Error('Au moins un champ à modifier');
      }

      await catalogService.updateService(providerId, serviceId, updateData);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Prestation mise à jour',
        service,
      };
    });

  const handleDeleteService = () =>
    executeAction('DELETE SERVICE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      await catalogService.deleteService(providerId, serviceId);
      return {
        message: 'Prestation supprimée',
        deletedId: serviceId,
      };
    });

  const handleDeactivateService = () =>
    executeAction('DEACTIVATE SERVICE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      await catalogService.deactivateService(providerId, serviceId);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Prestation désactivée',
        isActive: service?.isActive,
      };
    });

  const handleReactivateService = () =>
    executeAction('REACTIVATE SERVICE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      await catalogService.reactivateService(providerId, serviceId);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Prestation réactivée',
        isActive: service?.isActive,
      };
    });

  const handleDuplicateService = () =>
    executeAction('DUPLICATE SERVICE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      const newService = await catalogService.duplicateService(providerId, serviceId);
      return {
        message: 'Prestation dupliquée',
        originalId: serviceId,
        newService: {
          id: newService.id,
          name: newService.name,
          isActive: newService.isActive,
        },
      };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      const service = await catalogService.getById(providerId, serviceId);
      if (!service) {
        return { message: 'Prestation non trouvée' };
      }
      return {
        message: 'Prestation trouvée',
        service: {
          ...service,
          priceFormatted: `${(service.price / 100).toFixed(2)}€`,
        },
      };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const services = await catalogService.getByProvider(providerId);
      return {
        count: services.length,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration,
          price: `${(s.price / 100).toFixed(2)}€`,
          isActive: s.isActive,
          locationIds: s.locationIds,
        })),
      };
    });

  const handleGetActiveByProvider = () =>
    executeAction('GET ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const services = await catalogService.getActiveByProvider(providerId);
      return {
        count: services.length,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          duration: s.duration,
          price: `${(s.price / 100).toFixed(2)}€`,
        })),
      };
    });

  const handleGetByLocation = () =>
    executeAction('GET BY LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!filterLocationId) throw new Error('Location ID requis');
      const services = await catalogService.getByLocation(providerId, filterLocationId);
      return {
        count: services.length,
        locationId: filterLocationId,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          price: `${(s.price / 100).toFixed(2)}€`,
        })),
      };
    });

  const handleGetByMember = () =>
    executeAction('GET BY MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!filterMemberId) throw new Error('Member ID requis');
      const services = await catalogService.getByMember(providerId, filterMemberId);
      return {
        count: services.length,
        memberId: filterMemberId,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          price: `${(s.price / 100).toFixed(2)}€`,
        })),
      };
    });

  const handleGetByPriceRange = () =>
    executeAction('GET BY PRICE RANGE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!filterMinPrice || !filterMaxPrice) throw new Error('Prix min et max requis');
      const minPrice = parseInt(filterMinPrice, 10);
      const maxPrice = parseInt(filterMaxPrice, 10);
      const services = await catalogService.getByPriceRange(providerId, minPrice, maxPrice);
      return {
        count: services.length,
        priceRange: `${(minPrice / 100).toFixed(2)}€ - ${(maxPrice / 100).toFixed(2)}€`,
        services: services.map((s) => ({
          id: s.id,
          name: s.name,
          price: `${(s.price / 100).toFixed(2)}€`,
        })),
      };
    });

  const handleAddLocation = () =>
    executeAction('ADD LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      if (!filterLocationId) throw new Error('Location ID requis');
      await catalogService.addLocation(providerId, serviceId, filterLocationId);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Location ajoutée',
        locationIds: service?.locationIds,
      };
    });

  const handleRemoveLocation = () =>
    executeAction('REMOVE LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      if (!filterLocationId) throw new Error('Location ID requis');
      await catalogService.removeLocation(providerId, serviceId, filterLocationId);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Location retirée',
        locationIds: service?.locationIds,
      };
    });

  const handleAddMember = () =>
    executeAction('ADD MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      if (!filterMemberId) throw new Error('Member ID requis');
      await catalogService.addMember(providerId, serviceId, filterMemberId);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Membre ajouté',
        memberIds: service?.memberIds,
      };
    });

  const handleRemoveMember = () =>
    executeAction('REMOVE MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      if (!filterMemberId) throw new Error('Member ID requis');
      await catalogService.removeMember(providerId, serviceId, filterMemberId);
      const service = await serviceRepository.getById(providerId, serviceId);
      return {
        message: 'Membre retiré',
        memberIds: service?.memberIds,
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Catalog Service (Prestations)
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des opérations prestations: création, modification, activation/désactivation, gestion des locations et membres.
        </p>
      </div>

      {/* IDs */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="IDs" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Provider ID"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="ID du provider"
              hint="Requis pour toutes les opérations"
            />
            <Input
              label="Service ID"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="ID de la prestation"
              hint="Auto-rempli après création"
            />
          </div>
        </CardBody>
      </Card>

      {/* Create Service */}
      <Card>
        <CardHeader title="Créer une Prestation" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Nom"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Coupe Homme"
            />
            <Input
              label="Description (optionnel)"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Description"
            />
            <Input
              label="Durée (minutes)"
              type="number"
              value={createDuration}
              onChange={(e) => setCreateDuration(e.target.value)}
              placeholder="30"
            />
            <Input
              label="Prix (centimes)"
              type="number"
              value={createPrice}
              onChange={(e) => setCreatePrice(e.target.value)}
              placeholder="2500"
              hint="2500 = 25.00€"
            />
            <Input
              label="Buffer (minutes)"
              type="number"
              value={createBufferTime}
              onChange={(e) => setCreateBufferTime(e.target.value)}
              placeholder="5"
              hint="Temps entre rdv"
            />
            <Input
              label="Location IDs (optionnel)"
              value={createLocationIds}
              onChange={(e) => setCreateLocationIds(e.target.value)}
              placeholder="loc-1, loc-2"
              hint="Séparés par virgule"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCreateService}
              loading={loading && lastAction === 'CREATE SERVICE'}
              disabled={!providerId}
            >
              Créer Prestation
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Update Service */}
      <Card>
        <CardHeader title="Modifier une Prestation" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nouveau nom"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
            <Input
              label="Nouvelle description"
              value={updateDescription}
              onChange={(e) => setUpdateDescription(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
            <Input
              label="Nouvelle durée"
              type="number"
              value={updateDuration}
              onChange={(e) => setUpdateDuration(e.target.value)}
              placeholder="minutes"
            />
            <Input
              label="Nouveau prix"
              type="number"
              value={updatePrice}
              onChange={(e) => setUpdatePrice(e.target.value)}
              placeholder="centimes"
            />
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={handleUpdateService}
              loading={loading && lastAction === 'UPDATE SERVICE'}
              disabled={!providerId || !serviceId}
            >
              Modifier Prestation
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Service Actions */}
      <Card>
        <CardHeader title="Actions Prestation" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetById}
              loading={loading && lastAction === 'GET BY ID'}
              disabled={!providerId || !serviceId}
            >
              Voir Détails
            </Button>
            <Button
              variant="outline"
              onClick={handleDeactivateService}
              loading={loading && lastAction === 'DEACTIVATE SERVICE'}
              disabled={!providerId || !serviceId}
            >
              Désactiver
            </Button>
            <Button
              variant="outline"
              onClick={handleReactivateService}
              loading={loading && lastAction === 'REACTIVATE SERVICE'}
              disabled={!providerId || !serviceId}
            >
              Réactiver
            </Button>
            <Button
              variant="outline"
              onClick={handleDuplicateService}
              loading={loading && lastAction === 'DUPLICATE SERVICE'}
              disabled={!providerId || !serviceId}
            >
              Dupliquer
            </Button>
            <Button
              variant="outline"
              onClick={handleDeleteService}
              loading={loading && lastAction === 'DELETE SERVICE'}
              disabled={!providerId || !serviceId}
              className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
            >
              Supprimer
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Location & Member Management */}
      <Card>
        <CardHeader title="Gestion Locations / Membres" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Location ID"
              value={filterLocationId}
              onChange={(e) => setFilterLocationId(e.target.value)}
              placeholder="location-1"
            />
            <Input
              label="Member ID"
              value={filterMemberId}
              onChange={(e) => setFilterMemberId(e.target.value)}
              placeholder="member-1"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleAddLocation}
              loading={loading && lastAction === 'ADD LOCATION'}
              disabled={!providerId || !serviceId || !filterLocationId}
            >
              + Location
            </Button>
            <Button
              variant="outline"
              onClick={handleRemoveLocation}
              loading={loading && lastAction === 'REMOVE LOCATION'}
              disabled={!providerId || !serviceId || !filterLocationId}
            >
              - Location
            </Button>
            <Button
              variant="outline"
              onClick={handleAddMember}
              loading={loading && lastAction === 'ADD MEMBER'}
              disabled={!providerId || !serviceId || !filterMemberId}
            >
              + Membre
            </Button>
            <Button
              variant="outline"
              onClick={handleRemoveMember}
              loading={loading && lastAction === 'REMOVE MEMBER'}
              disabled={!providerId || !serviceId || !filterMemberId}
            >
              - Membre
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader title="Filtres de Recherche" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Prix min (centimes)"
              type="number"
              value={filterMinPrice}
              onChange={(e) => setFilterMinPrice(e.target.value)}
              placeholder="1000"
            />
            <Input
              label="Prix max (centimes)"
              type="number"
              value={filterMaxPrice}
              onChange={(e) => setFilterMaxPrice(e.target.value)}
              placeholder="5000"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetByLocation}
              loading={loading && lastAction === 'GET BY LOCATION'}
              disabled={!providerId || !filterLocationId}
            >
              Par Location
            </Button>
            <Button
              variant="outline"
              onClick={handleGetByMember}
              loading={loading && lastAction === 'GET BY MEMBER'}
              disabled={!providerId || !filterMemberId}
            >
              Par Membre
            </Button>
            <Button
              variant="outline"
              onClick={handleGetByPriceRange}
              loading={loading && lastAction === 'GET BY PRICE RANGE'}
              disabled={!providerId || !filterMinPrice || !filterMaxPrice}
            >
              Par Prix
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* List Services */}
      <Card>
        <CardHeader title="Lister les Prestations" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetByProvider}
              loading={loading && lastAction === 'GET BY PROVIDER'}
              disabled={!providerId}
            >
              Toutes les prestations
            </Button>
            <Button
              variant="outline"
              onClick={handleGetActiveByProvider}
              loading={loading && lastAction === 'GET ACTIVE'}
              disabled={!providerId}
            >
              Prestations actives
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader
          title="Résultat"
          action={
            lastAction && (
              <Badge variant={error ? 'error' : 'success'}>
                {lastAction}
              </Badge>
            )
          }
        />
        <CardBody>
          {error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 font-medium">Erreur</p>
              <p className="text-red-500 dark:text-red-300 text-sm mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          ) : result ? (
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm overflow-x-auto max-h-96 text-gray-800 dark:text-gray-200">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Exécutez une action pour voir le résultat ici.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
