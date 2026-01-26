'use client';

import Link from 'next/link';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  href?: string;
  variant?: 'default' | 'warning' | 'success' | 'primary';
}

const variantStyles = {
  default: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  primary: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400',
  success: 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400',
};

export function StatCard({
  icon,
  label,
  value,
  sublabel,
  href,
  variant = 'default',
}: StatCardProps) {
  const content = (
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${variantStyles[variant]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {value}
          </p>
          {sublabel && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  const baseClassName = `
    bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5
    border border-gray-200 dark:border-gray-700
    transition-all duration-200
  `;

  if (href) {
    return (
      <Link
        href={href}
        className={`${baseClassName} block hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer`}
      >
        {content}
      </Link>
    );
  }

  return <div className={baseClassName}>{content}</div>;
}
