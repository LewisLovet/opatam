'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import s from './v2.module.css';

/**
 * Héro épinglé : le téléphone déroule le parcours de réservation pendant
 * que le visiteur défile.
 *
 * Le rail mesure 300 vh et l'intérieur est `sticky`. La progression dans ce
 * rail pilote l'écran affiché — le visiteur ne perd jamais la main sur son
 * défilement, contrairement à un vrai scroll-jacking, mais il voit les
 * quatre étapes sans avoir à cliquer.
 *
 * La position est lue dans un `requestAnimationFrame` : l'événement de
 * défilement se déclenche bien plus souvent qu'une image, et recalculer à
 * chaque déclenchement ferait tomber le taux de rafraîchissement.
 */
const SCREENS = 4;

export function HeroV2() {
  const railRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let raf = 0;
    let queued = false;

    const measure = () => {
      queued = false;
      const rect = rail.getBoundingClientRect();
      // Course utile : du moment où le rail est en haut jusqu'à sa fin.
      const travel = rail.offsetHeight - window.innerHeight;
      if (travel <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / travel));
      // Le dernier écran occupe la fin du rail : on répartit la course sur
      // SCREENS segments plutôt que SCREENS - 1, sinon l'écran final
      // n'apparaît qu'au tout dernier pixel.
      const next = Math.min(SCREENS - 1, Math.floor(progress * SCREENS));
      setStep((prev) => (prev === next ? prev : next));
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div className={s.heroRail} ref={railRef}>
      <div className={s.heroSticky}>
        {/*
          La vidéo d'ambiance reste la même que l'accueil actuel — elle est
          déjà encodée, mise en cache par le CDN, et sert ici de texture
          derrière un voile épais. `preload="metadata"` : elle ne doit pas
          disputer sa bande passante au premier rendu.
        */}
        <video
          className={s.heroVideo}
          src="/hero-loop.mp4"
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden="true"
        />
        <div className={s.heroVeil} />

        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div>
            <span className={s.eyebrow}>Pour les indépendants</span>
            <h1 className={s.heroTitle}>
              La réservation en ligne,
              <br />
              sans commission.
            </h1>
            <p className={s.heroLead}>
              Vos clients réservent 24 h/24 sur votre page. Vous gardez 100 % de vos gains.
            </p>

            <div className={s.heroCtas}>
              <Link href="/register" className={`${s.btn} ${s.btnPrimary}`}>
                Créer ma page
              </Link>
              <Link href="/p/salon-de-coiffure" className={`${s.btn} ${s.btnGhost}`}>
                Voir une démo →
              </Link>
            </div>

            <p className={s.heroFine}>
              30 jours gratuits · sans carte bancaire · sans engagement
            </p>

            <div className={s.heroChips}>
              <span className={s.chip}>
                Prêt en <b>5 min</b>
              </span>
              <span className={s.chip}>
                <b>0 %</b> de commission
              </span>
              <span className={s.chip}>
                Dès <b>19,90 €</b>/mois
              </span>
            </div>
          </div>

          <div className={s.phoneWrap}>
            {/* `phoneEnter` porte l'arrivée puis le flottement. La classe est
                posée sur le téléphone lui-même et non sur le conteneur : le
                conteneur porte la perspective, qui doit rester fixe. */}
            <Phone step={step} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Maquette d'écran : purement décorative, donc masquée aux lecteurs d'écran. */
function Phone({ step }: { step: number }) {
  return (
    <div className={`${s.phone} ${s.phoneEnter}`} aria-hidden="true">
      <div className={s.notch} />

      {/* 1 — choix de la prestation */}
      <div className={`${s.screen} ${step === 0 ? s.screenOn : ''}`}>
        <Head />
        <div className={s.screenBody}>
          <span className={s.label}>Choisir une prestation</span>
          {[
            ['Pose gel', '1 h 15', '45 €'],
            ['Remplissage', '1 h', '35 €'],
            ['Nail art — 2 ongles', '20 min', '8 €'],
            ['Dépose', '30 min', '15 €'],
          ].map(([name, dur, price], i) => (
            <div key={name} className={`${s.row} ${i === 0 ? s.rowOn : ''}`}>
              <span>
                <strong>{name}</strong>
                <br />
                <span style={{ color: '#8892ab', fontSize: 13 }}>{dur}</span>
              </span>
              <strong>{price}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* 2 — choix du créneau */}
      <div className={`${s.screen} ${step === 1 ? s.screenOn : ''}`}>
        <Head />
        <div className={s.screenBody}>
          <span className={s.label}>Jeudi — créneaux libres</span>
          <div className={s.slots}>
            {['9:00', '10:30', '12:00', '14:30', '16:00', '17:30'].map((h, i) => (
              <div
                key={h}
                className={`${s.slot} ${i === 0 || i === 2 || i === 5 ? s.slotOff : ''}`}
              >
                {h}
              </div>
            ))}
          </div>
          <div className={s.phoneCta}>Réserver — 45 €</div>
        </div>
      </div>

      {/* 3 — créneau sélectionné */}
      <div className={`${s.screen} ${step === 2 ? s.screenOn : ''}`}>
        <Head />
        <div className={s.screenBody}>
          <span className={s.label}>Jeudi — créneaux libres</span>
          <div className={s.slots}>
            {['9:00', '10:30', '12:00', '14:30', '16:00', '17:30'].map((h, i) => (
              <div
                key={h}
                className={`${s.slot} ${
                  i === 3 ? s.slotOn : i === 0 || i === 2 || i === 5 ? s.slotOff : ''
                }`}
              >
                {h}
              </div>
            ))}
          </div>
          <div className={s.phoneCta}>Réserver — 45 €</div>
        </div>
      </div>

      {/* 4 — confirmation */}
      <div className={`${s.screen} ${step === 3 ? s.screenOn : ''}`}>
        <Head />
        <div className={s.done}>
          <div className={s.doneMark}>✓</div>
          <strong style={{ fontSize: 19 }}>C&apos;est réservé</strong>
          <span style={{ color: '#68738d', fontSize: 14 }}>
            Pose gel · Jeudi 30 à 14:30
          </span>
          <span style={{ color: '#8892ab', fontSize: 13 }}>
            Un rappel sera envoyé la veille.
          </span>
        </div>
      </div>

      <div className={`${s.push} ${step === 3 ? s.pushOn : ''}`}>
        <div className={s.pushIcon}>
          <span style={{ color: '#F4C928', fontWeight: 700, fontSize: 15 }}>O</span>
        </div>
        <span style={{ fontSize: 13, lineHeight: 1.4, color: '#101B38' }}>
          <strong>Nouvelle réservation</strong>
          <br />
          Manon · Pose gel · Jeu 14:30
        </span>
      </div>
    </div>
  );
}

function Head() {
  return (
    <div className={s.screenHead}>
      <div className={s.avatar}>CB</div>
      <div style={{ color: '#fff', lineHeight: 1.3 }}>
        <strong style={{ fontSize: 15 }}>Cam Beauty Studio</strong>
        <br />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>
          Nail artist · Lyon 3ᵉ
        </span>
      </div>
      <span style={{ marginLeft: 'auto', color: '#F4C928', fontSize: 13 }}>★ 4,9</span>
    </div>
  );
}
