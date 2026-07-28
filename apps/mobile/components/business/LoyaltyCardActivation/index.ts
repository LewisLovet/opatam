/**
 * LoyaltyCardActivation — carte à tampons + cérémonie d'activation.
 *
 * NOTE : importé en direct (`components/business/LoyaltyCardActivation`)
 * plutôt que via les barrels `components/business/index.ts` — même choix que
 * `hooks/useLoyaltyCards`, pour éviter les conflits avec les chantiers
 * parallèles qui éditent ces fichiers d'export.
 */

export { ConfettiRain, type ConfettiRainProps } from './ConfettiRain';
export { StampRow, type StampRowProps } from './StampRow';
export {
  ActivateLoyaltyButton,
  type ActivateLoyaltyButtonProps,
} from './ActivateLoyaltyButton';
export {
  LoyaltyActivationCard,
  type LoyaltyActivationCardProps,
} from './LoyaltyActivationCard';
export {
  LoyaltyActivationSheet,
  type LoyaltyActivationSheetProps,
} from './LoyaltyActivationSheet';
