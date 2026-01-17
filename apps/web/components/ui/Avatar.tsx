'use client';

import { forwardRef, useState, type ImgHTMLAttributes } from 'react';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  size?: AvatarSize;
  fallback?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ src, alt, size = 'md', fallback, className = '', ...props }, ref) => {
    const [imageError, setImageError] = useState(false);

    const showFallback = !src || imageError;
    const initials = fallback || getInitials(alt);

    return (
      <div
        ref={ref}
        className={`
          relative inline-flex items-center justify-center
          rounded-full overflow-hidden
          bg-primary-100 dark:bg-primary-900
          ${sizeStyles[size]}
          ${className}
        `}
      >
        {showFallback ? (
          <span
            className="font-medium text-primary-700 dark:text-primary-300"
            aria-label={alt}
          >
            {initials}
          </span>
        ) : (
          <img
            src={src}
            alt={alt}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
            {...props}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

export { Avatar, type AvatarProps, type AvatarSize };
