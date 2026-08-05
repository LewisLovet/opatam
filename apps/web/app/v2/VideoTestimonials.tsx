'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import s from './v2.module.css';
import { useReveal } from './useReveal';

export interface VideoTestimonial {
  id: string;
  /** Fichier vidéo. Aujourd'hui un exemple servi depuis /public ; demain une
   *  URL Firebase Storage renseignée depuis l'admin. */
  src: string;
  /** Affiche affichée avant lecture — c'est ELLE qui est chargée au premier
   *  rendu, pas la vidéo. */
  poster: string;
  quote: string;
  name: string;
  role: string;
}

/**
 * Témoignages en vidéo, verticaux, lus à la demande.
 *
 * LE POINT QUI FAIT TOUT : aucune vidéo n'est chargée au rendu de la page.
 * Chaque carte n'affiche qu'une affiche d'environ 40 Ko ; l'élément `<video>`
 * n'est créé qu'au clic. Trois témoignages coûtent donc ~120 Ko au lieu des
 * 15 à 30 Mo qu'un `<video preload="metadata">` réclamerait, et le LCP de la
 * page n'est pas affecté. On peut en aligner dix sans rien y perdre.
 *
 * Corollaire : la vidéo démarre AVEC le son, puisque le clic est un geste
 * délibéré du visiteur — aucun navigateur ne le bloque, contrairement à une
 * lecture automatique.
 */
export function VideoTestimonials({ items }: { items: VideoTestimonial[] }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  if (items.length === 0) return null;

  return (
    <section className={`${s.sec} ${s.secDark}`}>
      <div className={s.wrap}>
        <div ref={ref} className={`${s.reveal} ${shown ? s.revealed : ''}`}>
          <span className={s.eyebrow}>Elles en parlent mieux que nous</span>
          <h2 className={s.secTitle}>
            Ce que ça change,
            <br />
            dans leurs mots.
          </h2>
          <p className={s.secLead}>
            Des indépendantes qui utilisent Opatam tous les jours racontent ce qui a
            changé dans leur organisation.
          </p>
        </div>

        <div className={s.videos}>
          {items.map((item) => (
            <Card key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ item }: { item: VideoTestimonial }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const start = () => {
    setPlaying(true);
    // La lecture est demandée à l'image suivante : l'élément <video> vient
    // d'être monté, `videoRef` est encore vide dans ce tour de rendu.
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {
        // Lecture refusée (économiseur de données, réglage système) : les
        // contrôles natifs restent affichés, le visiteur relance lui-même.
      });
    });
  };

  return (
    <figure className={s.videoCard} style={{ margin: 0 }}>
      {playing ? (
        <video
          ref={videoRef}
          className={s.videoEl}
          src={item.src}
          poster={item.poster}
          controls
          playsInline
          preload="auto"
          style={{ aspectRatio: '9 / 16' }}
        />
      ) : (
        <button
          type="button"
          className={s.videoFrame}
          onClick={start}
          aria-label={`Lire le témoignage de ${item.name}`}
        >
          <Image
            src={item.poster}
            alt=""
            width={540}
            height={960}
            className={s.videoPoster}
            /* Trois colonnes au-delà de 760 px, une seule en dessous : sans
               cette indication, Next servirait l'image pleine largeur sur
               mobile. */
            sizes="(min-width: 760px) 33vw, 100vw"
          />
          <span className={s.videoPlay}>
            <span className={s.videoPlayDot}>
              <svg width="20" height="22" viewBox="0 0 20 22" fill="#fff" aria-hidden="true">
                <path d="M19 9.27a2 2 0 0 1 0 3.46L3 21.99a2 2 0 0 1-3-1.73V1.74A2 2 0 0 1 3 .01l16 9.26Z" />
              </svg>
            </span>
          </span>
        </button>
      )}

      <figcaption className={s.videoBody}>
        <p className={s.videoQuote}>« {item.quote} »</p>
        <div className={s.videoWho}>
          <span className={s.videoWhoName}>{item.name}</span>
          <span className={s.videoWhoRole}>· {item.role}</span>
        </div>
      </figcaption>
    </figure>
  );
}
