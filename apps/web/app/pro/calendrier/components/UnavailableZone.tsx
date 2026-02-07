'use client';

interface UnavailableZoneProps {
  top: number;
  height: number;
  reason?: string;
  type: 'closed' | 'blocked' | 'break' | 'past';
}

/**
 * Visual styles for different types of unavailable zones:
 * - closed: Business hours outside availability (light gray)
 * - blocked: Manually blocked slots (red hatched)
 * - break: Lunch break or pause (light hatched)
 * - past: Time that has passed (dimmed)
 */
const zoneStyles: Record<UnavailableZoneProps['type'], {
  bg: string;
  pattern?: string;
  patternSize?: string;
  opacity?: string;
}> = {
  closed: {
    bg: 'bg-gray-50 dark:bg-gray-800/40',
    pattern: 'radial-gradient(circle, rgba(156, 163, 175, 0.2) 1px, transparent 1px)',
    patternSize: '8px 8px',
  },
  blocked: {
    bg: 'bg-error-50/80 dark:bg-error-900/30',
    pattern: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 1px, transparent 1px)',
    patternSize: '6px 6px',
  },
  break: {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    pattern: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.15) 4px, rgba(156, 163, 175, 0.15) 8px)',
  },
  past: {
    bg: 'bg-gray-50 dark:bg-gray-800/30',
    opacity: 'opacity-50',
  },
};

/**
 * Unavailable zone component with hatched pattern for visual distinction.
 * Used to mark closed hours, blocked slots, and breaks on the calendar.
 */
export function UnavailableZone({
  top,
  height,
  reason,
  type,
}: UnavailableZoneProps) {
  const styles = zoneStyles[type];

  return (
    <div
      className={`absolute left-0 right-0 ${styles.bg} ${styles.opacity || ''}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundImage: styles.pattern,
        backgroundSize: styles.patternSize,
      }}
      title={reason || getDefaultTitle(type)}
    />
  );
}

function getDefaultTitle(type: UnavailableZoneProps['type']): string {
  switch (type) {
    case 'closed':
      return 'Fermé';
    case 'blocked':
      return 'Bloqué';
    case 'break':
      return 'Pause';
    case 'past':
      return 'Passé';
  }
}

/**
 * Past time overlay that dims the portion of today that has already passed.
 * Only renders on today's column.
 */
export function PastTimeOverlay({
  date,
  startHour,
  slotHeight,
}: {
  date: Date;
  startHour: number;
  slotHeight: number;
}) {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayDate = new Date(date);
  dayDate.setHours(0, 0, 0, 0);

  // Only show on today
  if (dayDate.getTime() !== today.getTime()) return null;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // If we're before the calendar start hour, don't show
  if (currentHour < startHour) return null;

  // Calculate the height of the past portion
  const minutesSinceStart = (currentHour - startHour) * 60 + currentMinute;
  const height = (minutesSinceStart / 60) * slotHeight;

  return (
    <div
      className="absolute left-0 right-0 top-0 bg-gray-50/60 dark:bg-gray-800/20 pointer-events-none z-[5]"
      style={{ height: `${height}px` }}
    />
  );
}

/**
 * Blocked slot with distinct red hatched pattern.
 */
export function BlockedSlotZone({
  top,
  height,
  reason,
  isAllDay,
}: {
  top: number;
  height: number;
  reason?: string;
  isAllDay?: boolean;
}) {
  return (
    <div
      className="absolute left-0 right-0 bg-error-50/80 dark:bg-error-900/30"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        backgroundImage: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 1px, transparent 1px)',
        backgroundSize: '6px 6px',
      }}
      title={reason || (isAllDay ? 'Journée bloquée' : 'Créneau bloqué')}
    >
      {/* Optional label for longer blocks */}
      {height >= 40 && reason && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-error-600 dark:text-error-400 bg-white/80 dark:bg-gray-900/80 px-2 py-0.5 rounded">
            {reason}
          </span>
        </div>
      )}
    </div>
  );
}
