'use client';

import { useRef, useState, type RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bold, Italic, Heading, List, ListOrdered, Link as LinkIcon, Quote, Eye, Pencil } from 'lucide-react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}

/**
 * Tiny "stealth Markdown" editor: a textarea with a formatting toolbar
 * that wraps the current selection in Markdown markers, plus a live
 * preview toggle. The user never has to know the word "Markdown" — they
 * select text and click [B] / [I] / [H] / [Liste] / [Lien] / [Citation]
 * like in any other editor.
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 18,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const wrapSelection = (
    ref: RefObject<HTMLTextAreaElement | null>,
    prefix: string,
    suffix: string,
    placeholderText = 'texte'
  ) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const before = el.value.slice(0, start);
    const selected = el.value.slice(start, end);
    const after = el.value.slice(end);
    const inner = selected || placeholderText;
    const next = `${before}${prefix}${inner}${suffix}${after}`;
    onChange(next);
    // Restore selection after React updates the textarea
    requestAnimationFrame(() => {
      el.focus();
      const cursor = (before + prefix).length;
      el.setSelectionRange(cursor, cursor + inner.length);
    });
  };

  const prefixLine = (
    ref: RefObject<HTMLTextAreaElement | null>,
    prefix: string
  ) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const v = el.value;
    // Find start of the line containing `start`
    const lineStart = v.lastIndexOf('\n', start - 1) + 1;
    const before = v.slice(0, lineStart);
    const middle = v.slice(lineStart, end);
    const after = v.slice(end);
    // Add the prefix to each non-empty line in selection (or the cursor line)
    const transformed = middle
      .split('\n')
      .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
      .join('\n');
    onChange(`${before}${transformed}${after}`);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart + prefix.length, lineStart + transformed.length);
    });
  };

  const insertLink = (ref: RefObject<HTMLTextAreaElement | null>) => {
    const el = ref.current;
    if (!el) return;
    const url = window.prompt('URL du lien :', 'https://');
    if (!url) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = el.value.slice(start, end) || 'texte du lien';
    wrapSelection(ref, '[', `](${url})`, selected);
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
        <ToolbarButton
          onClick={() => wrapSelection(textareaRef, '**', '**')}
          label="Gras"
          shortcut="Ctrl+B"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => wrapSelection(textareaRef, '*', '*')}
          label="Italique"
          shortcut="Ctrl+I"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          onClick={() => prefixLine(textareaRef, '## ')}
          label="Sous-titre"
        >
          <Heading className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => prefixLine(textareaRef, '- ')}
          label="Liste"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => prefixLine(textareaRef, '1. ')}
          label="Liste numérotée"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => prefixLine(textareaRef, '> ')}
          label="Citation"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          onClick={() => insertLink(textareaRef)}
          label="Lien"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        {/* Mode switcher pushed right */}
        <div className="ml-auto inline-flex bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              mode === 'edit'
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
            Écrire
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              mode === 'preview'
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Aperçu
          </button>
        </div>
      </div>

      {/* Body */}
      {mode === 'edit' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + B / I shortcuts
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
              if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                wrapSelection(textareaRef, '**', '**');
              } else if (e.key === 'i' || e.key === 'I') {
                e.preventDefault();
                wrapSelection(textareaRef, '*', '*');
              }
            }
          }}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-3 bg-transparent text-[14px] leading-relaxed text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-y"
        />
      ) : (
        <div
          className="px-4 py-3 prose-preview"
          style={{ minHeight: `${rows * 1.6}rem` }}
        >
          {value.trim() === '' ? (
            <p className="text-gray-400 italic text-sm">
              Rien à prévisualiser pour le moment.
            </p>
          ) : (
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-3">
                    {children}
                  </h2>
                ),
                h2: ({ children }) => (
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-3 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 mb-3 space-y-1 text-gray-700 dark:text-gray-300">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 mb-3 space-y-1 text-gray-700 dark:text-gray-300">
                    {children}
                  </ol>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary-500 pl-3 italic text-gray-600 dark:text-gray-400 my-3">
                    {children}
                  </blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 underline"
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900 dark:text-white">
                    {children}
                  </strong>
                ),
              }}
            >
              {value}
            </ReactMarkdown>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  children,
  label,
  shortcut,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />;
}
