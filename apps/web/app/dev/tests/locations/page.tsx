'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { locationRepository } from '@booking-app/firebase';

export default function LocationsTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Provider ID (required for all operations)
  const [providerId, setProviderId] = useState('');

  // Form states
  const [createName, setCreateName] = useState('Salon Paris 11');
  const [createAddress, setCreateAddress] = useState('123 Rue de la République');
  const [createCity, setCreateCity] = useState('Paris');
  const [createPostalCode, setCreatePostalCode] = useState('75011');

  const [searchLocationId, setSearchLocationId] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [deleteLocationId, setDeleteLocationId] = useState('');

  const [updateLocationId, setUpdateLocationId] = useState('');
  const [updateName, setUpdateName] = useState('');

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
      const id = await locationRepository.create(providerId, {
        name: createName,
        address: createAddress,
        city: createCity,
        postalCode: createPostalCode,
        geopoint: null,
        description: null,
        isDefault: false,
        isActive: true,
      });
      return { id, message: 'Location creee avec succes' };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const locations = await locationRepository.getByProvider(providerId);
      return { count: locations.length, locations };
    });

  const handleGetActiveByProvider = () =>
    executeAction('GET ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const locations = await locationRepository.getActiveByProvider(providerId);
      return { count: locations.length, locations };
    });

  const handleGetDefault = () =>
    executeAction('GET DEFAULT', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const location = await locationRepository.getDefault(providerId);
      return location || { message: 'Aucune location par defaut' };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchLocationId) throw new Error('Location ID requis');
      const location = await locationRepository.getById(providerId, searchLocationId);
      return location || { message: 'Location non trouvee' };
    });

  const handleGetByCity = () =>
    executeAction('GET BY CITY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchCity) throw new Error('Ville requise');
      const locations = await locationRepository.getByCity(providerId, searchCity);
      return { count: locations.length, locations };
    });

  const handleUpdate = () =>
    executeAction('UPDATE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateLocationId) throw new Error('Location ID requis');
      if (!updateName) throw new Error('Nouveau nom requis');
      await locationRepository.update(providerId, updateLocationId, { name: updateName });
      return { message: 'Location mise a jour avec succes', id: updateLocationId };
    });

  const handleSetDefault = () =>
    executeAction('SET DEFAULT', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateLocationId) throw new Error('Location ID requis');
      await locationRepository.setDefault(providerId, updateLocationId);
      return { message: 'Location definie comme defaut', id: updateLocationId };
    });

  const handleToggleActive = () =>
    executeAction('TOGGLE ACTIVE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!updateLocationId) throw new Error('Location ID requis');
      const location = await locationRepository.getById(providerId, updateLocationId);
      if (!location) throw new Error('Location non trouvee');
      await locationRepository.toggleActive(providerId, updateLocationId, !location.isActive);
      return { message: `Location ${!location.isActive ? 'activee' : 'desactivee'}`, id: updateLocationId };
    });

  const handleDelete = () =>
    executeAction('DELETE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!deleteLocationId) throw new Error('Location ID requis');
      await locationRepository.delete(providerId, deleteLocationId);
      return { message: 'Location supprimee avec succes', id: deleteLocationId };
    });

  const handleCount = () =>
    executeAction('COUNT', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const count = await locationRepository.countByProvider(providerId);
      return { count, message: `${count} location(s) pour ce provider` };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Locations Repository
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations CRUD sur la sous-collection providers/&#123;id&#125;/locations.
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
        <CardHeader title="Creer une Location" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Nom"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Salon Paris 11"
            />
            <Input
              label="Adresse"
              value={createAddress}
              onChange={(e) => setCreateAddress(e.target.value)}
              placeholder="123 Rue..."
            />
            <Input
              label="Ville"
              value={createCity}
              onChange={(e) => setCreateCity(e.target.value)}
              placeholder="Paris"
            />
            <Input
              label="Code Postal"
              value={createPostalCode}
              onChange={(e) => setCreatePostalCode(e.target.value)}
              placeholder="75011"
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCreate}
              loading={loading && lastAction === 'CREATE'}
              disabled={!providerId}
            >
              Creer Location
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Lire des Locations" />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGetByProvider}
                loading={loading && lastAction === 'GET BY PROVIDER'}
                disabled={!providerId}
              >
                Toutes les locations
              </Button>
              <Button
                variant="outline"
                onClick={handleGetActiveByProvider}
                loading={loading && lastAction === 'GET ACTIVE'}
                disabled={!providerId}
              >
                Locations actives
              </Button>
              <Button
                variant="outline"
                onClick={handleGetDefault}
                loading={loading && lastAction === 'GET DEFAULT'}
                disabled={!providerId}
              >
                Location par defaut
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
                label="Chercher par Location ID"
                value={searchLocationId}
                onChange={(e) => setSearchLocationId(e.target.value)}
                placeholder="ID de la location"
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
                label="Chercher par Ville"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder="Paris"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByCity}
                loading={loading && lastAction === 'GET BY CITY'}
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
        <CardHeader title="Modifier une Location" />
        <CardBody>
          <div className="flex gap-3 items-end flex-wrap">
            <Input
              label="Location ID"
              value={updateLocationId}
              onChange={(e) => setUpdateLocationId(e.target.value)}
              placeholder="ID"
              className="flex-1 min-w-[200px]"
            />
            <Input
              label="Nouveau Nom"
              value={updateName}
              onChange={(e) => setUpdateName(e.target.value)}
              placeholder="Nouveau nom"
              className="flex-1 min-w-[200px]"
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
              onClick={handleSetDefault}
              loading={loading && lastAction === 'SET DEFAULT'}
              disabled={!providerId}
            >
              Defaut
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
        <CardHeader title="Supprimer une Location" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="Location ID a supprimer"
              value={deleteLocationId}
              onChange={(e) => setDeleteLocationId(e.target.value)}
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
