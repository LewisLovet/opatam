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

export function ShareSection() {
  const { provider } = useAuth();
  const qrRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}`
    : null;

  const bookingUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}/reserver`
    : null;

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
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

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a higher quality version for download
    const downloadCanvas = document.createElement('canvas');
    const size = 1024;
    const padding = 80;
    downloadCanvas.width = size + padding * 2;
    downloadCanvas.height = size + padding * 2 + 60;
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);

    // Draw QR code
    ctx.drawImage(canvas, padding, padding, size, size);

    // Add text below
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

  const handlePrint = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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
          <p>Scannez ce QR code pour réserver en ligne</p>
          <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">${bookingUrl || ''}</p>
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
  }, [provider?.businessName, bookingUrl]);

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
        {/* QR Code */}
        <div className="flex-shrink-0">
          <div
            ref={qrRef}
            className="bg-white p-6 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm inline-block"
          >
            <QRCodeCanvas
              value={bookingUrl || ''}
              size={200}
              level="H"
              marginSize={0}
              imageSettings={{
                src: '/favicon.ico',
                height: 36,
                width: 36,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              Votre QR code de réservation
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Imprimez-le ou affichez-le dans votre établissement pour que vos clients puissent réserver directement en scannant.
            </p>
          </div>

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
            Le QR code redirige vers votre page de réservation : {bookingUrl}
          </p>
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
