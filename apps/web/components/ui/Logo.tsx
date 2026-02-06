'use client';

import Image from 'next/image';
import { ASSETS, APP_CONFIG } from '@booking-app/shared/constants';
import { useState, useEffect } from 'react';

type LogoVariant = 'default' | 'light' | 'dark';
type LogoSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  showText?: boolean;
  subtitle?: string;
  className?: string;
  textClassName?: string;
}

const sizeConfig: Record<LogoSize, { logo: number; text: string; subtitle: string }> = {
  sm: { logo: 24, text: 'text-base', subtitle: 'text-[10px]' },
  md: { logo: 36, text: 'text-lg', subtitle: 'text-xs' },
  lg: { logo: 48, text: 'text-xl', subtitle: 'text-xs' },
  xl: { logo: 64, text: 'text-2xl', subtitle: 'text-sm' },
  '2xl': { logo: 96, text: 'text-3xl', subtitle: 'text-base' },
};

export function Logo({
  variant = 'default',
  size = 'md',
  showText = true,
  subtitle,
  className = '',
  textClassName = '',
}: LogoProps) {
  const [imgError, setImgError] = useState(false);
  const config = sizeConfig[size];

  // Get the appropriate logo URL based on variant
  const logoUrl = ASSETS.logos[variant] || ASSETS.logos.default;

  // Debug logs
  useEffect(() => {
    console.log('[Logo] Component mounted', {
      variant,
      size,
      logoUrl,
      imgError,
      allLogos: ASSETS.logos,
    });
  }, [variant, size, logoUrl, imgError]);

  // Fallback to text logo if image fails to load
  if (imgError) {
    console.log('[Logo] Rendering fallback (image failed to load)', { variant, logoUrl });
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className="bg-primary-600 rounded-lg flex items-center justify-center"
          style={{ width: config.logo, height: config.logo }}
        >
          <span className="text-white font-bold" style={{ fontSize: config.logo * 0.4 }}>
            O
          </span>
        </div>
        {showText && (
          <div>
            <span className={`font-bold text-gray-900 dark:text-white ${config.text} ${textClassName}`}>
              {APP_CONFIG.name}
            </span>
            {subtitle && (
              <span className={`block text-gray-500 dark:text-gray-400 ${config.subtitle}`}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src={logoUrl}
        alt={APP_CONFIG.name}
        width={config.logo}
        height={config.logo}
        className="object-contain"
        onLoad={() => console.log('[Logo] Image loaded successfully', { variant, logoUrl })}
        onError={(e) => {
          console.error('[Logo] Image failed to load', { variant, logoUrl, error: e });
          setImgError(true);
        }}
        unoptimized // Firebase Storage URLs
      />
      {showText && (
        <div>
          <span className={`font-bold text-gray-900 dark:text-white ${config.text} ${textClassName}`}>
            {APP_CONFIG.name}
          </span>
          {subtitle && (
            <span className={`block text-gray-500 dark:text-gray-400 ${config.subtitle}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Variant for white text (on colored backgrounds)
export function LogoWhite({
  variant = 'light',
  size = 'md',
  showText = true,
  subtitle,
  className = '',
}: Omit<LogoProps, 'textClassName'>) {
  const [imgError, setImgError] = useState(false);
  const config = sizeConfig[size];

  const logoUrl = ASSETS.logos[variant] || ASSETS.logos.default;

  // Debug logs
  useEffect(() => {
    console.log('[LogoWhite] Component mounted', {
      variant,
      size,
      logoUrl,
      imgError,
      allLogos: ASSETS.logos,
    });
  }, [variant, size, logoUrl, imgError]);

  if (imgError) {
    console.log('[LogoWhite] Rendering fallback (image failed to load)', { variant, logoUrl });
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div
          className="bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center"
          style={{ width: config.logo, height: config.logo }}
        >
          <span className="text-white font-bold" style={{ fontSize: config.logo * 0.4 }}>
            O
          </span>
        </div>
        {showText && (
          <div>
            <span className={`font-bold text-white ${config.text}`}>
              {APP_CONFIG.name}
            </span>
            {subtitle && (
              <span className={`block text-white/70 ${config.subtitle}`}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src={logoUrl}
        alt={APP_CONFIG.name}
        width={config.logo}
        height={config.logo}
        className="object-contain"
        onLoad={() => console.log('[LogoWhite] Image loaded successfully', { variant, logoUrl })}
        onError={(e) => {
          console.error('[LogoWhite] Image failed to load', { variant, logoUrl, error: e });
          setImgError(true);
        }}
        unoptimized
      />
      {showText && (
        <div>
          <span className={`font-bold text-white ${config.text}`}>
            {APP_CONFIG.name}
          </span>
          {subtitle && (
            <span className={`block text-white/70 ${config.subtitle}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
