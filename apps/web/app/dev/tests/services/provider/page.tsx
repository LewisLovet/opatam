'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import { providerService, providerRepository } from '@booking-app/firebase';

export default function ProviderServiceTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Form states
  const [providerId, setProviderId] = useState('');
  const [userId, setUserId] = useState('');

  // Create form - simplifie (plan est auto 'trial')
  const [createBusinessName, setCreateBusinessName] = useState('Mon Salon Test');
  const [createCategory, setCreateCategory] = useState('coiffure');
  const [createDescription, setCreateDescription] = useState('');

  // Update form
  const [updateBusinessName, setUpdateBusinessName] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');
  const [updateCategory, setUpdateCategory] = useState('');

  // Upgrade plan
  const [upgradePlan, setUpgradePlan] = useState<'solo' | 'team'>('solo');

  // Search form
  const [searchSlug, setSearchSlug] = useState('');
  const [searchCategory, setSearchCategory] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleCreateProvider = () =>
    executeAction('CREATE PROVIDER', async () => {
      if (!userId) throw new Error('User ID requis');
      const provider = await providerService.createProvider(userId, {
        businessName: createBusinessName,
        category: createCategory || undefined,
        description: createDescription || '',
      });
      setProviderId(provider.id);
      return {
        message: 'Provider cree avec succes (plan: trial)',
        provider: {
          id: provider.id,
          businessName: provider.businessName,
          category: provider.category,
          plan: provider.plan,
          slug: provider.slug,
          trialEndDate: provider.subscription.validUntil,
        },
      };
    });

  const handleUpdateProvider = () =>
    executeAction('UPDATE PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');

      const updateData: Record<string, string> = {};
      if (updateBusinessName) updateData.businessName = updateBusinessName;
      if (updateDescription) updateData.description = updateDescription;
      if (updateCategory) updateData.category = updateCategory;

      if (Object.keys(updateData).length === 0) {
        throw new Error('Au moins un champ a modifier requis');
      }

      await providerService.updateProvider(providerId, updateData);
      const provider = await providerRepository.getById(providerId);
      return {
        message: 'Provider mis a jour',
        provider: provider ? {
          id: provider.id,
          businessName: provider.businessName,
          category: provider.category,
          description: provider.description,
          slug: provider.slug,
        } : null,
      };
    });

  const handleUpgradePlan = () =>
    executeAction('UPGRADE PLAN', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      await providerService.upgradePlan(providerId, upgradePlan);
      const provider = await providerRepository.getById(providerId);
      return {
        message: `Plan mis a jour vers ${upgradePlan}`,
        plan: provider?.plan,
        memberCount: provider?.subscription.memberCount,
      };
    });

  const handleCheckPublishRequirements = () =>
    executeAction('CHECK PUBLISH REQUIREMENTS', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const result = await providerService.checkPublishRequirements(providerId);
      return {
        canPublish: result.canPublish,
        missingItems: result.missingItems,
        completeness: result.completeness,
        message: result.canPublish
          ? 'Pret a publier!'
          : `Elements manquants:\n- ${result.missingItems.join('\n- ')}`,
      };
    });

  const handlePublishProvider = () =>
    executeAction('PUBLISH PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const result = await providerService.publishProvider(providerId);
      if (!result.canPublish) {
        return {
          message: 'Publication impossible',
          missingItems: result.missingItems,
          completeness: result.completeness,
        };
      }
      const provider = await providerRepository.getById(providerId);
      return {
        message: 'Provider publie avec succes',
        isPublished: provider?.isPublished,
        slug: provider?.slug,
      };
    });

  const handleUnpublishProvider = () =>
    executeAction('UNPUBLISH PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      await providerService.unpublishProvider(providerId);
      return { message: 'Provider depublie' };
    });

  const handleGetProvider = () =>
    executeAction('GET PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const provider = await providerService.getById(providerId);
      if (!provider) {
        return { message: 'Provider non trouve' };
      }
      const trialDaysRemaining = providerService.getTrialDaysRemaining(provider);
      const isTrialExpired = providerService.isTrialExpired(provider);
      return {
        provider,
        trialInfo: provider.plan === 'trial' ? {
          daysRemaining: trialDaysRemaining,
          isExpired: isTrialExpired,
          expiresAt: provider.subscription.validUntil,
        } : null,
      };
    });

  const handleGetBySlug = () =>
    executeAction('GET BY SLUG', async () => {
      if (!searchSlug) throw new Error('Slug requis');
      const provider = await providerService.getBySlug(searchSlug);
      return provider || { message: 'Provider non trouve avec ce slug' };
    });

  const handleGetByUserId = () =>
    executeAction('GET BY USER ID', async () => {
      if (!userId) throw new Error('User ID requis');
      const provider = await providerService.getByUserId(userId);
      if (provider) {
        setProviderId(provider.id);
      }
      return provider || { message: 'Pas de provider pour cet utilisateur' };
    });

  const handleSearch = () =>
    executeAction('SEARCH PROVIDERS', async () => {
      const providers = await providerService.search({
        category: searchCategory || undefined,
        city: searchCity || undefined,
        query: searchQuery || undefined,
        limit: 10,
      });
      return {
        count: providers.length,
        providers: providers.map((p) => ({
          id: p.id,
          businessName: p.businessName,
          slug: p.slug,
          category: p.category,
          rating: p.rating.average,
        })),
      };
    });

  const handleGetPublished = () =>
    executeAction('GET PUBLISHED', async () => {
      const providers = await providerRepository.getPublished(10);
      return {
        count: providers.length,
        providers: providers.map((p) => ({
          id: p.id,
          businessName: p.businessName,
          slug: p.slug,
          category: p.category,
          plan: p.plan,
        })),
      };
    });

  const handleGetTopRated = () =>
    executeAction('GET TOP RATED', async () => {
      const providers = await providerService.getTopRated(5);
      return {
        count: providers.length,
        providers: providers.map((p) => ({
          id: p.id,
          businessName: p.businessName,
          rating: p.rating.average,
          reviewCount: p.rating.count,
        })),
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Provider Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations provider: creation (plan trial auto), modification, publication, upgrade plan.
        </p>
      </div>

      {/* IDs */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="IDs" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ID de l'utilisateur"
              hint="Pour creer un provider ou chercher par user"
            />
            <Input
              label="Provider ID"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="ID du provider"
              hint="Auto-rempli apres creation"
            />
          </div>
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGetByUserId}
              loading={loading && lastAction === 'GET BY USER ID'}
              disabled={!userId}
            >
              Chercher provider par User ID
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Create Provider */}
      <Card>
        <CardHeader
          title="Creer un Provider"
          action={<Badge variant="info">Plan: trial (7j)</Badge>}
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Nom de l'entreprise"
              value={createBusinessName}
              onChange={(e) => setCreateBusinessName(e.target.value)}
              placeholder="Mon Salon"
            />
            <Input
              label="Categorie (optionnel)"
              value={createCategory}
              onChange={(e) => setCreateCategory(e.target.value)}
              placeholder="coiffure"
              hint="coiffure, barbier, esthetique, spa, autre"
            />
            <Input
              label="Description (optionnel)"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Description du salon"
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Le plan est automatiquement &quot;trial&quot; (7 jours). L&apos;upgrade vers solo/team se fait apres.
          </p>
          <div className="mt-4">
            <Button
              onClick={handleCreateProvider}
              loading={loading && lastAction === 'CREATE PROVIDER'}
              disabled={!userId}
            >
              Creer Provider
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Update Provider */}
      <Card>
        <CardHeader title="Modifier un Provider" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Nouveau nom"
              value={updateBusinessName}
              onChange={(e) => setUpdateBusinessName(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
            <Input
              label="Nouvelle categorie"
              value={updateCategory}
              onChange={(e) => setUpdateCategory(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
            <Input
              label="Nouvelle description"
              value={updateDescription}
              onChange={(e) => setUpdateDescription(e.target.value)}
              placeholder="Laisser vide pour ignorer"
            />
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={handleUpdateProvider}
              loading={loading && lastAction === 'UPDATE PROVIDER'}
              disabled={!providerId}
            >
              Modifier Provider
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Upgrade Plan */}
      <Card>
        <CardHeader title="Upgrade Plan (apres trial)" />
        <CardBody>
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nouveau plan
              </label>
              <select
                value={upgradePlan}
                onChange={(e) => setUpgradePlan(e.target.value as 'solo' | 'team')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="solo">Solo (1 membre)</option>
                <option value="team">Team (5 membres)</option>
              </select>
            </div>
            <Button
              variant="outline"
              onClick={handleUpgradePlan}
              loading={loading && lastAction === 'UPGRADE PLAN'}
              disabled={!providerId}
            >
              Upgrade Plan
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Note: En production, ceci est appele apres le paiement Stripe.
          </p>
        </CardBody>
      </Card>

      {/* Publication */}
      <Card>
        <CardHeader title="Publication" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleCheckPublishRequirements}
              loading={loading && lastAction === 'CHECK PUBLISH REQUIREMENTS'}
              disabled={!providerId}
            >
              Verifier completude
            </Button>
            <Button
              onClick={handlePublishProvider}
              loading={loading && lastAction === 'PUBLISH PROVIDER'}
              disabled={!providerId}
            >
              Publier
            </Button>
            <Button
              variant="outline"
              onClick={handleUnpublishProvider}
              loading={loading && lastAction === 'UNPUBLISH PROVIDER'}
              disabled={!providerId}
            >
              Depublier
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Requis: nom, categorie, 1 lieu, 1 prestation, disponibilites definies.
          </p>
        </CardBody>
      </Card>

      {/* Search */}
      <Card>
        <CardHeader title="Recherche" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Slug"
              value={searchSlug}
              onChange={(e) => setSearchSlug(e.target.value)}
              placeholder="mon-salon"
            />
            <Input
              label="Categorie"
              value={searchCategory}
              onChange={(e) => setSearchCategory(e.target.value)}
              placeholder="coiffure"
            />
            <Input
              label="Ville"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              placeholder="Paris"
            />
            <Input
              label="Recherche"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="mot-cle"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetBySlug}
              loading={loading && lastAction === 'GET BY SLUG'}
              disabled={!searchSlug}
            >
              Par Slug
            </Button>
            <Button
              variant="outline"
              onClick={handleSearch}
              loading={loading && lastAction === 'SEARCH PROVIDERS'}
            >
              Rechercher
            </Button>
            <Button
              variant="outline"
              onClick={handleGetProvider}
              loading={loading && lastAction === 'GET PROVIDER'}
              disabled={!providerId}
            >
              Par ID
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Listes" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetPublished}
              loading={loading && lastAction === 'GET PUBLISHED'}
            >
              Providers publies
            </Button>
            <Button
              variant="outline"
              onClick={handleGetTopRated}
              loading={loading && lastAction === 'GET TOP RATED'}
            >
              Top notes
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
              <p className="text-red-500 dark:text-red-300 text-sm mt-1 whitespace-pre-wrap">{error}</p>
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
