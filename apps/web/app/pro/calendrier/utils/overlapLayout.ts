import type { Booking } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export interface PositionedBooking {
  booking: WithId<Booking>;
  top: number;
  height: number;
  leftPercent: number;
  widthPercent: number;
  column: number;
  totalColumns: number;
  overlappingIds: string[];
}

/**
 * Compute side-by-side layout for overlapping bookings.
 *
 * Algorithm:
 * 1. Sort by top (start position), then by height descending
 * 2. Group by transitive overlap (sweep-line)
 * 3. Greedy column assignment within each group
 * 4. Calculate leftPercent / widthPercent from column index
 *
 * Non-overlapping bookings get totalColumns=1 (full width, no visual change).
 */
export function computeOverlapLayout(
  items: { booking: WithId<Booking>; top: number; height: number }[]
): PositionedBooking[] {
  if (items.length === 0) return [];

  // 1. Sort by top ascending, then height descending (longer events first)
  const sorted = [...items].sort((a, b) => {
    if (a.top !== b.top) return a.top - b.top;
    return b.height - a.height;
  });

  // 2. Build overlap groups using sweep-line
  const groups: (typeof sorted)[] = [];
  let currentGroup: typeof sorted = [];
  let groupEnd = -Infinity;

  for (const item of sorted) {
    const itemEnd = item.top + item.height;
    if (item.top < groupEnd) {
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, itemEnd);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [item];
      groupEnd = itemEnd;
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // 3. Assign columns greedily within each group
  const result: PositionedBooking[] = [];

  for (const group of groups) {
    const columns: { endTop: number }[] = [];
    const assignments: { item: (typeof group)[0]; column: number }[] = [];

    for (const item of group) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        if (item.top >= columns[c].endTop) {
          columns[c].endTop = item.top + item.height;
          assignments.push({ item, column: c });
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push({ endTop: item.top + item.height });
        assignments.push({ item, column: columns.length - 1 });
      }
    }

    const totalColumns = columns.length;
    const allIds = group.map((g) => g.booking.id);

    for (const { item, column } of assignments) {
      result.push({
        booking: item.booking,
        top: item.top,
        height: item.height,
        column,
        totalColumns,
        leftPercent: (column / totalColumns) * 100,
        widthPercent: (1 / totalColumns) * 100,
        overlappingIds: totalColumns > 1 ? allIds.filter((id) => id !== item.booking.id) : [],
      });
    }
  }

  return result;
}
