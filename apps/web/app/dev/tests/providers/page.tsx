'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, Badge } from '@/components/ui';
import { providerRepository } from '@booking-app/firebase';

export default function ProvidersTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Form states
  const [createBusinessName, setCreateBusinessName] = useState('Test Business');
  const [createCategory, setCreateCategory] = useState('beauty');
  const [createPlan, setCreatePlan] = useState<'solo' | 'team'>('solo');

  const [searchId, setSearchId] = useState('');
  const [searchSlug, setSearchSlug] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [deleteId, setDeleteId] = useState('');

  const [updateId, setUpdateId] = useState('');
  const [updateBusinessName, setUpdateBusinessName] = useState('');

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
      const slug = createBusinessName.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      const id = await providerRepository.create({
        userId: 'test-user-' + Date.now(),
        plan: createPlan,
        businessName: createBusinessName,
        description: 'Description de test',
        category: createCategory,
        slug,
        photoURL: null,
        coverPhotoURL: null,
        portfolioPhotos: [],
        socialLinks: {
          instagram: null,
          facebook: null,
          tiktok: null,
          website: null,
        },
        rating: {
          average: 0,
          count: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
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
          plan: createPlan,
          tier: 'standard',
          memberCount: createPlan === 'team' ? 5 : 1,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          status: 'trialing',
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
        isPublished: false,
        isVerified: false,
        cities: [],
        minPrice: null,
        searchTokens: [],
        nextAvailableSlot: null,
      });
      return { id, slug, message: 'Provider créé avec succès' };
    });

  const handleGetAll = () =>
    executeAction('GET ALL', async () => {
      const providers = await providerRepository.getAll();
      return { count: providers.length, providers };
    });

  const handleGetPublished = () =>
    executeAction('GET PUBLISHED', async () => {
      const providers = await providerRepository.getPublished();
      return { count: providers.length, providers };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!searchId) throw new Error('ID requis');
      const provider = await providerRepository.getById(searchId);
      return provider || { message: 'Provider non trouvé' };
    });

  const handleGetBySlug = () =>
    executeAction('GET BY SLUG', async () => {
      if (!searchSlug) throw new Error('Slug requis');
      const provider = await providerRepository.getBySlug(searchSlug);
      return provider || { message: 'Provider non trouvé' };
    });

  const handleGetByUserId = () =>
    executeAction('GET BY USER ID', async () => {
      if (!searchUserId) throw new Error('User ID requis');
      const provider = await providerRepository.getByUserId(searchUserId);
      return provider || { message: 'Provider non trouvé' };
    });

  const handleGetByCategory = () =>
    executeAction('GET BY CATEGORY', async () => {
      if (!searchCategory) throw new Error('Catégorie requise');
      const providers = await providerRepository.getByCategory(searchCategory);
      return { count: providers.length, providers };
    });

  const handleUpdate = () =>
    executeAction('UPDATE', async () => {
      if (!updateId) throw new Error('ID requis');
      if (!updateBusinessName) throw new Error('Nouveau nom requis');
      await providerRepository.update(updateId, { businessName: updateBusinessName });
      return { message: 'Provider mis à jour avec succès', id: updateId };
    });

  const handleTogglePublished = () =>
    executeAction('TOGGLE PUBLISHED', async () => {
      if (!updateId) throw new Error('ID requis');
      const provider = await providerRepository.getById(updateId);
      if (!provider) throw new Error('Provider non trouvé');
      await providerRepository.togglePublished(updateId, !provider.isPublished);
      return { message: `Provider ${!provider.isPublished ? 'publié' : 'dépublié'}`, id: updateId };
    });

  const handleDelete = () =>
    executeAction('DELETE', async () => {
      if (!deleteId) throw new Error('ID requis');
      await providerRepository.delete(deleteId);
      return { message: 'Provider supprimé avec succès', id: deleteId };
    });

  const categoryOptions = [
    { value: 'beauty', label: 'Beauté & Esthétique' },
    { value: 'wellness', label: 'Bien-être & Santé' },
    { value: 'sport', label: 'Sport & Coaching' },
    { value: 'training', label: 'Formation & Cours' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Providers Repository
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des opérations CRUD sur la collection providers.
        </p>
      </div>

      {/* Create */}
      <Card>
        <CardHeader title="Créer un Provider" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Nom de l'entreprise"
              value={createBusinessName}
              onChange={(e) => setCreateBusinessName(e.target.value)}
              placeholder="Mon Salon"
            />
            <Select
              label="Catégorie"
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
              options={categoryOptions}
            />
            <Select
              label="Plan"
              value={createPlan}
              onChange={(e) => setCreatePlan(e.target.value as 'solo' | 'team')}
              options={[
                { value: 'solo', label: 'Pro' },
                { value: 'team', label: 'Studio' },
              ]}
            />
          </div>
          <div className="mt-4">
            <Button onClick={handleCreate} loading={loading && lastAction === 'CREATE'}>
              Créer Provider
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Lire des Providers" />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGetAll} loading={loading && lastAction === 'GET ALL'}>
                Tous les providers
              </Button>
              <Button
                variant="outline"
                onClick={handleGetPublished}
                loading={loading && lastAction === 'GET PUBLISHED'}
              >
                Providers publiés
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="ID du provider"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetById}
                loading={loading && lastAction === 'GET BY ID'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Slug"
                value={searchSlug}
                onChange={(e) => setSearchSlug(e.target.value)}
                placeholder="mon-salon"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetBySlug}
                loading={loading && lastAction === 'GET BY SLUG'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par User ID"
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                placeholder="User ID"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByUserId}
                loading={loading && lastAction === 'GET BY USER ID'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Select
                label="Chercher par Catégorie"
                value={searchCategory}
                onChange={(e) => setSearchCategory(e.target.value)}
                options={categoryOptions}
                placeholder="Choisir une catégorie"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByCategory}
                loading={loading && lastAction === 'GET BY CATEGORY'}
              >
                Chercher
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update */}
      <Card>
        <CardHeader title="Modifier un Provider" />
        <CardBody>
          <div className="flex gap-3 items-end flex-wrap">
            <Input
              label="ID du Provider"
              value={updateId}
              onChange={(e) => setUpdateId(e.target.value)}
              placeholder="ID"
              className="flex-1 min-w-[200px]"
            />
            <Input
              label="Nouveau Nom"
              value={updateBusinessName}
              onChange={(e) => setUpdateBusinessName(e.target.value)}
              placeholder="Nouveau nom"
              className="flex-1 min-w-[200px]"
            />
            <Button
              variant="outline"
              onClick={handleUpdate}
              loading={loading && lastAction === 'UPDATE'}
            >
              Modifier
            </Button>
            <Button
              variant="outline"
              onClick={handleTogglePublished}
              loading={loading && lastAction === 'TOGGLE PUBLISHED'}
            >
              Toggle Publié
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Delete */}
      <Card>
        <CardHeader title="Supprimer un Provider" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="ID du Provider à supprimer"
              value={deleteId}
              onChange={(e) => setDeleteId(e.target.value)}
              placeholder="ID"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleDelete}
              loading={loading && lastAction === 'DELETE'}
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
              <p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>
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
