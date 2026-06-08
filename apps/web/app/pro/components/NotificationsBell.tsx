'use client';

/**
 * NotificationsBell — in-app notification center for the PRO web
 * dashboard. Bell button + unread badge that opens a dropdown panel
 * (list ↔ detail) backed by useAppNotifications. CTA opens the linked
 * tutorial at /pro/tutoriels/{slug}.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Megaphone,
  Rocket,
  Gift,
  PlayCircle,
  BookOpen,
  Lightbulb,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useAppNotifications, type AppNotificationItem } from '@/hooks/useAppNotifications';

const ICONS: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  rocket: Rocket,
  gift: Gift,
  'play-circle': PlayCircle,
  book: BookOpen,
  bulb: Lightbulb,
  'checkmark-circle': CheckCircle2,
  notifications: Bell,
};

function iconFor(name?: string | null): LucideIcon {
  return ICONS[name || 'megaphone'] ?? Megaphone;
}

function formatDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export function NotificationsBell({ variant = 'dark' }: { variant?: 'light' | 'dark' }) {
  const router = useRouter();
  const { notifications, unreadCount, markRead, markAllRead } = useAppNotifications();

  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelectedId(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected: AppNotificationItem | null = selectedId
    ? notifications.find((n) => n.id === selectedId) ?? null
    : null;

  const openDetail = (n: AppNotificationItem) => {
    setSelectedId(n.id);
    if (!n.isRead) void markRead(n.id);
  };

  const openCta = (slug: string) => {
    setOpen(false);
    setSelectedId(null);
    router.push(`/pro/tutoriels/${slug}`);
  };

  const btnColor =
    variant === 'light'
      ? 'text-gray-300 hover:text-white hover:bg-white/10'
      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-lg transition-colors ${btnColor}`}
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-gray-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(380px,calc(100vw-2rem))] max-h-[70vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            {selected ? (
              <button
                onClick={() => setSelectedId(null)}
                className="p-1 -ml-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label="Retour"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                <Bell className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 dark:text-white leading-tight">
                {selected ? 'Notification' : 'Notifications'}
              </p>
              {!selected && (
                <p className="text-xs text-gray-400">
                  {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'À jour'}
                </p>
              )}
            </div>
            {!selected && unreadCount > 0 && (
              <button
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                Tout lire
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                setSelectedId(null);
              }}
              className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto">
            {selected ? (
              <DetailView item={selected} onCta={openCta} />
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-6">
                <div className="w-14 h-14 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                  <Bell className="w-7 h-7 text-primary-400" />
                </div>
                <p className="mt-3 font-semibold text-gray-900 dark:text-white">Vous êtes à jour</p>
                <p className="mt-1 text-sm text-gray-400 max-w-[220px]">
                  Les nouveautés et annonces d&apos;Opatam s&apos;afficheront ici.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {notifications.map((n) => {
                  const Icon = iconFor(n.iconName);
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => openDetail(n)}
                        className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          n.isRead ? '' : 'bg-primary-50/40 dark:bg-primary-900/10'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-[18px] h-[18px] text-primary-600 dark:text-primary-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {!n.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                            )}
                            <p
                              className={`truncate text-sm text-gray-900 dark:text-white ${
                                n.isRead ? 'font-semibold' : 'font-bold'
                              }`}
                            >
                              {n.title}
                            </p>
                            <span className="ml-auto text-[11px] text-gray-400 flex-shrink-0">
                              {formatDate(n.publishedAtMs)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                          {n.ctaThumbUrl && (
                            <div className="relative mt-2 rounded-lg overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={n.ctaThumbUrl} alt="" className="w-full h-28 object-cover" />
                              {n.ctaIsVideo && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                                  <span className="w-10 h-10 rounded-full bg-black/55 flex items-center justify-center">
                                    <Play className="w-5 h-5 text-white ml-0.5" />
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        {n.ctaArticleSlug && (
                          <ChevronRight className="w-4 h-4 text-gray-300 self-center flex-shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailView({
  item,
  onCta,
}: {
  item: AppNotificationItem;
  onCta: (slug: string) => void;
}) {
  const Icon = iconFor(item.iconName);
  return (
    <div className="p-4">
      <div className="w-11 h-11 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
      </div>
      <p className="font-extrabold text-gray-900 dark:text-white">{item.title}</p>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">{formatDate(item.publishedAtMs)}</p>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="w-full h-36 object-cover rounded-lg mb-3" />
      )}
      <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
        {item.modalBody || item.body}
      </p>

      {item.ctaArticleSlug && (
        <div className="mt-4">
          {item.ctaThumbUrl && (
            <button
              onClick={() => onCta(item.ctaArticleSlug!)}
              className="relative block w-full rounded-xl overflow-hidden mb-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.ctaThumbUrl} alt="" className="w-full h-40 object-cover" />
              {item.ctaIsVideo && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                  <span className="w-12 h-12 rounded-full bg-black/55 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  </span>
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => onCta(item.ctaArticleSlug!)}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl py-2.5 text-sm font-bold transition-colors"
          >
            {item.ctaIsVideo ? <PlayCircle className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
            {item.ctaLabel || (item.ctaIsVideo ? 'Voir la vidéo' : 'Voir le tutoriel')}
          </button>
        </div>
      )}
    </div>
  );
}
