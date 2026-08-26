'use client';

import { useState } from 'react';
import { ArrowLeft, Loader2, Info, MapPin, RotateCw } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { GoogleAddressAutocomplete, type GoogleAddressSuggestion } from '@/components/ui';

interface ClientInfo {
  name: string;
  email: string;
  phone: string;
}

/** Adresse cliente sélectionnée — seul le placeId fait foi côté serveur. */
export interface ClientAddressValue {
  placeId: string;
  formattedAddress: string;
  city: string;
  postalCode: string;
  countryCode: string;
}

/** État du devis de déplacement, possédé par le parent (tunnel ou embed). */
export type TravelQuoteState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; fee: number; distanceKm: number; quoteToken: string }
  | {
      status: 'out_of_zone';
      maxKm: number;
      alternatives: Array<{ id: string; name: string; city: string }>;
    }
  | { status: 'error' };

interface StepConfirmProps {
  clientInfo: ClientInfo;
  onChange: (info: Partial<ClientInfo>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  requiresConfirmation: boolean;
  /** Prestation à domicile (lieu mobile à zone configurée) : adresse requise.
   *  Props optionnelles — l'embed et les lieux fixes ne passent rien. */
  requiresClientAddress?: boolean;
  clientAddress?: ClientAddressValue | null;
  onClientAddressSelect?: (address: ClientAddressValue | null) => void;
  travelQuote?: TravelQuoteState;
  onRetryQuote?: () => void;
  /** Pays du lieu (ISO alpha-2) — restreint la recherche d'adresse. */
  addressCountry?: string;
}

// Phone validation: accepts international formats
// - Minimum 8 digits, maximum 15 digits (E.164 standard)
// - Allows: +, spaces, dots, dashes, parentheses as formatting
const isValidPhone = (phone: string): boolean => {
  // Remove all formatting characters
  const cleaned = phone.replace(/[\s.\-()]/g, '');
  
  // Check if it starts with + or digits only
  if (!/^(\+)?[0-9]+$/.test(cleaned)) {
    return false;
  }
  
  // Count only digits (exclude +)
  const digitCount = cleaned.replace(/\D/g, '').length;
  
  // E.164 standard: 8-15 digits
  return digitCount >= 8 && digitCount <= 15;
};

export function StepConfirm({
  clientInfo,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
  requiresConfirmation,
  requiresClientAddress = false,
  clientAddress = null,
  onClientAddressSelect,
  travelQuote = { status: 'idle' },
  onRetryQuote,
  addressCountry,
}: StepConfirmProps) {
  const t = useTranslations('booking.confirm');
  const tt = useTranslations('booking.travel');
  const locale = useLocale();
  const [addressQuery, setAddressQuery] = useState(clientAddress?.formattedAddress ?? '');
  // Simple validation
  const isNameValid = clientInfo.name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email);
  const isPhoneValid = isValidPhone(clientInfo.phone);
  // Adresse + devis « ok » exigés pour un domicile : hors zone ou devis en
  // erreur = pas de passage en force (le serveur refuserait de toute façon).
  const isAddressValid =
    !requiresClientAddress || (!!clientAddress && travelQuote?.status === 'ok');
  const isValid = isNameValid && isEmailValid && isPhoneValid && isAddressValid;

  const formatFee = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  // Allow free-form phone input (international formats)
  const handlePhoneChange = (value: string) => {
    // Allow: digits, +, spaces, dashes, dots, parentheses
    const cleaned = value.replace(/[^\d\s\-.()+]/g, '');
    onChange({ phone: cleaned });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isSubmitting) {
      onSubmit();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('title')}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name field */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('nameLabel')}
          </label>
          <input
            type="text"
            id="name"
            value={clientInfo.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={t('namePlaceholder')}
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
              clientInfo.name && !isNameValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.name && !isNameValid && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              {t('nameError')}
            </p>
          )}
        </div>

        {/* Email field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('emailLabel')}
          </label>
          <input
            type="email"
            id="email"
            value={clientInfo.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder={t('emailPlaceholder')}
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
              clientInfo.email && !isEmailValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.email && !isEmailValid && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              {t('emailError')}
            </p>
          )}
        </div>

        {/* Phone field */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('phoneLabel')}
          </label>
          <input
            type="tel"
            id="phone"
            value={clientInfo.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={t('phonePlaceholder')}
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
              clientInfo.phone && !isPhoneValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.phone && !isPhoneValid && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              {t('phoneError')}
            </p>
          )}
        </div>

        {/* Adresse de la cliente — prestation à domicile */}
        {requiresClientAddress && (
          <div>
            <GoogleAddressAutocomplete
              label={tt('addressLabel')}
              value={addressQuery}
              onChange={(value) => {
                setAddressQuery(value);
                if (clientAddress) onClientAddressSelect?.(null);
              }}
              onSelect={(suggestion: GoogleAddressSuggestion) => {
                if (!suggestion.placeId) return;
                setAddressQuery(suggestion.formattedAddress);
                onClientAddressSelect?.({
                  placeId: suggestion.placeId,
                  formattedAddress: suggestion.formattedAddress,
                  city: suggestion.locality ?? '',
                  postalCode: suggestion.postalCode ?? '',
                  countryCode: (suggestion.countryCode ?? addressCountry ?? 'FR').toUpperCase(),
                });
              }}
              countries={addressCountry ? [addressCountry.toLowerCase()] : undefined}
              placeholder={tt('addressPlaceholder')}
              hint={tt('addressHelp')}
              disabled={isSubmitting}
              required
            />

            {travelQuote.status === 'loading' && (
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                {tt('quoteLoading')}
              </p>
            )}
            {travelQuote.status === 'ok' && (
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <MapPin className="w-4 h-4 text-primary-600 flex-shrink-0" />
                {travelQuote.fee === 0
                  ? tt('feeFree')
                  : tt('feeLine', { amount: formatFee(travelQuote.fee) })}
                <span className="text-gray-400">
                  · {tt('distance', { km: travelQuote.distanceKm })}
                </span>
              </p>
            )}
            {travelQuote.status === 'out_of_zone' && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg space-y-2">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {tt('outOfZoneTitle')}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {tt('outOfZoneBody', { maxKm: travelQuote.maxKm })}
                </p>
                {travelQuote.alternatives.length > 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {tt('otherLocations')}{' '}
                    {travelQuote.alternatives.map((l) => `${l.name} (${l.city})`).join(', ')}
                  </p>
                )}
              </div>
            )}
            {travelQuote.status === 'error' && (
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-between gap-3">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {tt('quoteUnavailable')}
                </p>
                {onRetryQuote && (
                  <button
                    type="button"
                    onClick={onRetryQuote}
                    className="flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline flex-shrink-0"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> {tt('retry')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info about confirmation */}
        {requiresConfirmation && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t('pendingInfo')}
            </p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t('submitting')}
            </>
          ) : (
            t('submit')
          )}
        </button>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          {t('terms')}
        </p>
      </form>
    </div>
  );
}
