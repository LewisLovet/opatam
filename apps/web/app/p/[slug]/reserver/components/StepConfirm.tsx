'use client';

import { ArrowLeft, Loader2, Info } from 'lucide-react';

interface ClientInfo {
  name: string;
  email: string;
  phone: string;
}

interface StepConfirmProps {
  clientInfo: ClientInfo;
  onChange: (info: Partial<ClientInfo>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  requiresConfirmation: boolean;
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
}: StepConfirmProps) {
  // Simple validation
  const isNameValid = clientInfo.name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email);
  const isPhoneValid = isValidPhone(clientInfo.phone);
  const isValid = isNameValid && isEmailValid && isPhoneValid;

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
          Vos informations
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name field */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Nom complet
          </label>
          <input
            type="text"
            id="name"
            value={clientInfo.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Jean Dupont"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
              clientInfo.name && !isNameValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.name && !isNameValid && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              Le nom doit contenir au moins 2 caractères
            </p>
          )}
        </div>

        {/* Email field */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            value={clientInfo.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="jean@exemple.com"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
              clientInfo.email && !isEmailValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.email && !isEmailValid && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              Format d'email invalide
            </p>
          )}
        </div>

        {/* Phone field */}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Téléphone
          </label>
          <input
            type="tel"
            id="phone"
            value={clientInfo.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="06 12 34 56 78 ou +33 6 12 34 56 78"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${
              clientInfo.phone && !isPhoneValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.phone && !isPhoneValid && (
            <p className="mt-1 text-sm text-red-500 dark:text-red-400">
              Numéro de téléphone invalide
            </p>
          )}
        </div>

        {/* Info about confirmation */}
        {requiresConfirmation && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Votre réservation sera en attente de confirmation par le prestataire.
              Vous recevrez un email dès qu'elle sera confirmée.
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
              Réservation en cours...
            </>
          ) : (
            'Confirmer la réservation'
          )}
        </button>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          En confirmant, vous acceptez nos conditions générales et notre politique de confidentialité.
        </p>
      </form>
    </div>
  );
}
