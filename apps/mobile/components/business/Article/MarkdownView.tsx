/**
 * MarkdownView
 *
 * Minimalist Markdown renderer for the in-app blog/tutoriels screen.
 * Handles the syntaxes our admin actually writes:
 *   - Headings: `# H1`, `## H2`, `### H3`
 *   - Paragraphs (blank-line separated)
 *   - Bold `**text**`, italic `*text*`, inline code `` `code` ``
 *   - Links `[label](url)` — opens externally via Linking
 *   - Bullet lists `- item` / `* item`
 *   - Numbered lists `1. item`
 *   - Blockquotes `> quote`
 *   - Fenced code blocks ```lang\n...\n```
 *
 * NOT supported (drop the markdown, render raw):
 *   - Tables (rare in our content)
 *   - Inline images (we use coverImageURL + videoUrl as primary visuals)
 *   - HTML embeds
 *
 * Why custom instead of `react-native-markdown-display`:
 *   - Zero new dep, no `pnpm install` step
 *   - Tailored to the theme (text variants + colours via useTheme())
 *   - One file, easy to extend if a writer needs something specific
 */

import React from 'react';
import { View, Linking, StyleSheet } from 'react-native';
import { Text } from '../../Text';
import { useTheme } from '../../../theme';
import { slugify } from '@booking-app/shared';

interface Props {
  body: string;
  /** Called once per H1/H2/H3 with the slug + the y-offset of the
   *  rendered heading inside the markdown view. The detail screen
   *  uses this to scroll to a heading when the sommaire is tapped. */
  onHeadingLayout?: (slug: string, y: number) => void;
}

type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'code'; text: string };

/** Split a raw markdown string into blocks. Naive line-based parser
 *  — matches the syntaxes listed in the file header, anything else
 *  falls into a paragraph. Good enough for blog content authored by
 *  a human in a Markdown editor. */
function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```... ```
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing ```
      blocks.push({ kind: 'code', text: buf.join('\n') });
      continue;
    }

    // Headings
    if (/^#\s+/.test(line)) {
      blocks.push({ kind: 'h1', text: line.replace(/^#\s+/, '') });
      i += 1;
      continue;
    }
    if (/^##\s+/.test(line)) {
      blocks.push({ kind: 'h2', text: line.replace(/^##\s+/, '') });
      i += 1;
      continue;
    }
    if (/^###\s+/.test(line)) {
      blocks.push({ kind: 'h3', text: line.replace(/^###\s+/, '') });
      i += 1;
      continue;
    }

    // Blockquote
    if (/^>\s*/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s*/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s*/, ''));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph: collect contiguous non-blank, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#|>|[-*]\s|\d+\.\s|```)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    if (buf.length > 0) {
      blocks.push({ kind: 'p', text: buf.join(' ') });
    }
  }

  return blocks;
}

/** Inline-formatted text — handles **bold**, *italic*, `code`,
 *  [label](url). Returns an array of <Text> children with the
 *  appropriate styling, openable links included. */
function renderInline(
  source: string,
  colors: { text: string; primary: string; surfaceSecondary: string },
): React.ReactNode {
  // Tokenize the source by scanning for the supported markers.
  // Order matters: longer markers first so `**` doesn't trip `*`.
  const tokens: { type: 'text' | 'bold' | 'italic' | 'code' | 'link'; value: string; href?: string }[] = [];

  let rest = source;
  while (rest.length > 0) {
    // Bold **...**
    const boldMatch = rest.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      tokens.push({ type: 'bold', value: boldMatch[1] });
      rest = rest.slice(boldMatch[0].length);
      continue;
    }
    // Italic *...*
    const italicMatch = rest.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      tokens.push({ type: 'italic', value: italicMatch[1] });
      rest = rest.slice(italicMatch[0].length);
      continue;
    }
    // Inline code `...`
    const codeMatch = rest.match(/^`([^`]+)`/);
    if (codeMatch) {
      tokens.push({ type: 'code', value: codeMatch[1] });
      rest = rest.slice(codeMatch[0].length);
      continue;
    }
    // Link [label](url)
    const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      tokens.push({ type: 'link', value: linkMatch[1], href: linkMatch[2] });
      rest = rest.slice(linkMatch[0].length);
      continue;
    }
    // Plain char until next marker
    const next = rest.search(/(\*\*|\*|`|\[)/);
    if (next === -1) {
      tokens.push({ type: 'text', value: rest });
      break;
    }
    if (next === 0) {
      // Marker matched but didn't form a valid construct (e.g. lone *).
      // Consume one char as text to avoid an infinite loop.
      tokens.push({ type: 'text', value: rest[0] });
      rest = rest.slice(1);
      continue;
    }
    tokens.push({ type: 'text', value: rest.slice(0, next) });
    rest = rest.slice(next);
  }

  return tokens.map((t, idx) => {
    if (t.type === 'bold') {
      return (
        <Text key={idx} style={{ fontWeight: '700' }}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'italic') {
      return (
        <Text key={idx} style={{ fontStyle: 'italic' }}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'code') {
      return (
        <Text
          key={idx}
          style={{
            fontFamily: 'Courier',
            backgroundColor: colors.surfaceSecondary,
            paddingHorizontal: 4,
            borderRadius: 4,
          }}
        >
          {t.value}
        </Text>
      );
    }
    if (t.type === 'link') {
      return (
        <Text
          key={idx}
          onPress={() => t.href && Linking.openURL(t.href).catch(() => {})}
          style={{ color: colors.primary, textDecorationLine: 'underline' }}
        >
          {t.value}
        </Text>
      );
    }
    return <Text key={idx}>{t.value}</Text>;
  });
}

export function MarkdownView({ body, onHeadingLayout }: Props) {
  const { colors, spacing, radius } = useTheme();
  const blocks = React.useMemo(() => parseBlocks(body), [body]);

  // Headings can repeat verbatim (e.g. "Étapes" appearing twice).
  // Match the slug logic used by extractHeadings so the parent's
  // sommaire references the SAME slugs we report layouts for.
  const headingCounts = React.useRef(new Map<string, number>());
  React.useEffect(() => {
    headingCounts.current.clear();
  }, [body]);

  const consumeSlug = (text: string): string => {
    const base = slugify(text);
    const seen = headingCounts.current.get(base) ?? 0;
    headingCounts.current.set(base, seen + 1);
    return seen === 0 ? base : `${base}-${seen + 1}`;
  };

  const reportLayout = (slug: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
    onHeadingLayout?.(slug, e.nativeEvent.layout.y);
  };

  return (
    <View>
      {blocks.map((b, i) => {
        const inlineColors = {
          text: colors.text,
          primary: colors.primary,
          surfaceSecondary: colors.surfaceSecondary,
        };
        switch (b.kind) {
          case 'h1': {
            const slug = consumeSlug(b.text);
            return (
              <Text
                key={i}
                variant="h1"
                onLayout={reportLayout(slug)}
                style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
              >
                {renderInline(b.text, inlineColors)}
              </Text>
            );
          }
          case 'h2': {
            const slug = consumeSlug(b.text);
            return (
              <Text
                key={i}
                variant="h2"
                onLayout={reportLayout(slug)}
                style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}
              >
                {renderInline(b.text, inlineColors)}
              </Text>
            );
          }
          case 'h3': {
            const slug = consumeSlug(b.text);
            return (
              <Text
                key={i}
                variant="h3"
                onLayout={reportLayout(slug)}
                style={{ marginTop: spacing.md, marginBottom: spacing.xs }}
              >
                {renderInline(b.text, inlineColors)}
              </Text>
            );
          }
          case 'p':
            return (
              <Text
                key={i}
                variant="body"
                style={{ marginBottom: spacing.md, lineHeight: 24 }}
              >
                {renderInline(b.text, inlineColors)}
              </Text>
            );
          case 'ul':
            return (
              <View key={i} style={{ marginBottom: spacing.md }}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.listRow}>
                    <Text variant="body" style={{ width: 16 }}>
                      •
                    </Text>
                    <Text
                      variant="body"
                      style={{ flex: 1, lineHeight: 22 }}
                    >
                      {renderInline(item, inlineColors)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'ol':
            return (
              <View key={i} style={{ marginBottom: spacing.md }}>
                {b.items.map((item, j) => (
                  <View key={j} style={styles.listRow}>
                    <Text
                      variant="body"
                      style={{ width: 22, fontWeight: '600' }}
                    >
                      {j + 1}.
                    </Text>
                    <Text
                      variant="body"
                      style={{ flex: 1, lineHeight: 22 }}
                    >
                      {renderInline(item, inlineColors)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View
                key={i}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: colors.primary,
                  paddingLeft: spacing.md,
                  marginVertical: spacing.md,
                }}
              >
                <Text
                  variant="body"
                  color="textSecondary"
                  style={{ fontStyle: 'italic', lineHeight: 22 }}
                >
                  {renderInline(b.text, inlineColors)}
                </Text>
              </View>
            );
          case 'code':
            return (
              <View
                key={i}
                style={{
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  marginVertical: spacing.md,
                }}
              >
                <Text
                  variant="bodySmall"
                  style={{ fontFamily: 'Courier', lineHeight: 20 }}
                >
                  {b.text}
                </Text>
              </View>
            );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  listRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 6,
  },
});
