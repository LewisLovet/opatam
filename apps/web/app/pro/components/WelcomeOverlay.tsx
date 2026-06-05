'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { PartyPopper, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui';

interface WelcomeOverlayProps {
  businessName: string;
  slug: string;
  onClose: () => void;
}

export function WelcomeOverlay({ businessName, slug, onClose }: WelcomeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Celebratory confetti burst on open — two streams from the bottom corners.
  useEffect(() => {
    if (!canvasRef.current) return;
    const fire = confetti.create(canvasRef.current, { resize: true, useWorker: true });
    const end = Date.now() + 1500;
    const colors = ['#1a6daf', '#60a5fa', '#fbbf24', '#34d399', '#f472b6'];

    const frame = () => {
      fire({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 1 }, colors });
      fire({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    // A single big pop from the centre to kick it off.
    fire({ particleCount: 80, spread: 90, startVelocity: 38, origin: { y: 0.6 }, colors });

    return () => fire.reset();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-6 sm:p-8 text-center"
      >
        <div className="mx-auto w-16 h-16 rounded-full bg-primary-50 dark:bg-primary-950 flex items-center justify-center">
          <PartyPopper className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>

        <h2 className="mt-5 text-xl font-bold text-gray-900 dark:text-white">
          Bienvenue sur Opatam ! 🎉
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Votre page «&nbsp;{businessName}&nbsp;» est créée. Plus que quelques détails pour recevoir
          vos premières réservations.
        </p>

        <div className="mt-6 space-y-3">
          <Button variant="primary" fullWidth onClick={onClose}>
            Découvrir mon espace
          </Button>
          <a
            href={`/p/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 w-full text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            Voir ma page publique
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Confetti canvas — above everything, clicks pass through. */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
