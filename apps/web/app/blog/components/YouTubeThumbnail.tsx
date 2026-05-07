'use client';

/**
 * YouTubeThumbnail — Next/Image wrapper that loads `maxresdefault.jpg`
 * (1280×720) from i.ytimg.com first and falls back to `hqdefault.jpg`
 * (480×360) on 404. Most modern uploads have an HD thumbnail, but
 * older / pre-2018 videos sometimes don't — without this fallback we
 * either ship a broken image or stick to the smaller hq cover and
 * accept the pixelation on large cards.
 */

import Image from 'next/image';
import { useState, useMemo } from 'react';
import { extractYouTubeId } from '@/lib/youtube';

interface Props {
  /** Full YouTube watch / share / embed URL. */
  videoUrl: string | null | undefined;
  alt?: string;
  /** Forwarded to <Image>. Defaults to a sensible card sizing. */
  sizes?: string;
  className?: string;
}

export function YouTubeThumbnail({
  videoUrl,
  alt = '',
  sizes = '(max-width: 640px) 100vw, 50vw',
  className = 'object-cover',
}: Props) {
  const id = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);
  // Once the maxres URL 404s for this id, remember to skip it on
  // subsequent renders (e.g. after a parent re-render). Keyed on the
  // video id so a different video starts fresh.
  const [fallbackForId, setFallbackForId] = useState<string | null>(null);

  if (!id) return null;

  const useFallback = fallbackForId === id;
  const src = useFallback
    ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => {
        if (!useFallback) setFallbackForId(id);
      }}
    />
  );
}
