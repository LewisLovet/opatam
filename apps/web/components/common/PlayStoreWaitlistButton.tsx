'use client';

/**
 * Bouton « Google Play » — l'application Android n'est PAS publiée.
 *
 * Le lien direct vers la fiche Play Store menait à une page d'erreur : il
 * ne faut donc jamais y renvoyer tant que l'app n'est pas en ligne. Ce
 * bouton ouvre à la place le formulaire d'attente (le même que la page
 * d'accueil) et affiche un badge « Bientôt ».
 *
 * Il conserve `className`, `style` et le contenu de l'appelant : chaque
 * emplacement garde son apparence (pastille compacte sur la confirmation,
 * bouton pleine largeur dans l'embed…), seule la balise change — un `<a>`
 * qui partait vers le store devient un `<button>` qui ouvre la modale.
 *
 * Le jour de la publication Android, il suffira de remettre un lien ici.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlayStoreWaitlistModal } from './PlayStoreWaitlistModal';

interface PlayStoreWaitlistButtonProps {
  className?: string;
  style?: React.CSSProperties;
  /** Contenu du bouton (icône + libellé), inchangé par rapport au lien. */
  children: React.ReactNode;
  /** Badge « Bientôt » en pastille flottante. À désactiver quand le bouton
   *  est trop petit ou dans un conteneur qui rogne le débordement. */
  showBadge?: boolean;
}

export function PlayStoreWaitlistButton({
  className,
  style,
  children,
  showBadge = true,
}: PlayStoreWaitlistButtonProps) {
  const t = useTranslations('home.appStrip');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={showBadge ? `${className ?? ''} relative` : className}
        style={style}
      >
        {children}
        {showBadge && (
          <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full shadow whitespace-nowrap">
            {t('soonBadge')}
          </span>
        )}
      </button>
      <PlayStoreWaitlistModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
