'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Copy,
  Download,
  Printer,
  Check,
  ExternalLink,
  QrCode,
  Share2,
  Link as LinkIcon,
} from 'lucide-react';
import { APP_CONFIG } from '@booking-app/shared/constants';

// PayPal SVG icon (lucide doesn't have one)
function PaypalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 2.23A.773.773 0 0 1 5.706 1.6h6.574c2.179 0 3.702.58 4.527 1.724.785 1.09.957 2.544.513 4.325l-.014.063v.56l.436.247c.37.193.664.433.883.717.263.34.432.742.502 1.196.073.471.046 1.03-.079 1.66-.145.735-.38 1.375-.7 1.9a3.956 3.956 0 0 1-1.108 1.234 4.48 4.48 0 0 1-1.51.72 7.166 7.166 0 0 1-1.89.236H13.3a.95.95 0 0 0-.937.806l-.038.22-.633 4.016-.03.158a.95.95 0 0 1-.937.806H7.076Z" />
      <path d="M18.282 7.976l-.014.063c-.882 4.528-3.9 6.093-7.752 6.093H8.92a.95.95 0 0 0-.937.806l-.997 6.326a.501.501 0 0 0 .495.578h3.472a.773.773 0 0 0 .763-.652l.031-.165.605-3.836.039-.212a.773.773 0 0 1 .763-.652h.48c3.11 0 5.544-1.263 6.256-4.916.297-1.526.143-2.8-.643-3.695a3.07 3.07 0 0 0-.879-.638l-.086-.1Z" opacity=".7" />
    </svg>
  );
}

type QRTab = 'booking' | 'paypal';

export function ShareSection() {
  const { provider } = useAuth();
  const qrBookingRef = useRef<HTMLDivElement>(null);
  const qrPaypalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<QRTab>('booking');

  const publicUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}`
    : null;

  const bookingUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}/reserver`
    : null;

  const paypalLink = provider?.socialLinks?.paypal || null;
  const paypalUrl = paypalLink
    ? (paypalLink.startsWith('http') ? paypalLink : `https://paypal.me/${paypalLink}`)
    : null;

  const activeQrRef = activeTab === 'booking' ? qrBookingRef : qrPaypalRef;
  const activeUrl = activeTab === 'booking' ? bookingUrl : paypalUrl;

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const drawLogoOnCanvas = useCallback((ctx: CanvasRenderingContext2D, canvasWidth: number, qrSize: number, padding: number): Promise<void> => {
    return new Promise((resolve) => {
      const logoUrl = activeTab === 'booking' ? provider?.photoURL : null;
      const isPaypal = activeTab === 'paypal';

      if (!logoUrl && !isPaypal) { resolve(); return; }

      const logoSize = Math.round(qrSize * 0.18);
      const logoX = padding + (qrSize - logoSize) / 2;
      const logoY = padding + (qrSize - logoSize) / 2;
      const logoRadius = Math.round(logoSize * 0.2);

      // White background behind logo
      ctx.fillStyle = '#ffffff';
      const bgPad = 4;
      roundRect(ctx, logoX - bgPad, logoY - bgPad, logoSize + bgPad * 2, logoSize + bgPad * 2, logoRadius + 2);
      ctx.fill();

      if (isPaypal) {
        // Draw PayPal blue circle with "PP" text
        ctx.fillStyle = '#0070BA';
        roundRect(ctx, logoX, logoY, logoSize, logoSize, logoRadius);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(logoSize * 0.45)}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PP', logoX + logoSize / 2, logoY + logoSize / 2);
        resolve();
      } else if (logoUrl) {
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
      }
    });
  }, [activeTab, provider?.photoURL]);

  const handleDownload = useCallback(async () => {
    const canvas = activeQrRef.current?.querySelector('canvas');
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

    // Draw logo on download canvas
    await drawLogoOnCanvas(ctx, downloadCanvas.width, size, padding);

    ctx.fillStyle = '#374151';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const label = activeTab === 'booking'
      ? `Scannez pour réserver chez ${provider?.businessName || ''}`
      : `Payer via PayPal — ${provider?.businessName || ''}`;
    ctx.fillText(label, downloadCanvas.width / 2, size + padding + 48);

    const link = document.createElement('a');
    const prefix = activeTab === 'booking' ? 'qrcode' : 'paypal-qr';
    link.download = `${prefix}-${provider?.slug || 'code'}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  }, [activeTab, activeQrRef, provider?.businessName, provider?.slug, drawLogoOnCanvas]);

  const handlePrint = useCallback(() => {
    const canvas = activeQrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const title = activeTab === 'booking'
      ? `Scannez ce QR code pour réserver en ligne`
      : `Scannez pour payer via PayPal`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${provider?.businessName || ''}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
            }
            img { max-width: 400px; width: 100%; }
            h2 { margin-top: 24px; color: #111827; font-size: 20px; }
            p { color: #6b7280; font-size: 14px; margin-top: 8px; }
          </style>
        </head>
        <body>
          <img src="${canvas.toDataURL('image/png')}" alt="QR Code" />
          <h2>${provider?.businessName || ''}</h2>
          <p>${title}</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">${activeUrl || ''}</p>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [activeTab, activeQrRef, provider?.businessName, activeUrl]);

  if (!provider) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Chargement...
      </div>
    );
  }

  if (!provider.isPublished) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 p-4 bg-warning-50 dark:bg-warning-900/10 border border-warning-200 dark:border-warning-800 rounded-xl">
          <QrCode className="w-6 h-6 text-warning-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-warning-700 dark:text-warning-400">
              Page non active
            </p>
            <p className="text-sm text-warning-600/80 dark:text-warning-400/70 mt-1">
              Activez votre page depuis l&apos;onglet{' '}
              <a href="/pro/profil" className="underline font-medium">Profil</a>{' '}
              pour accéder aux outils de partage et au QR code.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* QR Code Card */}
      <div className="flex flex-col sm:flex-row gap-8">
        {/* QR Code with tabs */}
        <div className="flex-shrink-0">
          {/* Tab bar */}
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-4">
            <button
              onClick={() => setActiveTab('booking')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'booking'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              Réservation
            </button>
            <button
              onClick={() => setActiveTab('paypal')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'paypal'
                  ? 'bg-white dark:bg-gray-700 text-[#0070BA] shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <PaypalIcon className="w-3.5 h-3.5" />
              PayPal
            </button>
          </div>

          {/* QR Code display */}
          {activeTab === 'booking' ? (
            <div
              ref={qrBookingRef}
              className="bg-white p-6 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm inline-block"
            >
              <QRCodeCanvas
                value={bookingUrl || ''}
                size={200}
                level="H"
                marginSize={0}
                imageSettings={provider.photoURL ? {
                  src: provider.photoURL,
                  height: 36,
                  width: 36,
                  excavate: true,
                } : {
                  src: '/favicon.ico',
                  height: 36,
                  width: 36,
                  excavate: true,
                }}
              />
            </div>
          ) : paypalUrl ? (
            <div
              ref={qrPaypalRef}
              className="bg-white p-6 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm inline-block"
            >
              <QRCodeCanvas
                value={paypalUrl}
                size={200}
                level="H"
                marginSize={0}
                imageSettings={{
                  src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><rect width="36" height="36" rx="8" fill="%230070BA"/><text x="18" y="23" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="system-ui">PP</text></svg>'),
                  height: 36,
                  width: 36,
                  excavate: true,
                }}
              />
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-8 flex flex-col items-center text-center" style={{ width: 248 }}>
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                <PaypalIcon className="w-7 h-7 text-[#0070BA]" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                PayPal non configuré
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Ajoutez votre lien PayPal pour générer un QR code de paiement.
              </p>
              <a
                href="/pro/profil?tab=reseaux"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0070BA] text-white hover:bg-[#005A9E] rounded-lg text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Configurer PayPal
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              {activeTab === 'booking' ? (
                <>
                  <QrCode className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Votre QR code de réservation
                </>
              ) : (
                <>
                  <PaypalIcon className="w-5 h-5 text-[#0070BA]" />
                  Votre QR code PayPal
                </>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {activeTab === 'booking'
                ? 'Imprimez-le ou affichez-le dans votre établissement pour que vos clients puissent réserver directement en scannant.'
                : paypalUrl
                  ? 'Vos clients scannent ce QR code pour vous payer directement via PayPal.'
                  : 'Configurez votre lien PayPal pour proposer un QR code de paiement à vos clients.'}
            </p>
          </div>

          {(activeTab === 'booking' || paypalUrl) && (
            <>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer
                </button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500">
                {activeTab === 'booking'
                  ? `Le QR code redirige vers votre page de réservation : ${bookingUrl}`
                  : `Le QR code redirige vers : ${paypalUrl}`}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 dark:border-gray-700" />

      {/* Share Links */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          Liens de partage
        </h3>

        {/* Page URL */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
              <LinkIcon className="w-3.5 h-3.5" />
              Votre vitrine
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 truncate text-gray-900 dark:text-gray-100">
                {publicUrl}
              </code>
              <button
                onClick={() => publicUrl && handleCopy(publicUrl)}
                className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Copier le lien"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href={publicUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1.5">
              <LinkIcon className="w-3.5 h-3.5" />
              Lien de réservation direct
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 truncate text-gray-900 dark:text-gray-100">
                {bookingUrl}
              </code>
              <button
                onClick={() => bookingUrl && handleCopy(bookingUrl)}
                className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                title="Copier le lien"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-primary-700 dark:text-primary-400 mb-2">
          Conseils pour maximiser vos réservations
        </h4>
        <ul className="text-sm text-primary-600/80 dark:text-primary-400/70 space-y-1.5">
          <li>Affichez le QR code à l&apos;accueil de votre établissement</li>
          <li>Ajoutez le lien de réservation dans votre bio Instagram</li>
          <li>Partagez le lien par SMS ou WhatsApp à vos clients réguliers</li>
          <li>Intégrez le QR code sur vos cartes de visite</li>
        </ul>
      </div>

    </div>
  );
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
