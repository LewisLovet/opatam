'use client';

import { useEffect } from 'react';

/**
 * Auto-recovers from stale-deployment chunk errors.
 *
 * After a Vercel redeploy, a tab opened on the OLD build references JS/CSS
 * chunks that no longer exist on the new deployment → a dynamic import or
 * client navigation fails with "ChunkLoadError" / "Loading chunk failed", and
 * the user is stuck on a blank/stale view until they manually refresh.
 * Next.js does not auto-recover. We listen for that specific class of error
 * and reload once.
 *
 * Loop guard: we store the timestamp of the last forced reload and refuse to
 * reload again within 10s, so a genuinely persistent failure can't trap the
 * user in a refresh loop.
 */
const KEY = 'chunk-reload-ts';
const MIN_INTERVAL_MS = 10_000;

function isChunkError(message?: string | null): boolean {
  if (!message) return false;
  return /ChunkLoadError|Loading chunk [\d]+ failed|Loading CSS chunk|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically imported module/i.test(
    message,
  );
}

export function ChunkReloadGuard() {
  useEffect(() => {
    const reloadOnce = () => {
      try {
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last < MIN_INTERVAL_MS) return; // reloaded recently → don't loop
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        // sessionStorage unavailable (private mode) — fall through to a single reload
      }
      window.location.reload();
    };

    const onError = (e: ErrorEvent) => {
      const err = e.error as Error | undefined;
      if (isChunkError(e.message) || isChunkError(err?.name) || isChunkError(err?.message)) {
        reloadOnce();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { name?: string; message?: string } | string | undefined;
      const msg = typeof reason === 'string' ? reason : `${reason?.name ?? ''} ${reason?.message ?? ''}`;
      if (isChunkError(msg)) reloadOnce();
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
