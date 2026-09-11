'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAppNotifications, type AppNotificationItem } from '@/hooks/useAppNotifications';
import { NotificationDetailView } from './NotificationsBell';

/**
 * Fenêtre « Nouveau » au premier chargement de l'espace pro — miroir de la
 * fenêtre de démarrage mobile, pour les mises à jour MAJEURES marquées
 * « afficher au démarrage » dans l'admin. Une seule par session, marquée lue
 * dès l'affichage (donc plus jamais imposée, sur aucun appareil), expirée
 * passé 14 jours.
 */
const MAX_AGE_MS = 14 * 86_400_000;

export function LaunchNoticeModal({ enabled }: { enabled: boolean }) {
  const { notifications, markRead } = useAppNotifications();
  const router = useRouter();
  const [ouverte, setOuverte] = useState<AppNotificationItem | null>(null);
  const dejaMontre = useRef(false);

  useEffect(() => {
    if (!enabled || dejaMontre.current) return;
    const limite = Date.now() - MAX_AGE_MS;
    const notice = notifications.find(
      (n) => n.showAtLaunch === true && !n.isRead && n.publishedAtMs >= limite,
    );
    if (!notice) return;
    dejaMontre.current = true;
    setOuverte(notice);
    void markRead(notice.id);
  }, [enabled, notifications, markRead]);

  if (!ouverte) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/60 p-4" onClick={() => setOuverte(null)}>
      <div
        className="w-full max-w-md max-h-[86vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <span className="inline-flex items-center rounded-full bg-primary-600 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white">
            Nouveau
          </span>
          <button
            type="button"
            onClick={() => setOuverte(null)}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <NotificationDetailView
          item={ouverte}
          onCta={(slug) => {
            setOuverte(null);
            router.push(`/pro/tutoriels/${slug}`);
          }}
        />
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => setOuverte(null)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
