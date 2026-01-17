'use client';

import { useState, useEffect } from 'react';
import { Palette, X, Sun, Moon } from 'lucide-react';

interface ColorTheme {
  name: string;
  primary: {
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
  preview: string;
}

const colorThemes: ColorTheme[] = [
  {
    name: 'Ocean',
    preview: '#2563eb',
    primary: {
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
    name: 'Emerald',
    preview: '#059669',
    primary: {
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
    name: 'Violet',
    preview: '#7c3aed',
    primary: {
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
    name: 'Rose',
    preview: '#e11d48',
    primary: {
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
    name: 'Amber',
    preview: '#d97706',
    primary: {
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
  {
    name: 'Graphite',
    preview: '#525252',
    primary: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#262626',
      900: '#171717',
      950: '#0a0a0a',
    },
  },
];

export function ThemeColorPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('Ocean');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Load saved color theme
    const savedColor = localStorage.getItem('theme-color');
    if (savedColor) {
      const theme = colorThemes.find((t) => t.name === savedColor);
      if (theme) {
        applyTheme(theme);
        setCurrentTheme(theme.name);
      }
    }

    // Load saved dark mode preference
    const savedDark = localStorage.getItem('theme-dark');
    if (savedDark !== null) {
      const dark = savedDark === 'true';
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    }
  }, []);

  const applyTheme = (theme: ColorTheme) => {
    const root = document.documentElement;
    Object.entries(theme.primary).forEach(([key, value]) => {
      root.style.setProperty(`--color-primary-${key}`, value);
    });
    localStorage.setItem('theme-color', theme.name);
    setCurrentTheme(theme.name);
  };

  const handleSelect = (theme: ColorTheme) => {
    applyTheme(theme);
    setIsOpen(false);
  };

  const toggleDarkMode = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    document.documentElement.classList.toggle('dark', newDark);
    localStorage.setItem('theme-dark', String(newDark));
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Color picker panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Couleur du theme
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {colorThemes.map((theme) => (
              <button
                key={theme.name}
                onClick={() => handleSelect(theme)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors ${
                  currentTheme === theme.name
                    ? 'bg-gray-100 dark:bg-gray-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 transition-transform hover:scale-110 ${currentTheme === theme.name ? 'ring-current' : 'ring-transparent'}`}
                  style={{
                    backgroundColor: theme.preview,
                    color: theme.preview,
                  }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">{theme.name}</span>
              </button>
            ))}
          </div>

          {/* Dark mode toggle */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="text-sm text-gray-700 dark:text-gray-300">Mode sombre</span>
              <div
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isDark ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center ${
                    isDark ? 'translate-x-5.5 left-0.5' : 'left-0.5'
                  }`}
                  style={{ transform: isDark ? 'translateX(22px)' : 'translateX(0)' }}
                >
                  {isDark ? (
                    <Moon className="w-3 h-3 text-primary-600" />
                  ) : (
                    <Sun className="w-3 h-3 text-amber-500" />
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center hover:shadow-xl transition-shadow group"
        aria-label="Choisir la couleur du theme"
      >
        <Palette className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
      </button>
    </div>
  );
}
