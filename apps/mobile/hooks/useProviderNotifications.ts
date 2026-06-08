/**
 * useProviderNotifications
 *
 * Real-time feed of in-app announcements ("centre de notifications")
 * for the PRO space, backed by the top-level `appNotifications`
 * collection (authored from the admin back-office) + the user's own
 * read receipts under `users/{uid}/notificationReads`.
 *
 * Returns the published items relevant to pros (audience 'pros' or
 * 'all'), newest first, each flagged read/unread, plus the unread
 * count for the header badge and helpers to mark items read.
 *
 * Query stays a single equality filter (`isPublished == true`) with no
 * orderBy so it needs no composite index and satisfies the Firestore
 * rule (which only allows reading published docs); sorting is done in
 * memory (announcements are few).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  serverTimestamp,
} from '@booking-app/firebase';
import type { WithId } from '@booking-app/firebase';
import type { AppNotification } from '@booking-app/shared';
import { useAuth } from '../contexts';

function toMillis(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  return 0;
}

export interface ProviderNotificationItem extends WithId<AppNotification> {
  isRead: boolean;
  publishedAtMs: number;
}

export interface UseProviderNotificationsResult {
  notifications: ProviderNotificationItem[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useProviderNotifications(): UseProviderNotificationsResult {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [items, setItems] = useState<WithId<AppNotification>[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Published announcements for pros.
  useEffect(() => {
    const q = query(
      collection(db, 'appNotifications'),
      where('isPublished', '==', true),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as AppNotification) }))
          .filter((n) => n.audience === 'pros' || n.audience === 'all');
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  // This user's read receipts.
  useEffect(() => {
    if (!uid) {
      setReadIds(new Set());
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'notificationReads'),
      (snap) => setReadIds(new Set(snap.docs.map((d) => d.id))),
      () => setReadIds(new Set()),
    );
    return unsub;
  }, [uid]);

  const notifications = useMemo<ProviderNotificationItem[]>(() => {
    return items
      .map((n) => ({
        ...n,
        isRead: readIds.has(n.id),
        publishedAtMs: toMillis((n as any).publishedAt) || toMillis((n as any).createdAt),
      }))
      .sort((a, b) => b.publishedAtMs - a.publishedAtMs);
  }, [items, readIds]);

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0),
    [notifications],
  );

  const markRead = useCallback(
    async (id: string) => {
      if (!uid || readIds.has(id)) return;
      try {
        await setDoc(
          doc(db, 'users', uid, 'notificationReads', id),
          { readAt: serverTimestamp() },
          { merge: true },
        );
      } catch (e) {
        console.warn('[useProviderNotifications] markRead failed', e);
      }
    },
    [uid, readIds],
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(
      unread.map((n) =>
        setDoc(
          doc(db, 'users', uid, 'notificationReads', n.id),
          { readAt: serverTimestamp() },
          { merge: true },
        ).catch(() => {}),
      ),
    );
  }, [uid, notifications]);

  return { notifications, unreadCount, loading, markRead, markAllRead };
}
