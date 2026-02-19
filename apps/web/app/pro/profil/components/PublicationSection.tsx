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

// PayPal SVG icon
function PaypalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23A.773.773 0 0 1 5.706 1.6h6.574c2.179 0 3.702.58 4.527 1.724.785 1.09.957 2.544.513 4.325l-.014.063v.56l.436.247c.37.193.664.433.883.717.263.34.432.742.502 1.196.073.471.046 1.03-.079 1.66-.145.735-.38 1.375-.7 1.9a3.956 3.956 0 0 1-1.108 1.234 4.48 4.48 0 0 1-1.51.72 7.166 7.166 0 0 1-1.89.236H13.3a.95.95 0 0 0-.937.806l-.038.22-.633 4.016-.03.158a.95.95 0 0 1-.937.806H7.076Z" />
      <path d="M18.282 7.976l-.014.063c-.882 4.528-3.9 6.093-7.752 6.093H8.92a.95.95 0 0 0-.937.806l-.997 6.326a.501.501 0 0 0 .495.578h3.472a.773.773 0 0 0 .763-.652l.031-.165.605-3.836.039-.212a.773.773 0 0 1 .763-.652h.48c3.11 0 5.544-1.263 6.256-4.916.297-1.526.143-2.8-.643-3.695a3.07 3.07 0 0 0-.879-.638l-.086-.1Z" opacity=".7" />
    </svg>
  );
}

type QRTab = 'booking' | 'paypal';

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
  const [activeQRTab, setActiveQRTab] = useState<QRTab>('booking');
  const qrRef = useRef<HTMLDivElement>(null);
  const qrPaypalRef = useRef<HTMLDivElement>(null);

  const paypalLink = provider?.socialLinks?.paypal || null;
  const paypalUrl = paypalLink
    ? (paypalLink.startsWith('http') ? paypalLink : `https://paypal.me/${paypalLink}`)
    : null;

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

  const handleDownloadQr = useCallback(async () => {
    const ref = activeQRTab === 'booking' ? qrRef : qrPaypalRef;
    const canvas = ref.current?.querySelector('canvas');
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

    // Draw logo on download if provider has photoURL (booking) or PayPal badge
    if (activeQRTab === 'booking' && provider?.photoURL) {
      await drawLogoOnDownload(ctx, provider.photoURL, size, padding);
    } else if (activeQRTab === 'paypal') {
      drawPaypalBadgeOnDownload(ctx, size, padding);
    }

    ctx.fillStyle = '#374151';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const label = activeQRTab === 'booking'
      ? `Scannez pour réserver chez ${provider?.businessName || ''}`
      : `Payer via PayPal — ${provider?.businessName || ''}`;
    ctx.fillText(label, downloadCanvas.width / 2, size + padding + 48);

    const link = document.createElement('a');
    const prefix = activeQRTab === 'booking' ? 'qrcode' : 'paypal-qr';
    link.download = `${prefix}-${provider?.slug || 'code'}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  }, [provider?.businessName, provider?.slug, provider?.photoURL, activeQRTab]);

  const handlePrintQr = useCallback(() => {
    const ref = activeQRTab === 'booking' ? qrRef : qrPaypalRef;
    const canvas = ref.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const title = activeQRTab === 'booking'
      ? 'Scannez ce QR code pour réserver en ligne'
      : 'Scannez pour payer via PayPal';
    const url = activeQRTab === 'booking' ? bookingUrl : paypalUrl;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>QR Code - ${provider?.businessName || ''}</title><style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui,-apple-system,sans-serif}img{max-width:400px;width:100%}h2{margin-top:24px;color:#111827;font-size:20px}p{color:#6b7280;font-size:14px;margin-top:8px}</style></head><body><img src="${canvas.toDataURL('image/png')}" alt="QR Code"/><h2>${provider?.businessName || ''}</h2><p>${title}</p><p style="font-size:12px;color:#9ca3af;margin-top:16px">${url || ''}</p><script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}};</script></body></html>`);
    printWindow.document.close();
  }, [provider?.businessName, bookingUrl, paypalUrl, activeQRTab]);

  const requirementItems = [
    { key: 'hasBusinessName', label: 'Nom de l\'entreprise', href: '#profile' },
    { key: 'hasCategory', label: 'Catégorie', href: '#profile' },
    { key: 'hasLocation', label: 'Au moins un lieu', href: '/pro/lieux' },
    { key: 'hasService', label: 'Au moins une prestation', href: '/pro/prestations' },
    { key: 'hasAvailability', label: 'Disponibilités configurées', href: '/pro/disponibilites' },
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
            {/* Tab bar */}
            <div className="flex bg-gray-200/60 dark:bg-gray-700 rounded-lg p-0.5 mb-4">
              <button
                onClick={() => setActiveQRTab('booking')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeQRTab === 'booking'
                    ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                <QrCode className="w-3 h-3" />
                Réservation
              </button>
              <button
                onClick={() => setActiveQRTab('paypal')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeQRTab === 'paypal'
                    ? 'bg-white dark:bg-gray-600 text-[#0070BA] shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                <PaypalIcon className="w-3 h-3" />
                PayPal
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-5">
              {/* QR visual */}
              {activeQRTab === 'booking' ? (
                <div
                  ref={qrRef}
                  className="flex-shrink-0 bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm self-start"
                >
                  <QRCodeCanvas
                    value={bookingUrl || ''}
                    size={140}
                    level="H"
                    marginSize={0}
                    imageSettings={provider?.photoURL ? {
                      src: provider.photoURL,
                      height: 24,
                      width: 24,
                      excavate: true,
                    } : {
                      src: '/favicon.ico',
                      height: 24,
                      width: 24,
                      excavate: true,
                    }}
                  />
                </div>
              ) : paypalUrl ? (
                <div
                  ref={qrPaypalRef}
                  className="flex-shrink-0 bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm self-start"
                >
                  <QRCodeCanvas
                    value={paypalUrl}
                    size={140}
                    level="H"
                    marginSize={0}
                    imageSettings={{
                      src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="%230070BA"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="system-ui">PP</text></svg>'),
                      height: 24,
                      width: 24,
                      excavate: true,
                    }}
                  />
                </div>
              ) : (
                <div className="flex-shrink-0 bg-gray-100 dark:bg-gray-700/50 p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 self-start flex flex-col items-center justify-center" style={{ width: 172, height: 172 }}>
                  <PaypalIcon className="w-8 h-8 text-[#0070BA] mb-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Non configuré</p>
                </div>
              )}

              {/* Info + actions */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                  {activeQRTab === 'booking' ? (
                    <>
                      <QrCode className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      QR code de réservation
                    </>
                  ) : (
                    <>
                      <PaypalIcon className="w-4 h-4 text-[#0070BA]" />
                      QR code PayPal
                    </>
                  )}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {activeQRTab === 'booking'
                    ? 'Affichez-le dans votre établissement ou sur vos supports de communication. Vos clients scannent et réservent directement.'
                    : paypalUrl
                      ? 'Vos clients scannent ce QR code pour vous payer directement via PayPal.'
                      : 'Configurez votre lien PayPal depuis l\'onglet Réseaux de votre profil.'}
                </p>

                {(activeQRTab === 'booking' || paypalUrl) ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={handleDownloadQr}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Télécharger
                    </button>
                    <button
                      onClick={handlePrintQr}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimer
                    </button>
                  </div>
                ) : (
                  <a
                    href="/pro/profil?tab=reseaux"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0070BA] text-white hover:bg-[#005A9E] rounded-lg text-xs font-medium transition-colors mt-3"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Configurer PayPal
                  </a>
                )}

                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 truncate">
                  {activeQRTab === 'booking' ? bookingUrl : paypalUrl || ''}
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
                Désactivation...
              </>
            ) : (
              <>
                <GlobeLock className="w-4 h-4 mr-2" />
                Désactiver
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

/** Draw provider logo on download canvas */
function drawLogoOnDownload(ctx: CanvasRenderingContext2D, logoUrl: string, qrSize: number, padding: number): Promise<void> {
  return new Promise((resolve) => {
    const logoSize = Math.round(qrSize * 0.18);
    const logoX = padding + (qrSize - logoSize) / 2;
    const logoY = padding + (qrSize - logoSize) / 2;
    const logoRadius = Math.round(logoSize * 0.2);

    ctx.fillStyle = '#ffffff';
    const bgPad = 4;
    roundRect(ctx, logoX - bgPad, logoY - bgPad, logoSize + bgPad * 2, logoSize + bgPad * 2, logoRadius + 2);
    ctx.fill();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      roundRect(ctx, logoX, logoY, logoSize, logoSize, logoRadius);
      ctx.clip();
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      resolve();
    };
    img.onerror = () => resolve();
    img.src = logoUrl;
  });
}

/** Draw PayPal badge on download canvas */
function drawPaypalBadgeOnDownload(ctx: CanvasRenderingContext2D, qrSize: number, padding: number) {
  const logoSize = Math.round(qrSize * 0.18);
  const logoX = padding + (qrSize - logoSize) / 2;
  const logoY = padding + (qrSize - logoSize) / 2;
  const logoRadius = Math.round(logoSize * 0.2);

  ctx.fillStyle = '#ffffff';
  const bgPad = 4;
  roundRect(ctx, logoX - bgPad, logoY - bgPad, logoSize + bgPad * 2, logoSize + bgPad * 2, logoRadius + 2);
  ctx.fill();

  ctx.fillStyle = '#0070BA';
  roundRect(ctx, logoX, logoY, logoSize, logoSize, logoRadius);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(logoSize * 0.45)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PP', logoX + logoSize / 2, logoY + logoSize / 2);
}

/** Helper: draw a rounded rect path */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
