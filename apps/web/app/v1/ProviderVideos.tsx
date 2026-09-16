'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, ArrowUpRight, Play } from 'lucide-react';
import type { LandingVideoItem } from '@booking-app/shared';
import { extractYouTubeId } from '@/lib/youtube';
import { meilleureAfficheYoutube } from '@/lib/youtubePoster';
import { trackSite } from '@/lib/trackSite';
import { YouTubeVideo } from './YouTubeVideo';
import s from './v1.module.css';

// Only display fields cross the server/client boundary; never admin metadata.
export type ProviderVideo = Pick<LandingVideoItem, 'id' | 'kind' | 'src' | 'youtubeId' | 'poster' | 'providerSlug' | 'businessName' | 'subtitle' | 'photoURL' | 'quote'>;

export function ProviderVideos({ items }: { items: ProviderVideo[] }) {
  const t = useTranslations('landing.videos');
  const rail = useRef<HTMLDivElement>(null);
  const requested = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    let frame = 0;
    const sync = () => {
      const bounds = element.getBoundingClientRect();
      const cards = [...element.querySelectorAll<HTMLElement>('[data-video-id]')];
      const nearest = cards.reduce<HTMLElement | null>((best, card) => !best || Math.abs(card.getBoundingClientRect().left - bounds.left) < Math.abs(best.getBoundingClientRect().left - bounds.left) ? card : best, null);
      setActiveId(requested.current ?? nearest?.dataset.videoId ?? null);
      setEdges({ start: element.scrollLeft < 3, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 3 });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
    element.addEventListener('scroll', schedule, { passive: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(element);
    sync();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); element.removeEventListener('scroll', schedule); };
  }, [items]);
  const move = (direction: number) => {
    const element = rail.current;
    if (!element) return;
    const card = element.querySelector<HTMLElement>('[data-video-id]');
    const cards = [...element.querySelectorAll<HTMLElement>('[data-video-id]')];
    const current = cards.findIndex(card => card.dataset.videoId === activeId);
    const target = cards[Math.max(0, Math.min(cards.length - 1, current + direction))];
    requested.current = target?.dataset.videoId ?? null;
    setActiveId(requested.current);
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollBy({ left: direction * ((card?.offsetWidth ?? element.clientWidth) + gap), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  // Sans sélection publiée, la section DISPARAÎT. Elle affichait sinon trois
  // fois le même extrait de présentation sous des noms inventés
  // (« Aperçu vidéo 1/2/3 ») et une note d'atelier destinée à l'équipe —
  // du remplissage, visible par les visiteurs.
  if (!items.length) return null;
  return <section id="videos" className={s.providerSection}>
    <div className={s.wrap}>
      <div className={s.providerHeading} data-reveal><div><p className={s.eyebrow}>{t('eyebrow')}</p><h2>{t('title1')}<br /><em>{t('title2')}</em></h2></div><p>{t('lead')}</p></div>
      <div className={s.carouselToolbar}><p>{t('explore')}</p><div><button onClick={() => move(-1)} disabled={edges.start} aria-label={t('prev')} aria-controls="provider-carousel"><ArrowLeft size={21} /></button><button onClick={() => move(1)} disabled={edges.end} aria-label={t('next')} aria-controls="provider-carousel"><ArrowRight size={21} /></button></div></div>
      <div ref={rail} id="provider-carousel" className={s.providerRail} role="region" aria-roledescription={t('carousel')} aria-label={t('regionAria')} tabIndex={0} onPointerDown={() => { requested.current = null; }} onWheel={() => { requested.current = null; }} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>{items.map(item => <VideoCard key={item.id} item={item} selected={activeId === item.id} onActivate={() => setActiveId(item.id)} />)}</div>
    </div>
  </section>;
}

function youtubeIdFromUrl(src: string) {
  try {
    const url = new URL(src);
    if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname)) return null;
    const id = extractYouTubeId(src);
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

function VideoCard({ item, selected, onActivate }: { item: ProviderVideo; selected: boolean; onActivate: () => void }) {
  const t = useTranslations('landing.videos');
  const media = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [manual, setManual] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // `youtubeId` fourni par l'admin d'abord ; le parsing de `src` reste le
  // repli pour les entrées enregistrées avant que le champ existe.
  const id = (item.kind === 'youtube' && item.youtubeId) || youtubeIdFromUrl(item.src);
  // L'affiche enregistrée peut être la petite (480 × 360) : les premières
  // entrées l'ont été ainsi. On cherche mieux au rendu, sans bloquer
  // l'affichage — la petite reste en place tant que la grande n'est pas là.
  const [poster, setPoster] = useState(item.poster);
  useEffect(() => {
    if (!id || !/\/hqdefault\.jpg$/.test(item.poster)) return;
    let cancelled = false;
    void meilleureAfficheYoutube(id).then(url => { if (!cancelled && url !== item.poster) setPoster(url); });
    return () => { cancelled = true; };
  }, [id, item.poster]);
  const active = selected && visible && (!reduced || manual);
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    const sync = () => { setReduced(motion.matches); setVisible(inView && !document.hidden); };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= .25;
      sync();
    }, { threshold: [0, .25] });
    if (media.current) observer.observe(media.current);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); motion.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  useEffect(() => { if (active) setLoaded(true); }, [active]);
  useEffect(() => {
    if (id || !video.current) return;
    if (active) void video.current.play().then(() => setBlocked(false)).catch(error => {
      if (error.name === 'NotAllowedError') setBlocked(true);
    });
    else video.current.pause();
  }, [active, loaded, id]);
  const play = () => {
    trackSite('video:play');
    onActivate();
    setManual(true);
    setLoaded(true);
    if (video.current) void video.current.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };
  return <figure className={s.providerCard} data-video-id={item.id} data-selected={selected}>
    <div ref={media} className={s.providerMedia}>{loaded ? id
      ? <YouTubeVideo id={id} title={t('videoLabel', { name: item.businessName })} active={active} onPlay={onActivate} />
      : <video ref={video} src={item.src} poster={item.poster || undefined} muted playsInline controls preload="metadata" onPlay={onActivate} onError={() => setFailed(true)} aria-label={t('videoLabel', { name: item.businessName })} />
      : <button onClick={play} aria-label={t('playLabel', { name: item.businessName })}>{poster ? <Image src={poster} alt="" fill sizes="(max-width: 760px) 85vw, 33vw" /> : <span className={s.noPoster}>{item.businessName}</span>}<span className={s.providerPlay}><Play size={25} fill="currentColor" /></span><span className={s.watchLabel}>{t('watch')}</span></button>}
      {blocked && !failed && <button className={s.autoplayFallback} onClick={play}>{t('play')} <Play size={18} /></button>}
    </div>
    {failed && <p className={s.videoError} role="status">{t('error')}</p>}
    <figcaption>{item.quote && <blockquote>« {item.quote} »</blockquote>}<div className={s.providerIdentity}>{item.photoURL && <Image src={item.photoURL} alt="" width={44} height={44} />}<div><strong>{item.businessName}</strong>{item.subtitle && <span>{item.subtitle}</span>}</div></div>
      {item.providerSlug && <a className={s.providerCta} href={`https://opatam.com/p/${encodeURIComponent(item.providerSlug)}`} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('video:provider')} aria-label={t('ctaAria', { name: item.businessName })}>{t('cta')} <ArrowUpRight size={19} /></a>}
    </figcaption>
  </figure>;
}
