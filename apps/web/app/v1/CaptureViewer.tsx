'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import s from './v1.module.css';

export function CaptureViewer({ file, src, title, onClose }: { file?: string; src?: string; title: string; onClose: () => void }) {
  const t = useTranslations('landing.viewer');
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.closest('[role="dialog"]')?.setAttribute('aria-label', title);
    close.current?.focus();
    return () => previous?.focus();
  }, [title]);
  return <Modal ref={panel} isOpen onClose={onClose} className={s.captureModal} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const targets = panel.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
    if (!targets?.length) return;
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }}>
    <header className={s.viewerHeader}><strong>{title}</strong><button ref={close} onClick={onClose} aria-label={t('close')}><X size={22} /></button></header>
    <div className={s.viewerBody} tabIndex={0} role="region" aria-label={t('region')}><Image src={src ?? `/v1/captures/${file}.jpg`} alt={title} width={1290} height={2796} sizes="(max-width: 600px) 90vw, 540px" /></div>
  </Modal>;
}
