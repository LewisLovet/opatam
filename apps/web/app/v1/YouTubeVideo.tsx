'use client';

import { useEffect, useRef, useState } from 'react';
import s from './v1.module.css';

type Player = { mute(): void; playVideo(): void; pauseVideo(): void; destroy(): void; getIframe(): HTMLIFrameElement };
type Options = { host: string; videoId: string; width: string; height: string; playerVars: Record<string, string | number>; events: { onReady(event: { target: Player }): void; onStateChange(event: { data: number }): void; onError(): void } };
type API = { Player: new (element: HTMLElement, options: Options) => Player };
type VideoWindow = Window & { YT?: API };
let apiPromise: Promise<API> | undefined;

function loadAPI() {
  const win = window as VideoWindow;
  if (win.YT?.Player) return Promise.resolve(win.YT);
  if (!apiPromise) apiPromise = new Promise<API>((resolve, reject) => {
    // Do not replace another feature's onYouTubeIframeAPIReady handler.
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (win.YT?.Player) { clearInterval(timer); resolve(win.YT); }
      else if (Date.now() - started > 15000) { clearInterval(timer); reject(new Error('YouTube API unavailable')); }
    }, 100);
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => { clearInterval(timer); script.remove(); reject(new Error('YouTube API unavailable')); };
      document.head.appendChild(script);
    }
  }).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise;
}

export function YouTubeVideo({ id, title, active, onPlay }: { id: string; title: string; active: boolean; onPlay?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | null>(null);
  const wantsPlayback = useRef(active);
  wantsPlayback.current = active;
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setReady(false);
    loadAPI().then(api => {
      if (cancelled || !host.current) return;
      const mount = document.createElement('div');
      host.current.replaceChildren(mount);
      player.current = new api.Player(mount, {
        host: 'https://www.youtube-nocookie.com', videoId: id, width: '100%', height: '100%',
        playerVars: { autoplay: 0, playsinline: 1, controls: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: ({ target }) => {
            if (cancelled) return;
            target.getIframe().title = title;
            target.getIframe().setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            target.mute();
            if (wantsPlayback.current) target.playVideo();
            setReady(true);
          },
          onError: () => { if (!cancelled) setFailed(true); },
          onStateChange: ({ data }) => { if (!cancelled && data === 1) onPlayRef.current?.(); },
        },
      });
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; player.current?.destroy(); player.current = null; };
  }, [id, title]);
  useEffect(() => {
    if (!ready || !player.current) return;
    if (active) player.current.playVideo();
    else player.current.pauseVideo();
  }, [active, ready]);
  return <><div ref={host} className={s.youtubeHost} />{failed && <div className={s.youtubeError}><p>Cette vidéo ne peut pas être lue ici.</p><a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noopener noreferrer">Voir sur YouTube</a></div>}</>;
}
