'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  catalogService,
  locationService,
  memberService,
} from '@booking-app/firebase';
import type {
  Location,
  Member,
  Service,
  ServiceCategory,
} from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export interface EditorData {
  loading: boolean;
  /** True when editing and the service id didn't resolve to a doc. */
  notFound: boolean;
  providerId: string | null;
  service: WithId<Service> | null;
  locations: WithId<Location>[];
  members: WithId<Member>[];
  categories: WithId<ServiceCategory>[];
  isTeamPlan: boolean;
  depositsEnabled: boolean;
  defaultDeposit: { percent: number; refundDeadlineHours: number } | null;
}

/**
 * Loads everything the prestation editor needs: the supporting lists
 * (locations / members / categories) plus the target service when
 * editing. Shared by the create and edit routes.
 */
export function useEditorData(serviceId?: string): EditorData {
  const { provider } = useAuth();
  const isTeamPlan = provider?.plan === 'team';

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [service, setService] = useState<WithId<Service> | null>(null);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [categories, setCategories] = useState<WithId<ServiceCategory>[]>([]);

  useEffect(() => {
    if (!provider) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const [locationsData, membersData, categoriesData, serviceData] =
          await Promise.all([
            locationService.getByProvider(provider.id),
            isTeamPlan ? memberService.getByProvider(provider.id) : Promise.resolve([]),
            catalogService.getCategoriesByProvider(provider.id),
            serviceId
              ? catalogService.getById(provider.id, serviceId)
              : Promise.resolve(null),
          ]);

        if (cancelled) return;
        setLocations(locationsData);
        setMembers(membersData);
        setCategories(categoriesData.sort((a, b) => a.sortOrder - b.sortOrder));
        if (serviceId) {
          if (serviceData) setService(serviceData);
          else setNotFound(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Editor data load error:', error);
          setNotFound(!!serviceId);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider, isTeamPlan, serviceId]);

  return {
    loading: loading || !provider,
    notFound,
    providerId: provider?.id ?? null,
    service,
    locations,
    members,
    categories,
    isTeamPlan,
    depositsEnabled: !!provider?.depositsAddonActive,
    defaultDeposit: provider?.settings?.depositDefault ?? null,
  };
}
