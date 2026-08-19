'use client';

import { useEffect, useMemo, useState } from 'react';
import { BrandLoading } from './BrandLoading';

/**
 * Un rideau qui tient le temps que les images du haut de page arrivent.
 *
 * Le problème qu'il traite : la page est rendue par le serveur, donc elle
 * arrive complète — mais les photos, elles, viennent de Firebase Storage et
 * descendent APRÈS. On voyait donc la mise en page se remplir par morceaux,
 * cadres gris puis couverture, pastille vide puis logo. Rien n'était cassé,
 * mais ça donnait l'impression de quelque chose de mal tenu.
 *
 * DEUX GARDE-FOUS, parce qu'un rideau est une chose dangereuse :
 *
 *  1. Un PLAFOND. Le rideau se lève au bout de 1,5 s quoi qu'il arrive. Une
 *     image lente, un Storage indisponible, une URL morte : rien de tout cela
 *     ne peut retenir la page. On attend les images, on ne se lie pas à elles.
 *
 *  2. Le plafond est écrit en CSS, pas en JavaScript. Sans JS — un robot, un
 *     navigateur en échec d'hydratation — l'animation lève quand même le
 *     rideau. Un rideau qui dépendrait du JS pour se lever finirait un jour
 *     par masquer la page pour de bon.
 *
 * Le contenu reste dans le DOM DERRIÈRE le rideau, jamais démonté : il est
 * déjà rendu par le serveur, et l'enlever le priverait de son intérêt pour
 * l'indexation comme du travail déjà fait.
 *
 * On n'attend QUE les images du haut de page. Les prestations et le
 * portfolio, plus bas, se chargent normalement pendant la lecture — les
 * attendre ferait payer à tout le monde des images que personne ne regarde
 * encore.
 */
export function PageRevealGate({
  images,
  label,
}: {
  images: (string | null | undefined)[];
  label: string;
}) {
  const sources = useMemo(
    () => images.filter((src): src is string => !!src),
    // La liste vient de props sérialisées : sa VALEUR est stable, son
    // identité non. On la compare sur son contenu, sinon l'effet se relance
    // à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [images.filter(Boolean).join('|')]
  );

  const [pret, setPret] = useState(sources.length === 0);
  // Rien à attendre — un prestataire sans photo ni logo : on ne monte pas le
  // rideau du tout. Le monter déjà transparent le laisserait accroché, faute
  // de transition à écouter pour le retirer.
  const [monte, setMonte] = useState(sources.length > 0);

  useEffect(() => {
    if (sources.length === 0) return;
    let vivant = true;
    const lever = () => vivant && setPret(true);

    const plafond = setTimeout(lever, 1500);
    Promise.all(
      sources.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => resolve();
            // Une image en échec ne doit pas retenir la page plus longtemps
            // qu'une image qui arrive.
            img.onerror = () => resolve();
            img.src = src;
            if (img.complete) resolve();
          })
      )
    ).then(lever);

    return () => {
      vivant = false;
      clearTimeout(plafond);
    };
  }, [sources]);

  if (!monte) return null;

  return (
    <div
      className={`opatam-gate${pret ? ' est-pret' : ''}`}
      onTransitionEnd={() => setMonte(false)}
      aria-hidden={pret}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
.opatam-gate {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  opacity: 1;
  transition: opacity .35s ease;
  /* Le plafond, en CSS : sans JavaScript le rideau se leve quand meme. */
  animation: opatam-gate-out .35s ease 1.6s forwards;
}
.opatam-gate.est-pret { opacity: 0; pointer-events: none; }
@keyframes opatam-gate-out { to { opacity: 0; visibility: hidden; } }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .opatam-gate { background: #030712; }
}
:root[data-theme="dark"] .opatam-gate { background: #030712; }`,
        }}
      />
      <BrandLoading label={label} />
    </div>
  );
}
