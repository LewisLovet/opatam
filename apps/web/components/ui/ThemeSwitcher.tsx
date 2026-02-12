'use client';

import { useState, useEffect } from 'react';

interface ColorPalette {
  id: string;
  name: string;
  description: string;
  colors: {
    50: string;
    100: string;
    200: string;
    300: string;
    400: string;
    500: string;
    600: string;
    700: string;
    800: string;
    900: string;
    950: string;
  };
}

// Palettes adaptées aux applications de réservation/services
const colorPalettes: ColorPalette[] = [
  {
    id: 'blue',
    name: 'Bleu Océan',
    description: 'Professionnel et confiance - Style Doctolib',
    colors: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
  },
  {
    id: 'teal',
    name: 'Turquoise',
    description: 'Bien-être et sérénité - Spas & Wellness',
    colors: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e',
    },
  },
  {
    id: 'violet',
    name: 'Violet Élégant',
    description: 'Luxe et créativité - Beauté & Esthétique',
    colors: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
      950: '#2e1065',
    },
  },
  {
    id: 'rose',
    name: 'Rose Moderne',
    description: 'Doux et accueillant - Coiffure & Beauté',
    colors: {
      50: '#fff1f2',
      100: '#ffe4e6',
      200: '#fecdd3',
      300: '#fda4af',
      400: '#fb7185',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
      800: '#9f1239',
      900: '#881337',
      950: '#4c0519',
    },
  },
  {
    id: 'orange',
    name: 'Orange Énergie',
    description: 'Dynamique et sportif - Coaching & Fitness',
    colors: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407',
    },
  },
  {
    id: 'emerald',
    name: 'Émeraude',
    description: 'Nature et santé - Thérapeutes & Naturopathes',
    colors: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
      950: '#022c22',
    },
  },
  {
    id: 'indigo',
    name: 'Indigo Pro',
    description: 'Sérieux et expertise - Consultants & Formations',
    colors: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
      950: '#1e1b4b',
    },
  },
  {
    id: 'amber',
    name: 'Ambre Chaleureux',
    description: 'Artisanal et authentique - Artisans & Services',
    colors: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
  },
];

interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({ className = '' }: ThemeSwitcherProps) {
  const [selectedPalette, setSelectedPalette] = useState<string>('blue');
  const [isDark, setIsDark] = useState(false);

  const applyPaletteColors = (palette: ColorPalette) => {
    const root = document.documentElement;
    Object.entries(palette.colors).forEach(([shade, value]) => {
      root.style.setProperty(`--color-primary-${shade}`, value);
    });
  };

  useEffect(() => {
    // Check initial dark mode
    setIsDark(document.documentElement.classList.contains('dark'));

    // Restore saved palette
    const savedPaletteId = localStorage.getItem('theme-palette');
    if (savedPaletteId) {
      const savedPalette = colorPalettes.find(p => p.id === savedPaletteId);
      if (savedPalette) {
        setSelectedPalette(savedPaletteId);
        applyPaletteColors(savedPalette);
      }
    }
  }, []);

  const applyPalette = (palette: ColorPalette) => {
    applyPaletteColors(palette);
    setSelectedPalette(palette.id);
    localStorage.setItem('theme-palette', palette.id);
  };

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const currentPalette = colorPalettes.find(p => p.id === selectedPalette);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Thème de couleur
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choisissez la palette qui correspond à votre activité
          </p>
        </div>
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {isDark ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span className="text-sm font-medium">{isDark ? 'Clair' : 'Sombre'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {colorPalettes.map((palette) => (
          <button
            key={palette.id}
            onClick={() => applyPalette(palette)}
            className={`
              relative p-3 rounded-lg border-2 transition-all text-left
              ${selectedPalette === palette.id
                ? 'border-gray-900 dark:border-gray-100 ring-2 ring-offset-2 ring-gray-900 dark:ring-gray-100'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            {/* Color preview */}
            <div className="flex gap-1 mb-2">
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: palette.colors[400] }}
              />
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: palette.colors[500] }}
              />
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: palette.colors[600] }}
              />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {palette.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
              {palette.description}
            </p>
            {selectedPalette === palette.id && (
              <div className="absolute top-2 right-2">
                <svg className="h-4 w-4 text-gray-900 dark:text-gray-100" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Current palette preview */}
      {currentPalette && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Aperçu de la palette : {currentPalette.name}
          </p>
          <div className="flex gap-1">
            {Object.entries(currentPalette.colors).map(([shade, color]) => (
              <div
                key={shade}
                className="flex-1 h-8 first:rounded-l-lg last:rounded-r-lg"
                style={{ backgroundColor: color }}
                title={`${shade}: ${color}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>50</span>
            <span>500</span>
            <span>950</span>
          </div>
        </div>
      )}

      {/* Demo buttons with selected palette */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Aperçu des composants
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="px-4 py-2 rounded-lg text-white font-medium transition-colors"
            style={{ backgroundColor: currentPalette?.colors[600] }}
          >
            Bouton Primary
          </button>
          <button
            className="px-4 py-2 rounded-lg font-medium border-2 transition-colors"
            style={{
              borderColor: currentPalette?.colors[600],
              color: currentPalette?.colors[600]
            }}
          >
            Bouton Outline
          </button>
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            style={{
              backgroundColor: currentPalette?.colors[100],
              color: currentPalette?.colors[700]
            }}
          >
            Badge
          </span>
        </div>
      </div>
    </div>
  );
}

export { colorPalettes, type ColorPalette };
