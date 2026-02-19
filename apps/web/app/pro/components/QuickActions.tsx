'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, CalendarOff, Share2, Copy, Check, Download, ExternalLink, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

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

interface QuickActionsProps {
  onCreateBooking: () => void;
  onBlockSlot: () => void;
}

export function QuickActions({ onCreateBooking, onBlockSlot }: QuickActionsProps) {
  const { provider } = useAuth();
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<QRTab>('booking');
  const popoverRef = useRef<HTMLDivElement>(null);
  const qrBookingRef = useRef<HTMLDivElement>(null);
  const qrPaypalRef = useRef<HTMLDivElement>(null);

  const bookingUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}/reserver`
    : null;

  const paypalLink = provider?.socialLinks?.paypal || null;
  const paypalUrl = paypalLink
    ? (paypalLink.startsWith('http') ? paypalLink : `https://paypal.me/${paypalLink}`)
    : null;

  // Close popover on outside click
  useEffect(() => {
    if (!showShare) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showShare]);

  const handleCopy = useCallback(async () => {
    const url = activeTab === 'booking' ? bookingUrl : paypalUrl;
    if (!url) return;
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
  }, [bookingUrl, paypalUrl, activeTab]);

  const handleDownloadQr = useCallback(() => {
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
  }, [provider?.businessName, provider?.slug, activeTab]);

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onCreateBooking} className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Créer un RDV
      </Button>
      <Button variant="outline" onClick={onBlockSlot} className="flex items-center gap-2">
        <CalendarOff className="w-4 h-4" />
        Bloquer un créneau
      </Button>

      {/* Share button with popover */}
      {provider?.isPublished && bookingUrl && (
        <div className="relative" ref={popoverRef}>
          <Button
            variant="outline"
            onClick={() => setShowShare(!showShare)}
            className="flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Partager
          </Button>

          {showShare && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
              {/* Tab bar */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab('booking')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'booking'
                      ? 'bg-white dark:bg-gray-600 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <QrCode className="w-3 h-3" />
                  Réservation
                </button>
                <button
                  onClick={() => setActiveTab('paypal')}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'paypal'
                      ? 'bg-white dark:bg-gray-600 text-[#0070BA] shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <PaypalIcon className="w-3 h-3" />
                  PayPal
                </button>
              </div>

              {/* Link copy */}
              {(activeTab === 'booking' || paypalUrl) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                    {activeTab === 'booking' ? 'Lien de réservation' : 'Lien PayPal'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-900 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 truncate text-gray-900 dark:text-gray-100">
                      {activeTab === 'booking' ? bookingUrl : paypalUrl}
                    </code>
                    <button
                      onClick={handleCopy}
                      className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                      title="Copier"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <a
                      href={activeTab === 'booking' ? bookingUrl : (paypalUrl || '#')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                      title="Ouvrir"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* QR Code */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                {activeTab === 'booking' ? (
                  <div className="flex items-start gap-4">
                    <div
                      ref={qrBookingRef}
                      className="flex-shrink-0 bg-white p-2.5 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <QRCodeCanvas
                        value={bookingUrl}
                        size={96}
                        level="H"
                        marginSize={0}
                        imageSettings={provider.photoURL ? {
                          src: provider.photoURL,
                          height: 16,
                          width: 16,
                          excavate: true,
                        } : undefined}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                        QR code
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Affichez-le dans votre établissement
                      </p>
                      <button
                        onClick={handleDownloadQr}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Télécharger
                      </button>
                    </div>
                  </div>
                ) : paypalUrl ? (
                  <div className="flex items-start gap-4">
                    <div
                      ref={qrPaypalRef}
                      className="flex-shrink-0 bg-white p-2.5 rounded-lg border border-gray-200 dark:border-gray-600"
                    >
                      <QRCodeCanvas
                        value={paypalUrl}
                        size={96}
                        level="H"
                        marginSize={0}
                        imageSettings={{
                          src: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="%230070BA"/><text x="8" y="11" text-anchor="middle" fill="white" font-size="8" font-weight="bold" font-family="system-ui">PP</text></svg>'),
                          height: 16,
                          width: 16,
                          excavate: true,
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                        <PaypalIcon className="w-3.5 h-3.5 text-[#0070BA]" />
                        QR code PayPal
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Pour les paiements directs
                      </p>
                      <button
                        onClick={handleDownloadQr}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0070BA] text-white hover:bg-[#005A9E] rounded-lg text-xs font-medium transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Télécharger
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3">
                    <PaypalIcon className="w-6 h-6 text-[#0070BA] mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      PayPal non configuré
                    </p>
                    <a
                      href="/pro/profil?tab=reseaux"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#0070BA] hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Configurer
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
