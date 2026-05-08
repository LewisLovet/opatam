/**
 * useProviderClients Hook
 *
 * Loads the full client base of a provider (`providerClients`
 * collection). Same idea as the web /pro/clients page — the
 * dataset is small (a few hundred docs at most for a busy salon
 * over years), so we pull everything at once and let the screen
 * apply search / filter / sort in memory for an instant feel.
 *
 * The repository's getByProvider already filters server-side by
 * providerId via the Firestore rule, so we don't ship extra
 * scoping logic here.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  providerClientRepository,
  type WithId,
} from '@booking-app/firebase';
import type { ProviderClient } from '@booking-app/shared';

interface State {
  clients: WithId<ProviderClient>[];
  loading: boolean;
  error: string | null;
}

interface Result extends State {
  /** Manually re-fetch — used by the pull-to-refresh on the list. */
  refresh: () => Promise<void>;
  /** Optimistic patch when the user saves notes/preferences from
   *  the detail screen, so the list reflects the change without
   *  another round trip. */
  applyPatch: (clientKey: string, patch: Partial<ProviderClient>) => void;
}

export function useProviderClients(
  providerId: string | undefined,
): Result {
  const [state, setState] = useState<State>({
    clients: [],
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    if (!providerId) {
      setState({ clients: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const rows = await providerClientRepository.getByProvider(providerId);
      setState({ clients: rows, loading: false, error: null });
    } catch (err) {
      console.error('[useProviderClients] load error:', err);
      setState({
        clients: [],
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : 'Impossible de charger la liste des clients',
      });
    }
  }, [providerId]);

  useEffect(() => {
    load();
  }, [load]);

  const applyPatch = useCallback(
    (clientKey: string, patch: Partial<ProviderClient>) => {
      setState((s) => ({
        ...s,
        clients: s.clients.map((c) =>
          c.clientKey === clientKey ? { ...c, ...patch } : c,
        ),
      }));
    },
    [],
  );

  return {
    clients: state.clients,
    loading: state.loading,
    error: state.error,
    refresh: load,
    applyPatch,
  };
}
