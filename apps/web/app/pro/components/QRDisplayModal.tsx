'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Copy, Check, Download, QrCode, ExternalLink } from 'lucide-react';

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

interface QRDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingUrl: string;
  paypalUrl: string | null;
  businessName: string;
  photoURL?: string | null;
  slug: string;
}

export function QRDisplayModal({
  isOpen,
  onClose,
  bookingUrl,
  paypalUrl,
  businessName,
  photoURL,
  slug,
}: QRDisplayModalProps) {
  const [activeTab, setActiveTab] = useState<QRTab>('booking');
  const [copied, setCopied] = useState(false);
  const qrBookingRef = useRef<HTMLDivElement>(null);
  const qrPaypalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const activeUrl = activeTab === 'booking' ? bookingUrl : paypalUrl;

  const handleCopy = useCallback(async () => {
    if (!activeUrl) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = activeUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeUrl]);

  const handleDownload = useCallback(async () => {
    const ref = activeTab === 'booking' ? qrBookingRef : qrPaypalRef;
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

    // Draw logo on download
    if (activeTab === 'booking' && photoURL) {
      await drawLogoOnCanvas(ctx, photoURL, size, padding);
    } else if (activeTab === 'paypal') {
      drawPaypalBadgeOnCanvas(ctx, size, padding);
    }

    ctx.fillStyle = '#374151';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    const label = activeTab === 'booking'
      ? `Scannez pour réserver chez ${businessName}`
      : `Payer via PayPal — ${businessName}`;
    ctx.fillText(label, downloadCanvas.width / 2, size + padding + 48);

    const link = document.createElement('a');
    const prefix = activeTab === 'booking' ? 'qrcode' : 'paypal-qr';
    link.download = `${prefix}-${slug}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  }, [activeTab, businessName, slug, photoURL]);

  if (!isOpen) return null;

  const qrSize = 400;
  const logoSize = 60;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab bar */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('booking')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'booking'
                  ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <QrCode className="w-4 h-4" />
              Réservation
            </button>
            <button
              onClick={() => setActiveTab('paypal')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-semibold transition-all ${
                activeTab === 'paypal'
                  ? 'bg-white dark:bg-gray-700 text-[#0070BA] shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <PaypalIcon className="w-4 h-4" />
              PayPal
            </button>
          </div>
        </div>

        {/* QR Code area */}
        <div className="flex flex-col items-center px-6 py-8">
          {activeTab === 'booking' ? (
            <>
              <div ref={qrBookingRef} className="bg-white p-4 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm">
                <QRCodeCanvas
                  value={bookingUrl}
                  size={qrSize}
                  level="H"
                  marginSize={0}
                  imageSettings={photoURL ? {
                    src: photoURL,
                    height: logoSize,
                    width: logoSize,
                    excavate: true,
                  } : {
                    src: '/favicon.ico',
                    height: logoSize,
                    width: logoSize,
                    excavate: true,
                  }}
                />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-5">
                {businessName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Scannez pour réserver en ligne
              </p>
            </>
          ) : paypalUrl ? (
            <>
              <div ref={qrPaypalRef} className="bg-white p-4 rounded-2xl border border-gray-200 dark:border-gray-600 shadow-sm">
                <QRCodeCanvas
                  value={paypalUrl}
                  size={qrSize}
                  level="H"
                  marginSize={0}
                  imageSettings={{
                    src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><rect width="60" height="60" rx="12" fill="%230070BA"/><text x="30" y="38" text-anchor="middle" fill="white" font-size="26" font-weight="bold" font-family="system-ui">PP</text></svg>'),
                    height: logoSize,
                    width: logoSize,
                    excavate: true,
                  }}
                />
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-5">
                {businessName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Scannez pour payer via PayPal
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                <PaypalIcon className="w-8 h-8 text-[#0070BA]" />
              </div>
              <p className="text-base font-medium text-gray-900 dark:text-white mb-1">
                PayPal non configuré
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center max-w-xs">
                Ajoutez votre lien PayPal pour générer un QR code de paiement.
              </p>
              <a
                href="/pro/profil?tab=reseaux"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0070BA] text-white hover:bg-[#005A9E] rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Configurer PayPal
              </a>
            </div>
          )}
        </div>

        {/* Actions bar */}
        {(activeTab === 'booking' || paypalUrl) && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-center gap-3">
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copié !' : 'Copier le lien'}
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Télécharger
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Draw provider logo on download canvas */
function drawLogoOnCanvas(ctx: CanvasRenderingContext2D, logoUrl: string, qrSize: number, padding: number): Promise<void> {
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
function drawPaypalBadgeOnCanvas(ctx: CanvasRenderingContext2D, qrSize: number, padding: number) {
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
