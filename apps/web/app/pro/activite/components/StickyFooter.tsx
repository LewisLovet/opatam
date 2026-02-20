'use client';

import { Button } from '@/components/ui';
import { Loader2, Save, X } from 'lucide-react';

interface StickyFooterProps {
  dirtyCount: number;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function StickyFooter({ dirtyCount, saving, onSave, onCancel }: StickyFooterProps) {
  if (dirtyCount === 0) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-4 sm:px-6 py-3 transition-all duration-200">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
            {dirtyCount} modification{dirtyCount > 1 ? 's' : ''}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
            non enregistrée{dirtyCount > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            <X className="w-4 h-4 mr-1" />
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}
