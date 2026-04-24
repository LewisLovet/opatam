'use client';

import Image from 'next/image';

interface EmbedHeaderProps {
  businessName: string;
  photoURL: string | null;
  /** Optional: show a small "Prochain créneau : ..." hint under the name. */
  subtitle?: string | null;
}

/**
 * Compact header shown above the booking flow when the widget is rendered
 * inside a modal (popup / floating mode). The pro's site doesn't surround
 * it in those cases so the client needs a visual anchor confirming who
 * they're booking with.
 *
 * Intentionally minimal — no rating, no social links, no bio.
 */
export function EmbedHeader({ businessName, photoURL, subtitle }: EmbedHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 relative">
        {photoURL ? (
          <Image
            src={photoURL}
            alt={businessName}
            fill
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm font-bold">
            {businessName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight truncate">
          {businessName}
        </p>
        {subtitle && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
