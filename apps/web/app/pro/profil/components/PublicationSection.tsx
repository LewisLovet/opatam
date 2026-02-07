'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Badge } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Loader2,
  Globe,
  GlobeLock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Download,
  Printer,
  QrCode,
} from 'lucide-react';

interface PublicationSectionProps {
  onSuccess?: () => void;
}

interface RequirementCheck {
  canPublish: boolean;
  missingItems: string[];
  completeness: {
    hasBusinessName: boolean;
    hasCategory: boolean;
    hasLocation: boolean;
    hasService: boolean;
    hasAvailability: boolean;
  };
}

export function PublicationSection({ onSuccess }: PublicationSectionProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingRequirements, setCheckingRequirements] = useState(true);
  const [requirements, setRequirements] = useState<RequirementCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  // Check requirements on mount and when provider changes
  useEffect(() => {
    if (provider) {
      checkRequirements();
    }
  }, [provider?.id]);

  const checkRequirements = async () => {
    if (!provider) return;

    setCheckingRequirements(true);
    try {
      const result = await providerService.checkPublishRequirements(provider.id);
      setRequirements(result);
    } catch (err) {
      console.error('Check requirements error:', err);
    } finally {
      setCheckingRequirements(false);
    }
  };

  const handlePublish = async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      const result = await providerService.publishProvider(provider.id);

      if (!result.canPublish) {
        setRequirements(result);
        setError('Veuillez completer tous les elements requis avant d\'activer votre page');
        return;
      }

      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Publish error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'activation');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      await providerService.unpublishProvider(provider.id);
      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Unpublish error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la désactivation');
    } finally {
      setLoading(false);
    }
  };

  const publicUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}`
    : null;

  const bookingUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}/reserver`
    : null;

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDownloadQr = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const downloadCanvas = document.createElement('canvas');
    const size = 1024;
    const padding = 80;
    downloadCanvas.width = size + padding * 2;
    downloadCanvas.height = size + padding * 2 + 60;
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
    ctx.drawImage(canvas, padding, padding, size, size);

    ctx.fillStyle = '#374151';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Scannez pour réserver chez ${provider?.businessName || ''}`,
      downloadCanvas.width / 2,
      size + padding + 48
    );

    const link = document.createElement('a');
    link.download = `qrcode-${provider?.slug || 'reservation'}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  }, [provider?.businessName, provider?.slug]);

  const handlePrintQr = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>QR Code - ${provider?.businessName || ''}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif}img{max-width:400px;width:100%}h2{margin-top:24px;color:#111827;font-size:20px}p{color:#6b7280;font-size:14px;margin-top:8px}</style></head><body><img src="${canvas.toDataURL('image/png')}" alt="QR Code"/><h2>${provider?.businessName || ''}</h2><p>Scannez ce QR code pour réserver en ligne</p><p style="font-size:12px;color:#9ca3af;margin-top:16px">${bookingUrl || ''}</p><script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}};</script></body></html>`);
    printWindow.document.close();
  }, [provider?.businessName, bookingUrl]);

  const requirementItems = [
    { key: 'hasBusinessName', label: 'Nom de l\'entreprise', href: '#profile' },
    { key: 'hasCategory', label: 'Categorie', href: '#profile' },
    { key: 'hasLocation', label: 'Au moins un lieu', href: '/pro/lieux' },
    { key: 'hasService', label: 'Au moins une prestation', href: '/pro/prestations' },
    { key: 'hasAvailability', label: 'Disponibilites configurees', href: '/pro/disponibilites' },
  ];

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="flex items-center gap-4">
        <div
          className={`p-3 rounded-xl ${
            provider?.isPublished
              ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          {provider?.isPublished ? (
            <Globe className="w-6 h-6" />
          ) : (
            <GlobeLock className="w-6 h-6" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {provider?.isPublished ? 'Page active' : 'Page inactive'}
            </h3>
            <Badge variant={provider?.isPublished ? 'success' : 'default'}>
              {provider?.isPublished ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {provider?.isPublished
              ? 'Votre page est visible et accessible par les clients'
              : 'Votre page n\'est pas visible par les clients'}
          </p>
        </div>
      </div>

      {/* Public URL + QR Code (if published) */}
      {provider?.isPublished && publicUrl && (
        <div className="space-y-4">
          {/* URL */}
          <div className="p-4 bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-800 rounded-lg">
            <p className="text-sm font-medium text-success-700 dark:text-success-400 mb-2">
              Votre page est accessible a l&apos;adresse :
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded border border-success-200 dark:border-success-700 truncate text-gray-900 dark:text-gray-100">
                {publicUrl}
              </code>
              <button
                onClick={() => handleCopy(publicUrl)}
                className="p-2 text-success-600 hover:text-success-700 dark:text-success-400 dark:hover:text-success-300 transition-colors"
                title="Copier le lien"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
              <a
                href={`/p/${provider.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-success-600 hover:text-success-700 dark:text-success-400 dark:hover:text-success-300 transition-colors"
                title="Voir la page"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* QR Code */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex flex-col sm:flex-row gap-5">
              {/* QR visual */}
              <div
                ref={qrRef}
                className="flex-shrink-0 bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm self-start"
              >
                <QRCodeCanvas
                  value={bookingUrl || ''}
                  size={140}
                  level="H"
                  marginSize={0}
                  imageSettings={{
                    src: '/favicon.ico',
                    height: 24,
                    width: 24,
                    excavate: true,
                  }}
                />
              </div>

              {/* Info + actions */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  <QrCode className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  QR code de réservation
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Affichez-le dans votre établissement ou sur vos supports de communication. Vos clients scannent et réservent directement.
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={handleDownloadQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Telecharger
                  </button>
                  <button
                    onClick={handlePrintQr}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimer
                  </button>
                </div>

                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 truncate">
                  {bookingUrl}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {!provider?.isPublished && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning-500" />
            Elements requis pour l&apos;activation
          </h4>

          {checkingRequirements ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verification...
            </div>
          ) : (
            <ul className="space-y-2">
              {requirementItems.map((item) => {
                const isComplete =
                  requirements?.completeness[item.key as keyof typeof requirements.completeness];
                return (
                  <li key={item.key} className="flex items-center gap-3">
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5 text-success-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                    <span
                      className={
                        isComplete
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    >
                      {item.label}
                    </span>
                    {!isComplete && (
                      <a
                        href={item.href}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Configurer
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {provider?.isPublished ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleUnpublish}
            disabled={loading}
            className="text-warning-600 border-warning-300 hover:bg-warning-50 dark:text-warning-400 dark:border-warning-600 dark:hover:bg-warning-900/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Desactivation...
              </>
            ) : (
              <>
                <GlobeLock className="w-4 h-4 mr-2" />
                Desactiver
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handlePublish}
            disabled={loading || !requirements?.canPublish}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Activation...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Activer ma page
              </>
            )}
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={checkRequirements}
          disabled={checkingRequirements}
        >
          Actualiser le statut
        </Button>
      </div>
    </div>
  );
}
