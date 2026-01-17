'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { serviceRepository } from '@booking-app/firebase';

export default function ServicesTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Provider ID (required for all operations)
  const [providerId, setProviderId] = useState('');

  // Form states
  const [createName, setCreateName] = useState('Coupe Homme');
  const [createDuration, setCreateDuration] = useState('30');
  const [createPrice, setCreatePrice] = useState('2500');
  const [createLocationId, setCreateLocationId] = useState('');

  const [searchServiceId, setSearchServiceId] = useState('');
  const [searchLocationId, setSearchLocationId] = useState('');
  const [searchMemberId, setSearchMemberId] = useState('');
  const [deleteServiceId, setDeleteServiceId] = useState('');

  const [updateServiceId, setUpdateServiceId] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [updatePrice, setUpdatePrice] = useState('');

  const executeAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setLastAction(action);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () =>
    executeAction('CREATE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!createLocationId) throw new Error('Location ID requis');
      const id = await serviceRepository.create(providerId, {
        name: createName,
        description: null,
        duration: parseInt(createDuration, 10),
        price: parseInt(createPrice, 10),
        bufferTime: 0,
        locationIds: [createLocationId],
        memberIds: null,
        isActive: true,
        sortOrder: 0,
      });
      return { id, message: 'Service cree avec succes' };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const services = await serviceRepository.getByProvider(providerId);
      return { count: services.length, services };
    });

  const handleGetActiveByProvider = () =>
    executeAction('GET ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const services = await serviceRepository.getActiveByProvider(providerId);
      return { count: services.length, services };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchServiceId) throw new Error('Service ID requis');
      const service = await serviceRepository.getById(providerId, searchServiceId);
      return service || { message: 'Service non trouve' };
    });

  const handleGetByLocation = () =>
    executeAction('GET BY LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchLocationId) throw new Error('Location ID requis');
      const services = await serviceRepository.getByLocation(providerId, searchLocationId);
      return { count: services.length, services };
    });

  const handleGetByMember = () =>
    executeAction('GET BY MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchMemberId) throw new Error('Member ID requis');
      const services = await serviceRepository.getByMember(providerId, searchMemberId);
      return { count: services.length, services };
    });

  const handleUpdate = () =>
    executeAction('UPDATE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateServiceId) throw new Error('Service ID requis');

      const updateData: { name?: string; price?: number } = {};
      if (updateName) updateData.name = updateName;
      if (updatePrice) updateData.price = parseInt(updatePrice, 10);

      if (Object.keys(updateData).length === 0) {
        throw new Error('Au moins un champ a modifier requis');
      }

      await serviceRepository.update(providerId, updateServiceId, updateData);
      return { message: 'Service mis a jour avec succes', id: updateServiceId };
    });

  const handleToggleActive = () =>
    executeAction('TOGGLE ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateServiceId) throw new Error('Service ID requis');
      const service = await serviceRepository.getById(providerId, updateServiceId);
      if (!service) throw new Error('Service non trouve');
      await serviceRepository.toggleActive(providerId, updateServiceId, !service.isActive);
      return { message: `Service ${!service.isActive ? 'active' : 'desactive'}`, id: updateServiceId };
    });

  const handleDelete = () =>
    executeAction('DELETE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!deleteServiceId) throw new Error('Service ID requis');
      await serviceRepository.delete(providerId, deleteServiceId);
      return { message: 'Service supprime avec succes', id: deleteServiceId };
    });

  const handleCount = () =>
    executeAction('COUNT', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const count = await serviceRepository.countByProvider(providerId);
      return { count, message: `${count} service(s) pour ce provider` };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Services Repository
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations CRUD sur la sous-collection providers/&#123;id&#125;/services.
        </p>
      </div>

      {/* Provider ID */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="Provider ID (requis)" />
        <CardBody>
          <Input
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            placeholder="ID du provider parent"
            hint="Copiez l'ID d'un provider depuis la page Providers"
          />
        </CardBody>
      </Card>

      {/* Create */}
      <Card>
        <CardHeader title="Creer un Service" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nom"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Coupe Homme"
            />
            <Input
              label="Duree (min)"
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
              label="Location ID"
              value={createLocationId}
              onChange={(e) => setCreateLocationId(e.target.value)}
              placeholder="ID de la location"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCreate}
              loading={loading && lastAction === 'CREATE'}
              disabled={!providerId}
            >
              Creer Service
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Lire des Services" />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGetByProvider}
                loading={loading && lastAction === 'GET BY PROVIDER'}
                disabled={!providerId}
              >
                Tous les services
              </Button>
              <Button
                variant="outline"
                onClick={handleGetActiveByProvider}
                loading={loading && lastAction === 'GET ACTIVE'}
                disabled={!providerId}
              >
                Services actifs
              </Button>
              <Button
                variant="outline"
                onClick={handleCount}
                loading={loading && lastAction === 'COUNT'}
                disabled={!providerId}
              >
                Compter
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Service ID"
                value={searchServiceId}
                onChange={(e) => setSearchServiceId(e.target.value)}
                placeholder="ID du service"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetById}
                loading={loading && lastAction === 'GET BY ID'}
                disabled={!providerId}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Location ID"
                value={searchLocationId}
                onChange={(e) => setSearchLocationId(e.target.value)}
                placeholder="ID de la location"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByLocation}
                loading={loading && lastAction === 'GET BY LOCATION'}
                disabled={!providerId}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Member ID"
                value={searchMemberId}
                onChange={(e) => setSearchMemberId(e.target.value)}
                placeholder="ID du member"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByMember}
                loading={loading && lastAction === 'GET BY MEMBER'}
                disabled={!providerId}
              >
                Chercher
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update */}
      <Card>
        <CardHeader title="Modifier un Service" />
        <CardBody>
          <div className="flex gap-3 items-end flex-wrap">
            <Input
              label="Service ID"
              value={updateServiceId}
              onChange={(e) => setUpdateServiceId(e.target.value)}
              placeholder="ID"
              className="flex-1 min-w-[150px]"
            />
            <Input
              label="Nouveau Nom"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Nouveau nom"
              className="flex-1 min-w-[150px]"
            />
            <Input
              label="Nouveau Prix"
              type="number"
              value={updatePrice}
              onChange={(e) => setUpdatePrice(e.target.value)}
              placeholder="Prix en centimes"
              className="flex-1 min-w-[150px]"
            />
            <Button
              variant="outline"
              onClick={handleUpdate}
              loading={loading && lastAction === 'UPDATE'}
              disabled={!providerId}
            >
              Modifier
            </Button>
            <Button
              variant="outline"
              onClick={handleToggleActive}
              loading={loading && lastAction === 'TOGGLE ACTIVE'}
              disabled={!providerId}
            >
              Toggle Actif
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete */}
      <Card>
        <CardHeader title="Supprimer un Service" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="Service ID a supprimer"
              value={deleteServiceId}
              onChange={(e) => setDeleteServiceId(e.target.value)}
              placeholder="ID"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleDelete}
              loading={loading && lastAction === 'DELETE'}
              disabled={!providerId}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Supprimer
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader
          title="Resultat"
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
              <p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          ) : result ? (
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm overflow-x-auto max-h-96 text-gray-800 dark:text-gray-200">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Executez une action pour voir le resultat ici.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
