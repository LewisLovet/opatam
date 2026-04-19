'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Download, Share2, Printer, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The URL encoded into the QR code. */
  url: string;
  /** Affiliate code, used in the downloaded filename + print page title. */
  code: string;
  /** Affiliate display name, shown above the QR in the print layout. */
  name?: string;
}

/**
 * Share dialog for the affiliate's referral link as a QR code.
 *
 * Features:
 *  - Scannable QR (300px, error-correction H so it survives a small logo)
 *  - "Télécharger" → PNG via canvas.toDataURL
 *  - "Partager" → Web Share API with the PNG file when supported, otherwise
 *    falls back to sharing the URL (text only)
 *  - "Imprimer" → opens a stripped-down print window so the QR fills the
 *    page nicely without dragging the rest of the dashboard with it
 */
export function QrShareModal({ open, onClose, url, code, name }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shareSupported, setShareSupported] = useState(false);
  const [shareFilesSupported, setShareFilesSupported] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Detect Web Share API support on mount
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setShareSupported(typeof navigator.share === 'function');
    // canShare is needed to test file sharing — desktop Chrome has share()
    // but throws on files.
    setShareFilesSupported(
      typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [new File([], 'x')] }),
    );
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  /** Render the visible QR canvas to a PNG blob. */
  const buildPngBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = containerRef.current?.querySelector('canvas');
      if (!canvas) return resolve(null);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  };

  const handleDownload = async () => {
    const blob = await buildPngBlob();
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `opatam-affiliation-${code.toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(objectUrl);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleShare = async () => {
    const shareData: ShareData = {
      title: 'Inscrivez-vous sur Opatam',
      text: `Utilisez mon code parrain ${code} pour vous inscrire sur Opatam.`,
      url,
    };

    // Try sharing the PNG file when supported (better UX on mobile)
    if (shareFilesSupported) {
      const blob = await buildPngBlob();
      if (blob) {
        const file = new File([blob], `opatam-affiliation-${code.toLowerCase()}.png`, {
          type: 'image/png',
        });
        const dataWithFile: ShareData = { ...shareData, files: [file] };
        if (navigator.canShare?.(dataWithFile)) {
          try {
            await navigator.share(dataWithFile);
            return;
          } catch (err) {
            // user cancel or denied — silently fall back to URL share
            if ((err as Error).name === 'AbortError') return;
          }
        }
      }
    }

    if (shareSupported) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Fall through to clipboard
        await navigator.clipboard.writeText(url);
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  /**
   * Open a small print window with just the QR + link, so the rest of the
   * dashboard isn't dragged along.
   */
  const handlePrint = async () => {
    const blob = await buildPngBlob();
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);

    const printWindow = window.open('', '_blank', 'width=600,height=800');
    if (!printWindow) {
      URL.revokeObjectURL(objectUrl);
      return;
    }

    const safeName = (name ?? '').replace(/[<>"']/g, '');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>QR code Opatam — ${code}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              padding: 48px 24px;
              text-align: center;
              color: #18181b;
            }
            h1 { font-size: 22px; margin: 0 0 6px; }
            p.subtitle { color: #71717a; margin: 0 0 32px; font-size: 14px; }
            img { width: 320px; height: 320px; image-rendering: pixelated; }
            p.url { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 14px; color: #3f3f46; margin: 24px 0 8px; word-break: break-all; }
            p.code { font-size: 28px; font-weight: 700; letter-spacing: 2px; color: #6366f1; margin: 0 0 32px; }
            footer { color: #a1a1aa; font-size: 12px; }
            @media print {
              body { padding: 24px; }
              img { width: 280px; height: 280px; }
            }
          </style>
        </head>
        <body>
          ${safeName ? `<h1>${safeName}</h1>` : '<h1>Inscrivez-vous sur Opatam</h1>'}
          <p class="subtitle">Scannez ce QR code pour bénéficier du parrainage</p>
          <img src="${objectUrl}" alt="QR code" />
          <p class="code">${code}</p>
          <p class="url">${url}</p>
          <footer>opatam.com</footer>
          <script>
            window.onload = () => {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    // Revoke after a delay so the print preview has time to load it
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Votre QR code</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 text-gray-400 hover:text-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR + link */}
        <div className="px-5 py-6 flex flex-col items-center">
          <div
            ref={containerRef}
            className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
          >
            <QRCodeCanvas
              value={url}
              size={240}
              level="H"
              marginSize={2}
              fgColor="#1f2937"
              bgColor="#ffffff"
            />
          </div>
          <p className="mt-4 text-center text-xs text-gray-500">
            Scannez avec un téléphone pour ouvrir
          </p>
          <p className="mt-1 text-center text-xs text-gray-700 font-mono break-all px-2">
            {url}
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
            {downloaded ? (
              <Check className="w-5 h-5 text-emerald-600" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span className="text-xs font-medium">
              {downloaded ? 'Téléchargé' : 'Télécharger'}
            </span>
          </button>
          {shareSupported && (
            <button
              type="button"
              onClick={handleShare}
              className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <Share2 className="w-5 h-5" />
              <span className="text-xs font-medium">Partager</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
            <Printer className="w-5 h-5" />
            <span className="text-xs font-medium">Imprimer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
