// Calendar components
export { TimeGrid, calculateBlockPosition, calculatePositionFromTimeString, getTimeFromPosition } from './TimeGrid';
export { BookingBlock, BookingBlockCompact } from './BookingBlock';
export { DayView } from './DayView';
export { WeekView } from './WeekView';
export { CreateBookingModal } from './CreateBookingModal';
export { SelectMemberPrompt } from './SelectMemberPrompt';

// New UX components
export { NowIndicator, NowIndicatorFullWidth } from './NowIndicator';
export { SlotPopover, getVisualStatus, type VisualStatus } from './SlotPopover';
export { DayHeaderWithGauge, DayHeaderCompact } from './DayHeaderWithGauge';
export { UnavailableZone, PastTimeOverlay, BlockedSlotZone } from './UnavailableZone';
