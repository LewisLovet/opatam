/**
 * Markdown utilities — heading extraction + slugifier. Shared
 * between the web blog (/blog/[slug] sidebar TOC) and the mobile
 * tutoriels screen (inline sommaire). Pure TS, no platform deps.
 */

export interface Heading {
  /** Markdown heading level: 1 = `#`, 2 = `##`, 3 = `###`. */
  level: 1 | 2 | 3;
  /** Raw heading text (no markdown). */
  text: string;
  /** URL-safe slug used as the `id` on the rendered heading
   *  (web), or as the lookup key into the position map (mobile). */
  slug: string;
}

/**
 * Lowercases, strips diacritics, drops non-alphanumerics and joins
 * on dashes. Idempotent.
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
 * Walk the markdown source line-by-line and return every H1/H2/H3
 * with a slug. Skips fenced code blocks so a `# comment` inside a
 * code sample doesn't pollute the TOC. Disambiguates repeated
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
