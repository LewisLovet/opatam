'use client';

/**
 * useAppNotifications (web) — real-time in-app announcements for the PRO
 * dashboard, mirroring the mobile useProviderNotifications hook. Reads
 * the published `appNotifications` (audience pros / all / admins-if-admin
 * / specific-if-targeted) plus the user's read receipts, newest first.
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
import type { AppNotification } from '@booking-app/shared';
import { useAuth } from '@/contexts/AuthContext';

type WithId<T> = { id: string } & T;

function toMillis(v: unknown): number {
  if (!v) return 0;
  const anyV = v as { toMillis?: () => number; seconds?: number };
  if (typeof anyV.toMillis === 'function') return anyV.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof anyV.seconds === 'number') return anyV.seconds * 1000;
  return 0;
}

export interface AppNotificationItem extends WithId<AppNotification> {
  isRead: boolean;
  publishedAtMs: number;
}

export function useAppNotifications() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const isAdmin = !!user?.isAdmin;

  const [items, setItems] = useState<WithId<AppNotification>[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'appNotifications'), where('isPublished', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as AppNotification) }))
          .filter((n) => {
            if (n.audience === 'pros' || n.audience === 'all') return true;
            if (n.audience === 'admins') return isAdmin;
            if (n.audience === 'specific') return !!uid && n.targetUserId === uid;
            return false;
          });
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [uid, isAdmin]);

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

  const notifications = useMemo<AppNotificationItem[]>(
    () =>
      items
        .map((n) => ({
          ...n,
          isRead: readIds.has(n.id),
          publishedAtMs: toMillis(n.publishedAt) || toMillis(n.createdAt),
        }))
        .sort((a, b) => b.publishedAtMs - a.publishedAtMs),
    [items, readIds],
  );

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
        console.warn('[useAppNotifications] markRead failed', e);
      }
    },
    [uid, readIds],
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    await Promise.all(
      notifications
        .filter((n) => !n.isRead)
        .map((n) =>
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
