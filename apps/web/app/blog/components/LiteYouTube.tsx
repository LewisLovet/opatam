'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { extractYouTubeId } from '@/lib/youtube';

interface LiteYouTubeProps {
  /** Full YouTube URL — we extract the video ID. */
  url: string;
  /** Custom poster shown before play. Falls back to YouTube's maxres thumb. */
  posterURL?: string | null;
  /** Optional title for accessibility / iframe title. */
  title?: string;
}

/**
 * "Lite" YouTube embed — shows a static poster (custom or YouTube auto-thumb)
 * until the user clicks. The actual iframe is loaded on demand which keeps
 * the page lightweight (no YouTube JS shipped on initial render). After
 * playback, modestbranding + rel=0 keep the chrome minimal.
 */
export function LiteYouTube({ url, posterURL, title = 'Vidéo' }: LiteYouTubeProps) {
  const [activated, setActivated] = useState(false);
  const videoId = extractYouTubeId(url);

  if (!videoId) {
    // Bad URL — render a graceful fallback rather than blowing up
    return (
      <div className="aspect-video rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Vidéo indisponible
      </div>
    );
  }

  const poster =
    posterURL || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  if (activated) {
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={`Lire la vidéo : ${title}`}
      className="group relative aspect-video w-full rounded-xl overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      {/* Poster image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
        // If the poster fails (e.g., no maxres), fall back to hqdefault which
        // is guaranteed to exist for any YouTube video.
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.src.endsWith('/hqdefault.jpg')) {
            img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }
        }}
      />

      {/* Dim overlay for contrast */}
      <span className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

      {/* Play button — branded with primary color */}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-600 group-hover:bg-primary-700 transition-colors flex items-center justify-center shadow-2xl">
          <Play className="w-7 h-7 sm:w-9 sm:h-9 text-white ml-1" fill="currentColor" />
        </span>
      </span>
    </button>
  );
}
