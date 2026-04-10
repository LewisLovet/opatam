'use client';

import { SUPPORTED_COUNTRIES } from '@booking-app/shared/constants';

const COUNTRY_FLAGS: Record<string, string> = {
  FR: '\u{1F1EB}\u{1F1F7}',
  BE: '\u{1F1E7}\u{1F1EA}',
  LU: '\u{1F1F1}\u{1F1FA}',
  CH: '\u{1F1E8}\u{1F1ED}',
  DE: '\u{1F1E9}\u{1F1EA}',
  ES: '\u{1F1EA}\u{1F1F8}',
  IT: '\u{1F1EE}\u{1F1F9}',
  NL: '\u{1F1F3}\u{1F1F1}',
  PT: '\u{1F1F5}\u{1F1F9}',
};

interface CountrySelectProps {
  value: string;
  onChange: (countryCode: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function CountrySelect({
  value,
  onChange,
  label = 'Pays',
  disabled = false,
  className = '',
}: CountrySelectProps) {
  const selectedCountry = SUPPORTED_COUNTRIES.find((c) => c.code === value);
  const flag = COUNTRY_FLAGS[value] ?? '';

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-base">
          {flag}
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="
            w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm font-medium appearance-none cursor-pointer
            text-gray-900 dark:text-gray-100
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-200
          "
        >
          {SUPPORTED_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
