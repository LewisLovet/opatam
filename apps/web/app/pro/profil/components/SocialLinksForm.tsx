'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input, Button } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import { Loader2, Instagram, Facebook, Globe, DollarSign } from 'lucide-react';

// TikTok icon component (not in lucide-react)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

interface SocialLinksFormProps {
  onSuccess?: () => void;
}

export function SocialLinksForm({ onSuccess }: SocialLinksFormProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    instagram: '',
    facebook: '',
    tiktok: '',
    website: '',
    paypal: '',
  });

  // Initialize form with provider data
  useEffect(() => {
    if (provider?.socialLinks) {
      setFormData({
        instagram: provider.socialLinks.instagram || '',
        facebook: provider.socialLinks.facebook || '',
        tiktok: provider.socialLinks.tiktok || '',
        website: provider.socialLinks.website || '',
        paypal: provider.socialLinks.paypal || '',
      });
    }
  }, [provider]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  // Expected domains per platform (website has no restriction)
  const domainRules: Record<string, string[]> = {
    instagram: ['instagram.com', 'www.instagram.com'],
    facebook: ['facebook.com', 'www.facebook.com', 'fb.com'],
    tiktok: ['tiktok.com', 'www.tiktok.com'],
    paypal: ['paypal.me', 'www.paypal.me', 'paypal.com', 'www.paypal.com'],
  };

  const platformLabels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    tiktok: 'TikTok',
    paypal: 'PayPal',
  };

  // Validate URL format + domain
  const validateUrl = (key: string, url: string): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      const allowedDomains = domainRules[key];
      if (allowedDomains && !allowedDomains.includes(parsed.hostname)) {
        return `Le lien ${platformLabels[key] || key} doit pointer vers ${allowedDomains[0]}`;
      }
      return null;
    } catch {
      return `L'URL ${platformLabels[key] || key} n'est pas valide`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) return;

    // Validate URLs (format + domain)
    for (const [key, value] of Object.entries(formData)) {
      const err = validateUrl(key, value);
      if (err) {
        setError(err);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await providerService.updateSocialLinks(provider.id, {
        instagram: formData.instagram || null,
        facebook: formData.facebook || null,
        tiktok: formData.tiktok || null,
        website: formData.website || null,
        paypal: formData.paypal || null,
      });

      await refreshProvider();
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Instagram */}
      <div className="relative">
        <div className="absolute left-3 top-[38px] text-gray-400">
          <Instagram className="w-5 h-5" />
        </div>
        <Input
          label="Instagram"
          name="instagram"
          type="url"
          value={formData.instagram}
          onChange={handleChange}
          placeholder="https://instagram.com/votre-compte"
          className="pl-10"
        />
      </div>

      {/* Facebook */}
      <div className="relative">
        <div className="absolute left-3 top-[38px] text-gray-400">
          <Facebook className="w-5 h-5" />
        </div>
        <Input
          label="Facebook"
          name="facebook"
          type="url"
          value={formData.facebook}
          onChange={handleChange}
          placeholder="https://facebook.com/votre-page"
          className="pl-10"
        />
      </div>

      {/* TikTok */}
      <div className="relative">
        <div className="absolute left-3 top-[38px] text-gray-400">
          <TikTokIcon className="w-5 h-5" />
        </div>
        <Input
          label="TikTok"
          name="tiktok"
          type="url"
          value={formData.tiktok}
          onChange={handleChange}
          placeholder="https://tiktok.com/@votre-compte"
          className="pl-10"
        />
      </div>

      {/* Website */}
      <div className="relative">
        <div className="absolute left-3 top-[38px] text-gray-400">
          <Globe className="w-5 h-5" />
        </div>
        <Input
          label="Site web"
          name="website"
          type="url"
          value={formData.website}
          onChange={handleChange}
          placeholder="https://votre-site.com"
          className="pl-10"
        />
      </div>

      {/* PayPal */}
      <div className="relative">
        <div className="absolute left-3 top-[38px] text-gray-400">
          <DollarSign className="w-5 h-5" />
        </div>
        <Input
          label="PayPal.me"
          name="paypal"
          type="url"
          value={formData.paypal}
          onChange={handleChange}
          placeholder="https://paypal.me/votre-identifiant"
          className="pl-10"
        />
      </div>

      {/* Hint */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Ces liens seront affiches sur votre page publique pour permettre aux clients de vous suivre.
      </p>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-lg text-sm">
          Liens sociaux mis à jour avec succès
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </form>
  );
}
