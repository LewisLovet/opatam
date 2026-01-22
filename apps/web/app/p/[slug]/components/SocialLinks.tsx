'use client';

import { Instagram, Facebook, Globe, ExternalLink } from 'lucide-react';

// TikTok icon (not in lucide)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

interface SocialLinksData {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  website: string | null;
}

interface SocialLinksProps {
  links: SocialLinksData;
}

const socialConfig = [
  {
    key: 'instagram' as const,
    label: 'Instagram',
    icon: Instagram,
    getUrl: (handle: string) =>
      handle.startsWith('http') ? handle : `https://instagram.com/${handle.replace('@', '')}`,
    bgColor: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400',
    hoverBg: 'hover:from-purple-600 hover:via-pink-600 hover:to-orange-500',
  },
  {
    key: 'facebook' as const,
    label: 'Facebook',
    icon: Facebook,
    getUrl: (handle: string) =>
      handle.startsWith('http') ? handle : `https://facebook.com/${handle}`,
    bgColor: 'bg-[#1877F2]',
    hoverBg: 'hover:bg-[#166FE5]',
  },
  {
    key: 'tiktok' as const,
    label: 'TikTok',
    icon: TikTokIcon,
    getUrl: (handle: string) =>
      handle.startsWith('http') ? handle : `https://tiktok.com/@${handle.replace('@', '')}`,
    bgColor: 'bg-black dark:bg-white dark:text-black',
    hoverBg: 'hover:bg-gray-800 dark:hover:bg-gray-100',
  },
  {
    key: 'website' as const,
    label: 'Site web',
    icon: Globe,
    getUrl: (url: string) => (url.startsWith('http') ? url : `https://${url}`),
    bgColor: 'bg-gray-700 dark:bg-gray-600',
    hoverBg: 'hover:bg-gray-800 dark:hover:bg-gray-500',
  },
];

export function SocialLinks({ links }: SocialLinksProps) {
  const activeLinks = socialConfig.filter((config) => links[config.key]);

  if (activeLinks.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {activeLinks.map((config) => {
        const value = links[config.key];
        if (!value) return null;

        const Icon = config.icon;
        const url = config.getUrl(value);
        const isTikTok = config.key === 'tiktok';

        return (
          <a
            key={config.key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              inline-flex items-center gap-2 px-5 py-2.5
              rounded-xl shadow-md
              ${isTikTok ? 'text-white dark:text-black' : 'text-white'}
              transition-all duration-200
              hover:shadow-lg hover:scale-105
              ${config.bgColor}
              ${config.hoverBg}
            `}
          >
            <Icon className="w-5 h-5" />
            <span className="text-sm font-semibold">{config.label}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </a>
        );
      })}
    </div>
  );
}
