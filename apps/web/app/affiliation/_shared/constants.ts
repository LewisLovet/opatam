export const BASE_PRICE_TTC = 19.9;
export const TVA_RATE = 0.2;

export const DURATION_LABELS: Record<string, string> = {
  once: 'le 1er mois',
  repeating_3: 'les 3 premiers mois',
  repeating_12: 'la 1ère année',
  forever: 'permanent',
};

export interface Milestone {
  target: number;
  label: string;
  gradient: string;
  bg: string;
  text: string;
}

export const MILESTONES: Milestone[] = [
  { target: 20, label: 'Bronze', gradient: 'from-amber-600 to-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  { target: 50, label: 'Argent', gradient: 'from-gray-500 to-gray-400', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
  { target: 100, label: 'Or', gradient: 'from-yellow-500 to-amber-400', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  { target: 200, label: 'Platine', gradient: 'from-cyan-600 to-teal-500', bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700' },
  { target: 500, label: 'Diamant', gradient: 'from-blue-600 to-indigo-500', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  { target: 1000, label: 'Elite', gradient: 'from-violet-600 to-purple-500', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
  { target: 2500, label: 'Master', gradient: 'from-purple-600 to-pink-500', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  { target: 5000, label: 'Legende', gradient: 'from-primary-600 to-indigo-600', bg: 'bg-primary-50 border-primary-200', text: 'text-primary-700' },
];

/**
 * Compute commission amounts based on affiliate config and base price.
 * Uses HT (exclusive of VAT) as the commission base.
 */
export function computeCommission(args: {
  commission: number;
  discount: number | null;
  discountDuration: string | null;
}) {
  const commissionRate = args.commission / 100;
  const hasDiscount = !!args.discount && args.discount > 0;
  const discountRate = hasDiscount ? args.discount! / 100 : 0;
  const isOngoingDiscount = args.discountDuration === 'forever';

  const firstMonthTTC = BASE_PRICE_TTC * (1 - discountRate);
  const firstMonthHT = firstMonthTTC / (1 + TVA_RATE);
  const firstMonthCommission = firstMonthHT * commissionRate;

  const recurringTTC = isOngoingDiscount ? firstMonthTTC : BASE_PRICE_TTC;
  const recurringHT = recurringTTC / (1 + TVA_RATE);
  const recurringCommission = recurringHT * commissionRate;

  return {
    commissionRate,
    hasDiscount,
    discountRate,
    isOngoingDiscount,
    firstMonthTTC,
    firstMonthHT,
    firstMonthCommission,
    recurringTTC,
    recurringHT,
    recurringCommission,
  };
}
