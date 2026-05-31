'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

interface EditorTopBarProps {
  isEditing: boolean;
  title: string;
  saving: boolean;
  isDirty: boolean;
  onBack: () => void;
  onSave: () => void;
}

/**
 * Sticky header for the prestation editor. Holds the back action, the
 * live title, and the primary save button (always visible on desktop;
 * mobile also gets the sticky bottom bar when the form is dirty).
 */
export function EditorTopBar({
  isEditing,
  title,
  saving,
  isDirty,
  onBack,
  onSave,
}: EditorTopBarProps) {
  return (
    <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isEditing ? 'Modifier la prestation' : 'Nouvelle prestation'}
            </p>
            {isDirty && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Non enregistré
              </span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
            {title || (isEditing ? 'Prestation' : 'Sans titre')}
          </h1>
        </div>

        <Button
          type="button"
          onClick={onSave}
          disabled={saving || (isEditing && !isDirty)}
          className="flex-shrink-0"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {isEditing ? 'Mise à jour…' : 'Création…'}
            </>
          ) : isEditing ? (
            'Enregistrer'
          ) : (
            'Créer'
          )}
        </Button>
      </div>
    </div>
  );
}
