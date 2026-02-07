'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, CalendarOff, Share2, Copy, Check, Download, ExternalLink, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

interface QuickActionsProps {
  onCreateBooking: () => void;
  onBlockSlot: () => void;
}

export function QuickActions({ onCreateBooking, onBlockSlot }: QuickActionsProps) {
  const { provider } = useAuth();
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const bookingUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}/reserver`
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
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = bookingUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [bookingUrl]);

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
      `Scannez pour reserver chez ${provider?.businessName || ''}`,
      downloadCanvas.width / 2,
      size + padding + 48
    );

    const link = document.createElement('a');
    link.download = `qrcode-${provider?.slug || 'reservation'}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  }, [provider?.businessName, provider?.slug]);

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onCreateBooking} className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Creer un RDV
      </Button>
      <Button variant="outline" onClick={onBlockSlot} className="flex items-center gap-2">
        <CalendarOff className="w-4 h-4" />
        Bloquer un creneau
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
              {/* Link copy */}
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">
                  Lien de reservation
                </label>
                <div className="flex items-center gap-1.5">
                  <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-900 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 truncate text-gray-900 dark:text-gray-100">
                    {bookingUrl}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                    title="Copier"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
                    title="Ouvrir"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* QR Code */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-start gap-4">
                  <div
                    ref={qrRef}
                    className="flex-shrink-0 bg-white p-2.5 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <QRCodeCanvas
                      value={bookingUrl}
                      size={96}
                      level="H"
                      marginSize={0}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                      QR code
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Affichez-le dans votre etablissement
                    </p>
                    <button
                      onClick={handleDownloadQr}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Telecharger
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
