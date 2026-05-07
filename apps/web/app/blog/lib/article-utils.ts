/**
 * Article-page utilities — heading extraction, slugification and
 * reading-time estimation. Used by /blog/[slug] to build the
 * sidebar table of contents and to render anchor IDs on headings
 * that match the TOC's deep links.
 */

export interface Heading {
  /** Markdown heading level: 1 = `#`, 2 = `##`, 3 = `###`. */
  level: 1 | 2 | 3;
  /** Raw heading text (no markdown). */
  text: string;
  /** URL-safe slug used as the `id` on the rendered heading. */
  slug: string;
}

/**
 * Lightweight slugifier. Lowercases, strips diacritics, drops
 * non-alphanumerics and joins on dashes. Idempotent.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Recursively extract plain text from a React-Markdown children
 * tree. Used inside ReactMarkdown's `components` overrides to
 * compute heading IDs that match what `extractHeadings` produces
 * from the same markdown source. This way the TOC anchors
 * correctly resolve to the actual rendered headings.
 */
export function reactChildrenToText(children: unknown): string {
  if (children == null || typeof children === 'boolean') return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.map(reactChildrenToText).join('');
  }
  // React element-shaped object — walk into its `children` prop.
  if (typeof children === 'object' && 'props' in (children as object)) {
    const props = (children as { props?: { children?: unknown } }).props;
    return props ? reactChildrenToText(props.children) : '';
  }
  return '';
}

/**
 * Walk the markdown source line-by-line and return every H1/H2/H3
 * with a slug. Skips fenced code blocks so a `# comment` inside
 * a code sample doesn't pollute the TOC. Disambiguates repeated
 * slugs by appending `-2`, `-3` … so deep-links stay unique.
 */
export function extractHeadings(markdown: string): Heading[] {
  const lines = markdown.split('\n');
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  let inCodeBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Match #, ##, ### with required space — ignore bare hashtags.
    const match = /^(#{1,3})\s+(.+?)\s*#*$/.exec(line);
    if (!match) continue;

    const level = match[1].length as 1 | 2 | 3;
    const text = match[2].trim();
    const baseSlug = slugify(text);
    const count = seen.get(baseSlug) ?? 0;
    const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
    seen.set(baseSlug, count + 1);

    headings.push({ level, text, slug });
  }

  return headings;
}

/**
 * Rough reading-time estimate in whole minutes. 200 words/minute
 * is the average French reading speed for narrative prose; we
 * floor at 1 min so very short articles still display "1 min".
 */
export function readingTimeMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
