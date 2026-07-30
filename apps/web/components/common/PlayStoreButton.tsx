/**
 * Bouton « Google Play » — lien vers la fiche Play Store.
 *
 * Ce composant remplace `PlayStoreWaitlistButton`, qui ouvrait un formulaire
 * d'attente parce que l'application Android n'était pas publiée et que le
 * lien direct menait à une page d'erreur. Elle est en ligne depuis le
 * 29 juillet 2026, donc le bouton redevient ce qu'il aurait toujours dû
 * être : un lien.
 *
 * Il conserve `className`, `style` et le contenu de l'appelant, exactement
 * comme la version précédente : chaque emplacement garde son apparence
 * (pastille compacte sur la confirmation, bouton pleine largeur dans
 * l'embed…), seule la balise change. C'est ce qui permet de basculer les cinq
 * emplacements sans les redessiner.
 */

import { PLAY_STORE_URL } from '@/lib/store-links';

interface PlayStoreButtonProps {
  className?: string;
  style?: React.CSSProperties;
  /** Contenu du bouton (icône + libellé). */
  children: React.ReactNode;
  'aria-label'?: string;
}

export function PlayStoreButton({
  className,
  style,
  children,
  'aria-label': ariaLabel,
}: PlayStoreButtonProps) {
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      aria-label={ariaLabel}
    >
      {children}
    </a>
  );
}
