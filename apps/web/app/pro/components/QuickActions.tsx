'use client';

import { Plus, CalendarOff } from 'lucide-react';
import { Button } from '@/components/ui';

interface QuickActionsProps {
  onCreateBooking: () => void;
  onBlockSlot: () => void;
}

export function QuickActions({ onCreateBooking, onBlockSlot }: QuickActionsProps) {
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
    </div>
  );
}
