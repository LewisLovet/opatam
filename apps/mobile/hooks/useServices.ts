/**
 * useServices Hook
 * Fetch services for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { catalogService } from '@booking-app/firebase';
import type { Service } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface UseServicesResult {
  services: WithId<Service>[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useServices(providerId: string | undefined): UseServicesResult {
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!providerId) {
      setServices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await catalogService.getActiveByProvider(providerId);
      setServices(result);
    } catch (err) {
      console.error('Error loading services:', err);
      setError('Erreur lors du chargement des prestations');
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return {
    services,
    loading,
    error,
    refresh: loadServices,
  };
}
