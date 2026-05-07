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
 * Blocked slot zone with distinct red hatched pattern. When the
 * underlying blockedSlot is an "activity" (has `category` set), the
 * companion <ActivityZone> is used instead to render a colorful
 * foreground card. Plain blocked periods (vacation, training…) keep
 * the dotted pattern below.
 *
 * Becomes a clickable button when `onClick` is provided so the pro
 * can open the edit/delete modal — without it the click bubbles up
 * to the column's drag handler and would (incorrectly) open the
 * booking creation popover on top of the blocked zone.
 */
export function BlockedSlotZone({
  top,
  height,
  reason,
  isAllDay,
  onClick,
}: {
  top: number;
  height: number;
  reason?: string;
  isAllDay?: boolean;
  onClick?: () => void;
}) {
  const stopAndOpen = (e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => onClick && stopAndOpen(e)}
      disabled={!onClick}
      className={`absolute left-0 right-0 bg-error-50/80 dark:bg-error-900/30 ${onClick ? 'cursor-pointer hover:brightness-95 transition-[filter]' : 'cursor-default'} text-left`}
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
    </button>
  );
}

/**
 * Personal activity card — solid category color, white text. Sits on
 * the same calendar layer as bookings (foreground) instead of in the
 * background like a blocked period. Address + notes are surfaced
 * inline when there's vertical space.
 */
export function ActivityZone({
  top,
  height,
  color,
  title,
  startTime,
  endTime,
  address,
  notes,
  onClick,
}: {
  top: number;
  height: number;
  color: string;
  title: string;
  startTime: string;
  endTime: string;
  address?: string | null;
  notes?: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      // Stop propagation so the click doesn't bubble up to the day
      // column's slot-click handler (which would open the booking
      // creation modal on top of the activity edit modal).
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-0.5 right-0.5 rounded-md text-left px-2 py-1 overflow-hidden hover:brightness-110 transition-[filter] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-1"
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 18)}px`,
        backgroundColor: color,
      }}
      title={`${title}${notes ? ` — ${notes}` : ''}`}
    >
      <div className="text-[11px] font-bold text-white truncate leading-tight">
        {title}
      </div>
      {height >= 28 && (
        <div className="text-[10px] text-white/80 truncate leading-tight mt-0.5">
          {startTime}–{endTime}
        </div>
      )}
      {height >= 48 && address && (
        <div className="text-[10px] text-white/85 truncate leading-tight mt-0.5">
          📍 {address}
        </div>
      )}
      {height >= 70 && notes && (
        <div className="text-[10px] text-white/80 italic leading-tight mt-1 line-clamp-2">
          {notes}
        </div>
      )}
    </button>
  );
}
