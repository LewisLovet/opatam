/**
 * Client-side parser for external review CSV exports.
 *
 * Real format (semicolon-delimited, UTF-8, header row):
 *   Prenom;Mail;N°;Date;Note;Prestation;Commentaire
 *
 * Rules:
 *   - `;` field delimiter, quoted fields ("...") may contain `;` and newlines.
 *   - Header columns mapped by name, case-insensitive, tolerant of `N°`.
 *   - `Note`  → float with dot OR comma decimal → rounded + clamped to int 1..5.
 *   - `Date`  → `JJ/MM/AAAA` → Date.
 *   - `Commentaire` → comment, `Prestation` → serviceLabel, `N°` → sourceRef.
 *   - `Prenom` and `Mail` are IGNORED (never imported).
 *   - Rows with a missing/invalid Note or Date are skipped and reported.
 */

export interface ParsedReviewRow {
  rating: number; // int 1..5
  createdAt: Date;
  comment: string | null;
  serviceLabel: string | null;
  sourceRef: string | null;
}

export interface ParseReport {
  rows: ParsedReviewRow[];
  skipped: { line: number; reason: string }[];
  /** Header columns we couldn't find (e.g. Note/Date missing). */
  missingColumns: string[];
}

/** RFC-4180-ish tokenizer: splits CSV text into rows of fields, honoring
 *  quoted fields with embedded delimiters / newlines / escaped quotes. */
function tokenize(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  // Strip a leading UTF-8 BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }

  // Flush trailing field/row (file may not end with a newline).
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Normalize a header cell for matching: lowercase, strip accents/diacritics
 *  and the `°` so "N°", "n°", "no" all match. */
function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/°/g, '');
}

function parseNote(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  const rounded = Math.round(n);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

function parseFrDate(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Local midday to avoid TZ off-by-one when converted to ISO.
  const d = new Date(year, month - 1, day, 12, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function parseReviewCsv(text: string): ParseReport {
  const report: ParseReport = { rows: [], skipped: [], missingColumns: [] };
  const matrix = tokenize(text);

  if (matrix.length === 0) {
    report.missingColumns = ['Note', 'Date'];
    return report;
  }

  // Drop fully-empty leading rows.
  let headerIdx = 0;
  while (headerIdx < matrix.length && matrix[headerIdx].every((c) => c.trim() === '')) {
    headerIdx++;
  }
  const header = (matrix[headerIdx] || []).map(normalizeHeader);

  const col = {
    note: header.indexOf('note'),
    date: header.indexOf('date'),
    commentaire: header.indexOf('commentaire'),
    prestation: header.indexOf('prestation'),
    n: header.indexOf('n'),
  };

  if (col.note === -1) report.missingColumns.push('Note');
  if (col.date === -1) report.missingColumns.push('Date');
  if (report.missingColumns.length > 0) return report;

  for (let r = headerIdx + 1; r < matrix.length; r++) {
    const cells = matrix[r];
    const lineNo = r + 1; // 1-based for human-readable reports

    // Skip blank lines.
    if (cells.every((c) => c.trim() === '')) continue;

    const rating = parseNote(cells[col.note] ?? '');
    const createdAt = parseFrDate(cells[col.date] ?? '');

    if (rating === null) {
      report.skipped.push({ line: lineNo, reason: 'note invalide ou manquante' });
      continue;
    }
    if (createdAt === null) {
      report.skipped.push({ line: lineNo, reason: 'date invalide ou manquante' });
      continue;
    }

    const comment =
      col.commentaire >= 0 && (cells[col.commentaire] ?? '').trim().length > 0
        ? cells[col.commentaire].trim()
        : null;
    const serviceLabel =
      col.prestation >= 0 && (cells[col.prestation] ?? '').trim().length > 0
        ? cells[col.prestation].trim()
        : null;
    const sourceRef =
      col.n >= 0 && (cells[col.n] ?? '').trim().length > 0 ? cells[col.n].trim() : null;

    report.rows.push({ rating, createdAt, comment, serviceLabel, sourceRef });
  }

  return report;
}
